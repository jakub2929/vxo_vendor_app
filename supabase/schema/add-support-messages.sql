-- Support chat messages — vendor ↔ VXO admin thread.
--
-- Two thread types per vendor: 'current_job' (job-scoped) and 'general'
-- (free-form Q&A). Senders: 'vendor', 'support', or 'system' (Alfred bot).
--
-- Migrated from supabase/migrations/005_support_messages.sql to align with
-- project convention: vendor-app-side schema extensions live in schema/
-- alongside invoice-extensions / quote-extensions / vendor-documents.
-- migrations/ is reserved for the dev-only baseline reconstruction
-- (001_alfred_tables_DEV_ONLY.sql etc.) per supabase/migrations/README.md.
--
-- Already applied to the dev DB via the original migration file (which is
-- preserved as 005_support_messages.sql.bak for audit trail). This file is
-- idempotent — safe to re-run, no-ops if already present.
--
-- When Ryan ships an official support_messages schema, reconcile.

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  thread_type TEXT NOT NULL CHECK (thread_type IN ('current_job', 'general')),
  sender TEXT NOT NULL CHECK (sender IN ('vendor', 'support', 'system')),
  message TEXT NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_vendor
  ON public.support_messages(vendor_id, thread_type, created_at DESC);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Vendor can read/insert their own support messages. 'support' / 'system' rows
-- for that vendor are visible too (RLS scopes by vendor_id, not by sender) so
-- the app sees replies sent by an admin or Alfred bot.
DROP POLICY IF EXISTS "vendor_support_own" ON public.support_messages;
CREATE POLICY "vendor_support_own" ON public.support_messages
  FOR ALL
  USING (vendor_id = (SELECT id FROM public.vendors WHERE email = auth.jwt()->>'email'))
  WITH CHECK (vendor_id = (SELECT id FROM public.vendors WHERE email = auth.jwt()->>'email'));

-- Realtime publication (defensive — matches the pattern in 004_storage_realtime.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'support_messages'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages';
    END IF;
  END IF;
END $$;
