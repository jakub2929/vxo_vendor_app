-- ============================================================================
-- VXO Vendor App — Phase 5 Cutover (SAFE bundle)
-- ----------------------------------------------------------------------------
-- Generated: 2026-05-28
-- Target:    Ryan's prod Supabase (baspxigjzkrotqxmpygf)
-- Scope:     ADDITIVE only. Operates on tables that ALREADY EXIST on prod
--            (confirmed by curl probes 2026-05-28). No new tables created.
-- Safety:    Every statement idempotent. Safe to run multiple times.
--
-- This file is the safe-to-apply-now half of the Phase 5 cutover. The
-- other half — `CUTOVER_NEEDS_RYAN_DECISION.sql` — is a DRAFT that needs
-- Ryan's design call before it can run. See that file's header for details.
--
-- Apply procedure (Ryan):
--   1. Run this file end-to-end on baspxigjzkrotqxmpygf.
--   2. Watch the NOTICE output — if the vendor_profiles email unique
--      constraint was SKIPPED due to duplicate emails, resolve the
--      duplicates and re-run this file. The skip is non-fatal: the rest
--      of the file applies regardless. NOTICE output includes the diagnostic
--      query for locating the duplicates.
--   3. Run the verification block at the bottom — every SELECT should
--      return at least one row for the object it checks. (Check #2 may
--      return 0 rows if the email constraint was intentionally skipped.)
--   4. Confirm to the app team; we then swap .env and run hardware smoke
--      for profile / jobs / chat / push notifications.
--      (Earnings + support + accept flows are deferred — see NEEDS_RYAN file.)
--
-- Sections:
--   1.  vendor_profiles  — additive columns (availability_status, avatar/coi/w9
--                          paths, updated_at) + unique-email constraint + trigger
--   2.  device_tokens    — unique (user_id, platform) for upsert
--   3.  Storage buckets  — vendor-avatars, vendor-documents, job-photos + RLS
--   4.  Realtime         — publication membership for vendor_profiles,
--                          request_vendors, job_messages
--
-- NOT in this file (intentionally):
--   - profiles.status        — already exists on prod (confirmed by probe)
--   - vendor_profiles base columns Ryan applied 2026-05-21 — already exist
--   - invoices / invoice_items / support_messages work — see NEEDS_RYAN file
--   - Phase 5B RPCs                                     — Ryan-authored, stubbed in app
-- ============================================================================


-- ============================================================================
-- SECTION 1 — vendor_profiles additive columns + constraints + trigger
-- ----------------------------------------------------------------------------
-- The 5 columns Ryan applied on 2026-05-21 (about, business_name, insured,
-- notification_prefs, radius_miles) are NOT repeated here — they already exist
-- and were verified by probe. This section only adds what's missing.
--
-- Probe-confirmed missing on prod:
--   - availability_status (used by OOO toggle)
--   - avatar_path / coi_path / w9_path (FillProfile writes after uploads)
--   - updated_at (vendorCache reads it; fallback ordering in queries)
--   - UNIQUE (email) constraint (FillProfile.upsert(..., onConflict: 'email'))
-- ============================================================================

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'active'
  CHECK (availability_status IN ('active', 'out_of_office'));
COMMENT ON COLUMN vendor_profiles.availability_status IS
  'Vendor self-toggled availability. active=receiving dispatches, out_of_office=paused. Distinct from profiles.status (approval).';

ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS coi_path    text;
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS w9_path     text;

-- updated_at: default now() backfills existing rows; trigger below keeps fresh.
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- UNIQUE(email) — FillProfile.tsx uses .upsert(payload, { onConflict: 'email' }).
-- Postgres requires a unique constraint on (email) for ON CONFLICT to resolve.
-- GUARD: skip (with a NOTICE) if duplicate non-null emails exist, so this file
-- doesn't halt mid-apply. Resolve duplicates, then re-run to add the constraint.
DO $$
DECLARE
  dup_count int;
