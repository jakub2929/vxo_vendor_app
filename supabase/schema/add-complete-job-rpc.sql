-- complete_job(p_job_id, p_photo_ids) — vendor-initiated job completion.
--
-- Pattern matches the other vendor-initiated transitions in
-- supabase/schema/add-job-transition-rpcs.sql (accept_job, reject_job,
-- start_travel, mark_on_site):
--   - SECURITY DEFINER + locked search_path
--   - Auth via current_vendor_id() helper (vendor must own the job)
--   - RAISE EXCEPTION on auth / state failure
--   - RETURNS SETOF jobs so the client can `.rpc().select().single()`
--
-- Allowed source statuses: on_site, en_route (the latter only if the vendor
-- got there fast enough to skip an explicit on-site tap and the demo
-- heuristic in JobChatScreen never fired). Hard-rejecting accepted/new keeps
-- "Mark Complete" from being a shortcut around the travel flow.
--
-- p_photo_ids is the array of Storage paths the client just uploaded into
-- job-photos/{job_id}/*. Length must be 1..5 (mirrors the client cap).
-- Photo path validation: we don't introspect Storage from inside the RPC —
-- if the vendor passes a bogus path the row will store garbage and the photo
-- just won't render. Storage RLS already prevents writes outside their own
-- {job_id}/ folder, so the worst case is self-inflicted broken thumbnails.
--
-- Side effects:
--   - status → 'complete'
--   - completion_photo_ids → p_photo_ids
--   - checkout_time = NOW() (only if NULL, mirrors mark_on_site's COALESCE)
--   - updated_at = NOW()
--
-- No dispatch_log row: dispatch_log.action enum has no 'completed' value and
-- adding one is out of scope for this iteration. See add-job-transition-rpcs
-- header for the same constraint on start_travel / mark_on_site.
--
-- Idempotent (CREATE OR REPLACE). Apply via Supabase Studio SQL Editor on
-- dev. Ryan applies on prod separately.

CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id    UUID,
  p_photo_ids TEXT[]
)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id       UUID := public.current_vendor_id();
  v_current_status  TEXT;
  v_assigned_vendor UUID;
  v_photo_count     INT;
BEGIN
  IF p_photo_ids IS NULL THEN
    RAISE EXCEPTION 'At least one completion photo is required'
      USING ERRCODE = '22023';
  END IF;

  v_photo_count := array_length(p_photo_ids, 1);
  IF v_photo_count IS NULL OR v_photo_count < 1 THEN
    RAISE EXCEPTION 'At least one completion photo is required'
      USING ERRCODE = '22023';
  END IF;
  IF v_photo_count > 5 THEN
    RAISE EXCEPTION 'Up to 5 completion photos allowed (got %)', v_photo_count
      USING ERRCODE = '22023';
  END IF;

  SELECT status, assigned_vendor_id INTO v_current_status, v_assigned_vendor
  FROM jobs WHERE id = p_job_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_assigned_vendor IS DISTINCT FROM v_vendor_id THEN
    RAISE EXCEPTION 'Job not assigned to this vendor' USING ERRCODE = '42501';
  END IF;

  IF v_current_status NOT IN ('on_site', 'en_route') THEN
    RAISE EXCEPTION 'Cannot complete job from status %', v_current_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE jobs
     SET status               = 'complete',
         completion_photo_ids = p_photo_ids,
         checkout_time        = COALESCE(checkout_time, NOW()),
         updated_at           = NOW()
   WHERE id = p_job_id;

  RETURN QUERY SELECT * FROM jobs WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_job(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_job(UUID, TEXT[]) TO authenticated;

-- Smoke check (no auth context — proves the auth gate fires):
--   SELECT * FROM complete_job(
--     'a1234567-0000-4000-8000-000000000001',
--     ARRAY['a1234567-0000-4000-8000-000000000001/photo-1.jpg']
--   );
-- Expected: ERROR — "Not authenticated" (28000).
