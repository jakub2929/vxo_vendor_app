-- ============================================================================
-- VXO Vendor App — Phase 5 Cutover SQL
-- ----------------------------------------------------------------------------
-- Generated: 2026-05-28
-- Target:    Ryan's prod Supabase (baspxigjzkrotqxmpygf)
-- Scope:     ADDITIVE ONLY. No drops, no destructive migrations.
-- Safety:    Every statement is idempotent. Safe to run multiple times.
-- Source:    Consolidated from supabase/refract/*.sql plus gap analysis
--            against the app's data layer (src/hooks, src/features, src/lib).
--
-- Apply procedure (Ryan):
--   1. Run this file end-to-end on baspxigjzkrotqxmpygf.
--   2. Run the verification block at the bottom — every SELECT should
--      return at least one row for the object it checks.
--   3. Confirm to the app team; we then swap .env and run hardware smoke.
--
-- What this file does NOT include:
--   - Phase 5B transition RPCs (claim_job, accept_job, reject_job,
--     start_travel, mark_on_site, complete_job, send_invoice, send_quote).
--     These remain Ryan-authored against vendor_requests / request_vendors
--     and are tracked separately. App calls are currently stubbed.
--   - Any SQL from supabase/migrations/ or supabase/schema/ — those target
--     the old vendors/jobs dev schema (obsolete post Phase 5 refactor).
--
-- Sections:
--   1.  vendor_profiles  — additive columns + unique email constraint
--   2.  vendor_requests  — additive columns (eta, checkin/out, photo ids)
--   3.  device_tokens    — unique (user_id, platform) for upsert
--   4.  profiles         — status column for approval lifecycle
--   5.  Storage buckets  — vendor-avatars, vendor-documents, job-photos
--   6.  Realtime         — publication membership for app's 4 channels
--   7.  *** REVIEW WITH RYAN *** — invoices, invoice_items, support_messages
--       (referenced by app code, NOT in supabase/ryan-prod-mirror/schema.sql;
--        included as IF NOT EXISTS but flagged because they may already
--        exist on prod under a different shape, or Ryan may need to author
--        them in his own style. Coordinate before applying section 7.)
-- ============================================================================


-- ============================================================================
-- SECTION 1 — vendor_profiles additive columns
-- ----------------------------------------------------------------------------
-- Ryan applied 5 of these on 2026-05-21 (about, business_name, insured,
-- notification_prefs, radius_miles). All are idempotent — reapply is a no-op.
-- availability_status was added post-confirm as a Phase 5 hotfix (OOO toggle).
-- avatar_path / coi_path / w9_path / updated_at are gap-fills surfaced by
-- this audit (FillProfile writes them; not present in Ryan's mirror).
-- ============================================================================

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS about text;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS business_name text;
COMMENT ON COLUMN vendor_profiles.business_name IS
  'Vendor business display name. Replaces service_area workaround.';

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS insured boolean DEFAULT false;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "new_job": true,
    "client_message": true,
    "invoice_paid": true,
    "quote_accepted": true,
    "invoice_overdue": true,
    "account_status": true
  }'::jsonb;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS radius_miles integer DEFAULT 25;

ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'active'
  CHECK (availability_status IN ('active', 'out_of_office'));
COMMENT ON COLUMN vendor_profiles.availability_status IS
  'Vendor self-toggled availability. active=receiving dispatches, out_of_office=paused. Distinct from profiles.status (approval).';

-- Gap-fill: FillProfile writes these path columns after Storage uploads.
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS coi_path text;
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS w9_path text;

-- Gap-fill: vendorCache reads updated_at; not present in mirror.
-- Default now() so existing rows get a value; trigger below keeps it fresh.
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Gap-fill: FillProfile uses .upsert({...}, { onConflict: 'email' }) — Postgres
-- requires a unique constraint on (email) for ON CONFLICT to resolve. Without
-- this, upsert errors with "no unique or exclusion constraint matching".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'vendor_profiles'
      AND c.contype  = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
      ) = ARRAY['email']::name[]
  ) THEN
    ALTER TABLE vendor_profiles
      ADD CONSTRAINT vendor_profiles_email_unique UNIQUE (email);
  END IF;
END $$;

-- Keep updated_at fresh on every UPDATE.
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
-- SECTION 2 — vendor_requests additive columns
-- ----------------------------------------------------------------------------
-- All gap-fills from Phase 5 feature work. Idempotent.
-- Ryan confirmed reapply-safe on 2026-05-21.
-- ============================================================================

ALTER TABLE vendor_requests
  ADD COLUMN IF NOT EXISTS checkin_time  timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_time timestamptz;

ALTER TABLE vendor_requests
  ADD COLUMN IF NOT EXISTS completion_photo_ids text[];

ALTER TABLE vendor_requests
  ADD COLUMN IF NOT EXISTS eta_label    text,
  ADD COLUMN IF NOT EXISTS eta_datetime timestamptz;


-- ============================================================================
-- SECTION 3 — device_tokens unique constraint
-- ----------------------------------------------------------------------------
-- App uses .upsert({...}, { onConflict: 'user_id,platform' }) for multi-device
-- push token rotation. Constraint may already exist; guard makes this a no-op.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
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
-- SECTION 4 — profiles.status column
-- ----------------------------------------------------------------------------
-- profiles is the auth-trigger-managed shared profile table (clients + vendors).
-- FillProfile sets status='pending' on first submit; vendorCache reads it as
-- the approval lifecycle (distinct from vendor_profiles.availability_status).
-- Mirror doesn't list this column; gap-fill defensively.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    -- Only run if profiles exists. If Ryan's profiles table is in a different
    -- schema or doesn't exist, surface that during the verification block.
    EXECUTE 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text
             NOT NULL DEFAULT ''pending''
             CHECK (status IN (''pending'',''approved'',''suspended'',''rejected''))';
  END IF;
END $$;


-- ============================================================================
-- SECTION 5 — Storage buckets
-- ----------------------------------------------------------------------------
-- App code in src/lib/vendorStorage.ts + src/lib/jobPhotos.ts uses:
--   vendor-avatars   — public read, own-folder write, jpeg/png, 10MB
--   vendor-documents — private (signed URLs), jpeg/png/pdf, 10MB
--   job-photos       — private, jpeg/png/webp, 10MB (client re-encodes JPEG)
--
-- INSERT ... ON CONFLICT DO NOTHING — buckets created only if missing.
-- RLS policies below are MINIMAL; Ryan should review against his existing
-- storage RLS conventions before relying on them in prod.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('vendor-avatars',   'vendor-avatars',   true,  10485760, ARRAY['image/jpeg','image/png']),
  ('vendor-documents', 'vendor-documents', false, 10485760, ARRAY['image/jpeg','image/png','application/pdf']),
  ('job-photos',       'job-photos',       false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — minimal own-folder policies. The folder convention is:
--   vendor-avatars   path = {vendor_profiles.id}/avatar
--   vendor-documents path = {vendor_profiles.id}/{coi|w9}
--   job-photos       path = {vendor_requests.id}/photo-...
-- Vendors are identified via auth.uid() -> vendor_profiles.user_id.

-- vendor-avatars: public SELECT (anyone can fetch the avatar URL)
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

-- job-photos: vendor can read+write photos for any request they're assigned to.
-- Folder name (first segment of path) = vendor_requests.id (uuid).
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
-- SECTION 6 — Realtime publication membership
-- ----------------------------------------------------------------------------
-- App subscribes to:
--   vendor:{id}              -> vendor_profiles  UPDATE  filter id=eq.{id}
--   home:{id}, jobs-list:{id}-> request_vendors  *       filter vendor_id=eq
--   chat:{jobId}             -> job_messages     INSERT  filter request_id=eq
--   support:{id}:*, summary  -> support_messages INSERT  filter vendor_id=eq
--
-- Each table must be a member of the supabase_realtime publication.
-- support_messages add is conditional on that table existing (Section 7).
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendor_profiles','request_vendors','job_messages']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
      AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
      )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- support_messages added conditionally (section 7 may or may not have created it)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='support_messages')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_messages'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
END $$;


-- ============================================================================
-- SECTION 7 — *** REVIEW WITH RYAN BEFORE APPLYING ***
-- ----------------------------------------------------------------------------
-- The app code reads/writes these tables, but they are NOT present in
-- supabase/ryan-prod-mirror/schema.sql (the snapshot of Ryan's prod schema).
-- Two possibilities:
--   (a) Ryan's prod already has them (mirror is stale), in which case the
--       IF NOT EXISTS guards make this a no-op.
--   (b) They genuinely do not exist on prod, in which case the entire
--       earnings tab + invoice flow + support chat is broken regardless
--       of this SQL — Ryan would need to author these tables in his own
--       style to fit his backend conventions.
--
-- The shapes below are inferred from the app code (select / insert column
-- patterns) and the OLD schema/add-invoice-extensions.sql + add-support-
-- messages.sql definitions, adapted to Ryan's FK targets (vendor_profiles,
-- vendor_requests). FKs are NOT VALID where dependent table data may exist.
--
-- Recommendation: SKIP THIS SECTION on first apply. Run sections 1-6, then
-- ask Ryan whether prod already has invoices/invoice_items/support_messages.
-- If yes, this section is irrelevant; if no, get his sign-off on these shapes
-- (or his own preferred schema) before running.
-- ============================================================================

-- invoices — vendor-facing financial records for a vendor_request
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid REFERENCES vendor_requests(id) ON DELETE CASCADE,
  vendor_id       uuid REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'invoice'
                  CHECK (kind IN ('invoice','quote')),
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','viewed','approved','accepted','paid','overdue','rejected','cancelled','expired')),
  total           numeric NOT NULL DEFAULT 0,
  diagnostic_fee  numeric,
  labor           numeric,
  parts           numeric,
  description     text,
  notes           text,
  line_items      jsonb,
  valid_until     timestamptz,
  sent_at         timestamptz,
  viewed_at       timestamptz,
  paid_at         timestamptz,
  overdue_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_vendor_id    ON invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id       ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status       ON invoices(status);

-- invoice_items — line-item breakdown, embedded select in useJobChat
CREATE TABLE IF NOT EXISTS invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount      numeric NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- support_messages — vendor↔support chat (current_job + general threads)
CREATE TABLE IF NOT EXISTS support_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    uuid NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  thread_type  text NOT NULL CHECK (thread_type IN ('current_job','general')),
  sender       text NOT NULL CHECK (sender IN ('vendor','support','system')),
  message      text NOT NULL,
  job_id       uuid REFERENCES vendor_requests(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_vendor_id ON support_messages(vendor_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_thread    ON support_messages(vendor_id, thread_type, created_at);


-- ============================================================================
-- VERIFICATION BLOCK
-- ----------------------------------------------------------------------------
-- Run each query after applying. Every one should return >= 1 row.
-- If anything returns 0 rows, the corresponding section did not take effect.
-- ============================================================================

-- 1. vendor_profiles new columns
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='vendor_profiles'
  AND column_name IN ('about','business_name','insured','notification_prefs',
                      'radius_miles','availability_status','avatar_path',
                      'coi_path','w9_path','updated_at')
ORDER BY column_name;
-- expect: 10 rows

-- 2. vendor_profiles unique email constraint
SELECT conname FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname='vendor_profiles' AND c.contype='u';
-- expect: at least one row, including vendor_profiles_email_unique

-- 3. vendor_requests new columns
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='vendor_requests'
  AND column_name IN ('checkin_time','checkout_time','completion_photo_ids',
                      'eta_label','eta_datetime')
ORDER BY column_name;
-- expect: 5 rows

-- 4. device_tokens unique constraint
SELECT conname FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname='device_tokens' AND c.contype='u';
-- expect: at least one row with both (user_id, platform)

-- 5. profiles.status column
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='profiles' AND column_name='status';
-- expect: 1 row (if profiles table exists)

-- 6. Storage buckets
SELECT id, public, file_size_limit FROM storage.buckets
WHERE id IN ('vendor-avatars','vendor-documents','job-photos');
-- expect: 3 rows

-- 7. Storage RLS policies
SELECT policyname FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
  AND policyname IN ('vendor_avatars_public_read','vendor_avatars_own_write',
                     'vendor_documents_own_all','job_photos_assigned_vendor_all')
ORDER BY policyname;
-- expect: 4 rows

-- 8. Realtime publication membership
SELECT tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND schemaname='public'
  AND tablename IN ('vendor_profiles','request_vendors','job_messages','support_messages')
ORDER BY tablename;
-- expect: 4 rows (3 if section 7 was skipped — support_messages absent)

-- 9. Section 7 tables (only if applied)
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('invoices','invoice_items','support_messages')
ORDER BY table_name;
-- expect: 3 rows if section 7 was applied (or if Ryan's prod already had them);
--         fewer rows otherwise — see Section 7 commentary.

-- ============================================================================
-- END OF CUTOVER.sql
-- ============================================================================
