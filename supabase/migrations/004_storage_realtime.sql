-- Enable Realtime and Storage preparation for dev usage
-- Note: publication checks are defensive to avoid errors if supabase_realtime is not present

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='jobs') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='job_messages') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.job_messages';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='invoices') THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices';
    END IF;
  END IF;
END $$;

-- Storage bucket creation
-- NOTE: Option A (SQL) is included but fragile across Supabase versions; prefer creating buckets via the dashboard
-- Option A — create via SQL (requires service role or SQL editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Option B: create `job-photos` bucket using the Supabase Dashboard (recommended for stability)

-- Storage policies: vendor uploads/reads only for their own job folders
-- Path convention: {job_id}/{filename}

DROP POLICY IF EXISTS "vendor_upload_own_job_photos" ON storage.objects;
CREATE POLICY "vendor_upload_own_job_photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM jobs WHERE assigned_vendor_id = (
      SELECT id FROM vendors WHERE email = auth.jwt()->>'email'
    )
  )
);

DROP POLICY IF EXISTS "vendor_read_own_job_photos" ON storage.objects;
CREATE POLICY "vendor_read_own_job_photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'job-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM jobs WHERE assigned_vendor_id = (
      SELECT id FROM vendors WHERE email = auth.jwt()->>'email'
    )
  )
);
