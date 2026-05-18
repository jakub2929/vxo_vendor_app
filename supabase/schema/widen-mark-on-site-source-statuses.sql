-- Widen mark_on_site to accept transitions from BOTH 'en_route' and 'accepted'.
-- Use case: vendor skipped tapping Get Directions but arrived on site anyway.
--
-- Current behavior: rejects 'accepted' with error 'Cannot mark on-site from status accepted'.
-- After this patch: accepts both source statuses, transitions atomically to 'on_site'.
--
-- Original RPC lives in: supabase/schema/add-job-transition-rpcs.sql
-- Idempotent: this is a CREATE OR REPLACE of the same function with one IF condition widened.
--
-- Apply on dev now; Ryan applies on prod when ready.

CREATE OR REPLACE FUNCTION public.mark_on_site(p_job_id UUID)
RETURNS SETOF public.jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_vendor_id UUID := public.current_vendor_id();
  v_current_status TEXT;
  v_assigned_vendor UUID;
BEGIN
  SELECT status, assigned_vendor_id INTO v_current_status, v_assigned_vendor
  FROM jobs WHERE id = p_job_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_assigned_vendor IS DISTINCT FROM v_vendor_id THEN
    RAISE EXCEPTION 'Job not assigned to this vendor' USING ERRCODE = '42501';
  END IF;
  IF v_current_status NOT IN ('en_route', 'accepted') THEN
    RAISE EXCEPTION 'Cannot mark on-site from status %', v_current_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE jobs
     SET status = 'on_site',
         checkin_time = COALESCE(checkin_time, NOW()),
         updated_at = NOW()
   WHERE id = p_job_id;

  RETURN QUERY SELECT * FROM jobs WHERE id = p_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_on_site(UUID) TO authenticated;

-- Smoke check (no auth context — proves the auth gate fires):
--   SELECT * FROM mark_on_site('a1234567-0000-4000-8000-000000000003');
-- Expected: ERROR — 'Not authenticated' (28000).
