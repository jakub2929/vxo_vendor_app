-- Add `public.vendors` to the supabase_realtime publication.
--
-- Why: the vendor app subscribes to UPDATEs of its own vendors row from
-- src/hooks/useVendorRealtime.ts so the PendingStatusBanner (and Active/OOO
-- state) refreshes within ~1s of an admin flipping `vendors.status` in
-- Studio — no force-quit needed. Without this ALTER PUBLICATION, the
-- subscription connects but never receives change events.
--
-- RLS: existing `vendor_own` policy in 003_rls_policies.sql already grants
-- SELECT on the vendor's own row (Realtime RLS == query RLS), so no policy
-- change is needed.
--
-- Mirrors the defensive shape of 004_storage_realtime.sql: only mutate the
-- publication if it exists and the table isn't already in it.
--
-- Staged here in supabase/schema/ rather than supabase/migrations/ because
-- migrations/ is Ryan's prod source-of-truth. Promote to a numbered
-- migration when applying.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'vendors'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors';
    END IF;
  END IF;
END $$;