BEGIN
  -- Already present? Nothing to do.
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'vendor_profiles'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
      ) = ARRAY['email']::name[]
  ) THEN
    RAISE NOTICE 'vendor_profiles email unique constraint already exists — skipping.';
    RETURN;
  END IF;

  -- Check for duplicate non-null emails that would block the constraint.
  SELECT count(*) INTO dup_count FROM (
    SELECT email FROM vendor_profiles
    WHERE email IS NOT NULL
    GROUP BY email HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE NOTICE 'SKIPPING email unique constraint: % duplicate email value(s) found in vendor_profiles. Resolve them (query below) and re-run this file.', dup_count;
    RAISE NOTICE 'Find duplicates with: SELECT email, count(*) FROM vendor_profiles WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1;';
  ELSE
    ALTER TABLE vendor_profiles
      ADD CONSTRAINT vendor_profiles_email_unique UNIQUE (email);
    RAISE NOTICE 'Added vendor_profiles_email_unique constraint.';
  END IF;
END $$;

-- updated_at touch trigger: kept idempotent via DROP-then-CREATE on trigger,
-- and CREATE OR REPLACE on the function.
CREATE OR REPLACE FUNCTION vendor_profiles_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vendor_profiles_updated_at ON vendor_profiles;
CREATE TRIGGER trg_vendor_profiles_updated_at
  BEFORE UPDATE ON vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION vendor_profiles_touch_updated_at();


-- ============================================================================
-- SECTION 2 — device_tokens unique (user_id, platform)
-- ----------------------------------------------------------------------------
-- useNotificationToken.ts:60 uses
--   .upsert({...}, { onConflict: 'user_id,platform' })
-- for per-device push token rotation. Constraint may already exist; guard
-- makes this a no-op if so.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class      t ON c.conrelid = t.oid
    WHERE t.relname = 'device_tokens'
      AND c.contype  = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
      ) = ARRAY['platform','user_id']::name[]
  ) THEN
    ALTER TABLE device_tokens
      ADD CONSTRAINT device_tokens_user_platform_unique UNIQUE (user_id, platform);
  END IF;
END $$;


-- ============================================================================
-- SECTION 3 — Storage buckets + minimal own-folder RLS
-- ----------------------------------------------------------------------------
-- App code requires three buckets (src/lib/vendorStorage.ts, src/lib/jobPhotos.ts):
--
--   vendor-avatars    — public read, own-folder write,  jpeg|png,           10MB
--                       path = {vendor_profiles.id}/avatar
--   vendor-documents  — private (signed URLs), own-folder R+W, jpeg|png|pdf, 10MB
--                       path = {vendor_profiles.id}/{coi|w9}
--   job-photos        — private, vendor-of-job R+W,  jpeg|png|webp,         10MB
--                       path = {vendor_requests.id}/photo-...
--
-- INSERT ... ON CONFLICT DO NOTHING — buckets created only if missing.
-- RLS policies guarded by IF NOT EXISTS via pg_policies probe.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('vendor-avatars',   'vendor-avatars',   true,  10485760, ARRAY['image/jpeg','image/png']),
  ('vendor-documents', 'vendor-documents', false, 10485760, ARRAY['image/jpeg','image/png','application/pdf']),
  ('job-photos',       'job-photos',       false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- vendor-avatars: public SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='vendor_avatars_public_read'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY vendor_avatars_public_read ON storage.objects
        FOR SELECT TO public
        USING (bucket_id = 'vendor-avatars')
    $POL$;
  END IF;
END $$;

-- vendor-avatars: vendor writes within own {vendor_id}/ folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='vendor_avatars_own_write'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY vendor_avatars_own_write ON storage.objects
        FOR ALL TO authenticated
        USING (
          bucket_id = 'vendor-avatars'
          AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM vendor_profiles WHERE user_id = auth.uid()
          )
        )
        WITH CHECK (
          bucket_id = 'vendor-avatars'
          AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM vendor_profiles WHERE user_id = auth.uid()
          )
        )
    $POL$;
  END IF;
END $$;

