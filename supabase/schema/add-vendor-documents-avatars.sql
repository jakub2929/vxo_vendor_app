-- Vendor documents (COI, W-9) and avatar persistence.
--
-- Candidate schema — pending approval before being promoted into the
-- supabase/migrations/ sequence. Apply via Supabase SQL Editor or psql.
-- Idempotent; safe to re-run.
--
-- Design notes:
--   * Columns store the Storage object path (e.g. "{vendor_id}/coi"), not a
--     full URL. The client constructs public URLs for avatars via
--     storage.from('vendor-avatars').getPublicUrl(path), and signed URLs
--     for documents via createSignedUrl(path, expiresIn).
--
--   * Paths do NOT include file extension. Object name is the stable
--     "{vendor_id}/{kind}" (avatar, coi, w9). Content-type is stored on
--     the Storage object metadata at upload time. This guarantees that a
--     "replace" (JPG -> PNG, PDF -> JPG) overwrites in place and never
--     orphans the old file.
--
--   * RLS Storage policies mirror migration 004 style: bucket_id +
--     storage.foldername(name)[1] cross-referenced to vendors.id via the
--     authenticated user's JWT email. Identical pattern to the existing
--     job-photos policies — proven against current Supabase Storage API.
--
--   * vendors-table column additions are nullable. All existing rows
--     post-ALTER will have NULL in the three new columns. Client reads
--     must handle null defensively (already noted for the helper hooks).

-- ============================================================================
-- 1. Columns on vendors
-- ============================================================================

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS avatar_path TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS coi_path TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS w9_path TEXT;

COMMENT ON COLUMN vendors.avatar_path IS
  'Storage object path in vendor-avatars bucket, e.g. "{vendor_id}/avatar". Build public URL via storage.from(''vendor-avatars'').getPublicUrl(path).';
COMMENT ON COLUMN vendors.coi_path IS
  'Storage object path in vendor-documents bucket, e.g. "{vendor_id}/coi". Build signed URL via storage.from(''vendor-documents'').createSignedUrl(path, 3600).';
COMMENT ON COLUMN vendors.w9_path IS
  'Storage object path in vendor-documents bucket, e.g. "{vendor_id}/w9". Build signed URL via storage.from(''vendor-documents'').createSignedUrl(path, 3600).';

-- ============================================================================
-- 2. Buckets
-- ============================================================================

-- Public-read avatars. Anyone with the URL can fetch (needed for More menu
-- avatar, Job rows, chat avatars, etc.). Writes are RLS-guarded below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-avatars', 'vendor-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Private documents (COI, W-9 are sensitive). All access via signed URLs;
-- bucket is NOT publicly listable. Read RLS limits to vendor's own folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-documents', 'vendor-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. RLS — vendor-avatars (public read, own-folder write)
-- ============================================================================

DROP POLICY IF EXISTS "vendor_avatars_public_read" ON storage.objects;
CREATE POLICY "vendor_avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-avatars');

DROP POLICY IF EXISTS "vendor_avatars_insert_own" ON storage.objects;
CREATE POLICY "vendor_avatars_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-avatars'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM vendors WHERE email = auth.jwt()->>'email'
    )
  );

DROP POLICY IF EXISTS "vendor_avatars_update_own" ON storage.objects;
CREATE POLICY "vendor_avatars_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vendor-avatars'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM vendors WHERE email = auth.jwt()->>'email'
    )
  );

DROP POLICY IF EXISTS "vendor_avatars_delete_own" ON storage.objects;
CREATE POLICY "vendor_avatars_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-avatars'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM vendors WHERE email = auth.jwt()->>'email'
    )
  );

-- ============================================================================
-- 4. RLS — vendor-documents (own-folder read AND write)
-- ============================================================================

DROP POLICY IF EXISTS "vendor_documents_select_own" ON storage.objects;
CREATE POLICY "vendor_documents_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'vendor-documents'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM vendors WHERE email = auth.jwt()->>'email'
    )
  );

DROP POLICY IF EXISTS "vendor_documents_insert_own" ON storage.objects;
CREATE POLICY "vendor_documents_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-documents'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM vendors WHERE email = auth.jwt()->>'email'
    )
  );

DROP POLICY IF EXISTS "vendor_documents_update_own" ON storage.objects;
CREATE POLICY "vendor_documents_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vendor-documents'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM vendors WHERE email = auth.jwt()->>'email'
    )
  );

DROP POLICY IF EXISTS "vendor_documents_delete_own" ON storage.objects;
CREATE POLICY "vendor_documents_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-documents'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM vendors WHERE email = auth.jwt()->>'email'
    )
  );

-- ============================================================================
-- 5. Bucket constraints (size + MIME)
--
-- Defense-in-depth. Client validates with expo-document-picker /
-- expo-image-picker MIME types and a JS size check for early UX feedback;
-- Storage enforces these limits server-side so a malformed client cannot
-- bypass them.
-- ============================================================================

UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png']
WHERE id = 'vendor-avatars';

UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf']
WHERE id = 'vendor-documents';
