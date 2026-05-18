-- Job-completion photo Storage configuration — GAP-FILL on top of migration 004.
--
-- Context: supabase/migrations/004_storage_realtime.sql already creates the
-- `job-photos` bucket (private) and the INSERT + SELECT policies that scope a
-- vendor to {job_id}/* folders for jobs they own. That file is short on two
-- production-critical bits:
--
--   1. The bucket has no file_size_limit and no allowed_mime_types — vendors
--      could push arbitrary 5 GB MP4s today if the bucket name ever leaks.
--      This file tightens both via UPDATE.
--   2. There is no DELETE policy. Vendors need to be able to remove a
--      mis-uploaded photo before they hit "Mark Complete". This file adds it.
--
-- Constraints mirror vendor-documents:
--   - 10 MB per file (raw); the app compresses to ~500 KB client-side via
--     expo-image-manipulator before upload, so this is a backstop, not a
--     hard floor the UX relies on.
--   - JPEG / PNG / WEBP only. PDFs are not a job-completion artifact.
--
-- Once `jobs.status = 'complete'` the row is effectively locked by the
-- complete_job() RPC (see add-complete-job-rpc.sql) — no further uploads or
-- deletes from the vendor app surface should happen, but the DELETE policy
-- still allows admin / Studio cleanup if needed.
--
-- Idempotent. Apply via Supabase Studio SQL Editor on dev.
-- Ryan applies on prod separately (migrations/ is his source-of-truth).

UPDATE storage.buckets
   SET file_size_limit    = 10 * 1024 * 1024,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'job-photos';

DROP POLICY IF EXISTS "vendor_delete_own_job_photos" ON storage.objects;
CREATE POLICY "vendor_delete_own_job_photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM jobs WHERE assigned_vendor_id = (
      SELECT id FROM vendors WHERE email = auth.jwt()->>'email'
    )
  )
);

-- Smoke check (run after apply):
--   SELECT id, file_size_limit, allowed_mime_types
--     FROM storage.buckets WHERE id = 'job-photos';
-- Expected:
--   file_size_limit     = 10485760
--   allowed_mime_types  = {image/jpeg,image/png,image/webp}