-- vendor-documents: own-folder read + write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='vendor_documents_own_all'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY vendor_documents_own_all ON storage.objects
        FOR ALL TO authenticated
        USING (
          bucket_id = 'vendor-documents'
          AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM vendor_profiles WHERE user_id = auth.uid()
          )
        )
        WITH CHECK (
          bucket_id = 'vendor-documents'
          AND (storage.foldername(name))[1] IN (
            SELECT id::text FROM vendor_profiles WHERE user_id = auth.uid()
          )
        )
    $POL$;
  END IF;
END $$;

-- job-photos: vendor can R+W photos for any request they're assigned to.
-- Folder name (first path segment) = vendor_requests.id (uuid).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='job_photos_assigned_vendor_all'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY job_photos_assigned_vendor_all ON storage.objects
        FOR ALL TO authenticated
        USING (
          bucket_id = 'job-photos'
          AND EXISTS (
            SELECT 1 FROM request_vendors rv
            JOIN vendor_profiles vp ON vp.id = rv.vendor_id
            WHERE vp.user_id = auth.uid()
              AND rv.request_id::text = (storage.foldername(name))[1]
          )
        )
        WITH CHECK (
          bucket_id = 'job-photos'
          AND EXISTS (
            SELECT 1 FROM request_vendors rv
            JOIN vendor_profiles vp ON vp.id = rv.vendor_id
            WHERE vp.user_id = auth.uid()
              AND rv.request_id::text = (storage.foldername(name))[1]
          )
        )
    $POL$;
  END IF;
END $$;


-- ============================================================================
-- SECTION 4 — Realtime publication membership
-- ----------------------------------------------------------------------------
-- App subscribes via supabase.channel(...) to:
--   vendor:{id}               -> vendor_profiles  UPDATE   filter id=eq.{id}
--   home:{id} / jobs-list:{id}-> request_vendors  *        filter vendor_id=eq
--   chat:{jobId}              -> job_messages     INSERT   filter request_id=eq
--
-- (support_messages channel is deferred to NEEDS_RYAN file along with the table.)
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendor_profiles','request_vendors','job_messages']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=t
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;


-- ============================================================================
-- VERIFICATION BLOCK
-- ----------------------------------------------------------------------------
-- Run each query after applying. Every one should return the expected count.
-- ============================================================================

-- 1. vendor_profiles new columns (expect 5 rows)
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='vendor_profiles'
  AND column_name IN ('availability_status','avatar_path','coi_path','w9_path','updated_at')
ORDER BY column_name;

-- 2. vendor_profiles unique-email constraint
--    Expect 1+ row including vendor_profiles_email_unique.
--    May legitimately return 0 rows for that name if the §1 guard
--    SKIPPED the constraint due to duplicate emails — check the NOTICE
--    output from this file's apply log. Resolve duplicates and re-run.
SELECT conname FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname='vendor_profiles' AND c.contype='u';

-- 3. vendor_profiles updated_at trigger (expect 1 row)
SELECT tgname FROM pg_trigger
WHERE tgrelid='vendor_profiles'::regclass
  AND tgname='trg_vendor_profiles_updated_at';

-- 4. device_tokens unique constraint (expect 1+ row covering (user_id, platform))
SELECT conname FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname='device_tokens' AND c.contype='u';

-- 5. Storage buckets (expect 3 rows)
SELECT id, public, file_size_limit FROM storage.buckets
WHERE id IN ('vendor-avatars','vendor-documents','job-photos')
ORDER BY id;

-- 6. Storage RLS policies (expect 4 rows)
SELECT policyname FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND policyname IN ('vendor_avatars_public_read','vendor_avatars_own_write',
                     'vendor_documents_own_all','job_photos_assigned_vendor_all')
ORDER BY policyname;

-- 7. Realtime publication membership (expect 3 rows)
SELECT tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND schemaname='public'
  AND tablename IN ('vendor_profiles','request_vendors','job_messages')
ORDER BY tablename;

-- ============================================================================
-- END OF CUTOVER_SAFE.sql
-- ============================================================================
