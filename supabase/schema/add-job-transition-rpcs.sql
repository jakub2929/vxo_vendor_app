-- Postgres RPC functions for vendor-initiated job status transitions.
--
-- Why RPC over direct UPDATE: the vendor app's Accept / Reject / Get
-- Directions / On Site buttons need to advance jobs.status AND write to
-- dispatch_log atomically. Direct supabase.from('jobs').update(...) on the
-- client can't do that in one round-trip, and would skip the audit log.
-- RPCs run server-side, enforce status-transition validity, and can be
-- swapped for an Alfred HTTP endpoint later without touching the client.
--
-- All four RPCs:
--   - SECURITY DEFINER + locked search_path: bypass RLS but enforce their
--     own auth check (vendor must own the job)
--   - RAISE EXCEPTION on auth / state failure so supabase-js surfaces a
--     readable error.message to the client
--   - RETURNS SETOF jobs (consistency): every RPC returns the updated jobs
--     row so the client can update its React Query cache without issuing a
--     follow-up SELECT. Callers can `.rpc(...).select('*').single()`.
--
-- Apply via Supabase Studio SQL Editor. Idempotent (CREATE OR REPLACE).
--
-- Schema reference: supabase/migrations/001_alfred_tables_DEV_ONLY.sql
--   jobs.status CHECK: new|dispatched|accepted|en_route|on_site|
--                      complete|invoiced|paid|closed|cancelled
--   dispatch_log.action CHECK: offered|accepted|declined|timed_out
--   dispatch_log has NO metadata column today — see TODO in reject_job.

-- =============================================================================
-- Shared helper: resolve the calling vendor's id from the JWT email claim.
-- =============================================================================
-- Pulled into its own function so the four RPCs don't repeat the lookup.
-- RAISES if no vendor row matches — that's the "not signed in" / "signed in
-- as a non-vendor" path.

CREATE OR REPLACE FUNCTION public.current_vendor_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
  v_vendor_id UUID;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT id INTO v_vendor_id FROM vendors WHERE email = v_email;

  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'No vendor record for %', v_email USING ERRCODE = '28000';
  END IF;

  RETURN v_vendor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.current_vendor_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_vendor_id() TO authenticated;

-- =============================================================================
-- accept_job(p_job_id) — new|dispatched → accepted
-- =============================================================================
-- Side effect: writes dispatch_log row with action='accepted'.

CREATE OR REPLACE FUNCTION public.accept_job(p_job_id UUID)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_current_status NOT IN ('new', 'dispatched') THEN
    RAISE EXCEPTION 'Cannot accept job in status %', v_current_status
      USING ERRCODE = '22023';
  END IF;

  -- updated_at is set by trigger set_updated_at_jobs, but assigning here
  -- documents intent and protects against the trigger being dropped.
  UPDATE jobs
     SET status = 'accepted', updated_at = NOW()
   WHERE id = p_job_id;

  INSERT INTO dispatch_log (job_id, vendor_id, action)
  VALUES (p_job_id, v_vendor_id, 'accepted');

  RETURN QUERY SELECT * FROM jobs WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_job(UUID) TO authenticated;

-- =============================================================================
-- reject_job(p_job_id, p_reason) — new|dispatched → cancelled
-- =============================================================================
-- Side effect: writes dispatch_log row with action='declined'.
-- TODO: p_reason is currently dropped server-side. dispatch_log has no
-- metadata column. Either ALTER TABLE dispatch_log ADD COLUMN metadata JSONB,
-- or route the reason through job_messages as a system bubble. Decide before
-- production.

CREATE OR REPLACE FUNCTION public.reject_job(
  p_job_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_current_status NOT IN ('new', 'dispatched') THEN
    RAISE EXCEPTION 'Cannot reject job in status %', v_current_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE jobs
     SET status = 'cancelled', updated_at = NOW()
   WHERE id = p_job_id;

  INSERT INTO dispatch_log (job_id, vendor_id, action)
  VALUES (p_job_id, v_vendor_id, 'declined');

  -- p_reason intentionally unused. dispatch_log has no metadata column today.
  -- To enable persistence:
  --   ALTER TABLE dispatch_log ADD COLUMN metadata JSONB;
  --   -- then replace the INSERT above with:
  --   INSERT INTO dispatch_log (job_id, vendor_id, action, metadata)
  --   VALUES (p_job_id, v_vendor_id, 'declined',
  --           CASE WHEN p_reason IS NOT NULL
  --                THEN jsonb_build_object('reason', p_reason)
  --                ELSE NULL END);
  -- Alternative: route p_reason into job_messages as a system bubble instead
  -- of expanding dispatch_log. See file-header TODO.

  RETURN QUERY SELECT * FROM jobs WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_job(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_job(UUID, TEXT) TO authenticated;

-- =============================================================================
-- start_travel(p_job_id) — accepted → en_route
-- =============================================================================
-- No dispatch_log entry: action enum has no 'en_route' value and adding one
-- is out of scope for this iteration.

CREATE OR REPLACE FUNCTION public.start_travel(p_job_id UUID)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_current_status <> 'accepted' THEN
    RAISE EXCEPTION 'Cannot start travel from status %', v_current_status
      USING ERRCODE = '22023';
  END IF;

  UPDATE jobs
     SET status = 'en_route', updated_at = NOW()
   WHERE id = p_job_id;

  RETURN QUERY SELECT * FROM jobs WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_travel(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_travel(UUID) TO authenticated;

-- =============================================================================
-- mark_on_site(p_job_id) — en_route → on_site
-- =============================================================================
-- Side effect: stamps checkin_time = NOW() so the "On site Nm" system marker
-- in the chat timeline can render. No dispatch_log entry (no enum value).

CREATE OR REPLACE FUNCTION public.mark_on_site(p_job_id UUID)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_current_status <> 'en_route' THEN
    RAISE EXCEPTION 'Cannot mark on-site from status %', v_current_status
      USING ERRCODE = '22023';
  END IF;

  -- COALESCE preserves an existing checkin_time if for some reason the
  -- vendor got bounced back to en_route and is re-arriving. Without it,
  -- the second mark_on_site call would reset the on-site clock.
  UPDATE jobs
     SET status = 'on_site',
         checkin_time = COALESCE(checkin_time, NOW()),
         updated_at = NOW()
   WHERE id = p_job_id;

  RETURN QUERY SELECT * FROM jobs WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_on_site(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_on_site(UUID) TO authenticated;

-- =============================================================================
-- Smoke tests for the SQL author (run after apply)
-- =============================================================================
-- The RPCs assume a signed-in vendor JWT. To test from Studio SQL Editor
-- without auth context, you can temporarily call:
--
--   SELECT * FROM accept_job('a1234567-0000-4000-8000-000000000001');
--
-- ...which will RAISE 'Not authenticated' (proves the auth path is wired).
--
-- Full happy-path verification happens from the vendor app (Phase 2).
