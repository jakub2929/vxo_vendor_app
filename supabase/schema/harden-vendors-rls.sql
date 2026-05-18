-- Phase 2.5 hardening: tighten vendors RLS
--
-- Replaces FOR ALL vendor_own with per-action policies. A BEFORE UPDATE
-- trigger guards status transitions to prevent vendor self-promotion.
-- A second trigger guards email immutability (email is RLS identity).
--
-- Allowed vendor actions:
--   SELECT: own row
--   INSERT: own row with status='pending' (onboarding)
--   UPDATE: own row, status can only flip active <-> out_of_office
--   DELETE: forbidden (no policy = default deny)
--
-- Admin-side status changes (pending -> active, etc.) bypass the trigger
-- when the request originates with the service_role JWT — PostgREST sets
-- `request.jwt.claim.role` to 'service_role' for those calls. Direct
-- psql / dashboard sessions are NOT PostgREST-mediated and will not have
-- this GUC set; for those, drop in `SET LOCAL session_replication_role =
-- 'replica';` ahead of the UPDATE to suppress the trigger (or use a
-- SECURITY DEFINER RPC).
--
-- Why a trigger and not WITH CHECK? A prior attempt used
-- `WITH CHECK ... = (SELECT col FROM vendors WHERE id = vendors.id)`,
-- where the inner FROM aliases `vendors` and shadows the outer policy-row
-- reference. The predicate degrades to `WHERE id = id` (tautology) and
-- the subquery sees every row, defeating the status pin. A BEFORE UPDATE
-- trigger compares OLD/NEW directly with no scoping ambiguity.

BEGIN;

-- ============================================================
-- 1. Drop existing FOR ALL policy
-- ============================================================
DROP POLICY IF EXISTS vendor_own ON vendors;

-- ============================================================
-- 2. SELECT: vendor reads own row
-- ============================================================
DROP POLICY IF EXISTS vendor_select_own ON vendors;
CREATE POLICY vendor_select_own ON vendors
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt()->>'email');

-- ============================================================
-- 3. INSERT: onboarding only, status must be 'pending'
-- ============================================================
DROP POLICY IF EXISTS vendor_insert_own ON vendors;
CREATE POLICY vendor_insert_own ON vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    email = auth.jwt()->>'email'
    AND status = 'pending'
  );

-- ============================================================
-- 4. UPDATE: vendor edits own row (column-level guards via trigger)
-- ============================================================
DROP POLICY IF EXISTS vendor_update_own ON vendors;
CREATE POLICY vendor_update_own ON vendors
  FOR UPDATE
  TO authenticated
  USING (email = auth.jwt()->>'email')
  WITH CHECK (email = auth.jwt()->>'email');

-- ============================================================
-- 5. DELETE: no policy = default deny
-- ============================================================
-- (intentionally no CREATE POLICY for DELETE)

-- ============================================================
-- 6. Trigger: guard status transitions
-- ============================================================
-- Only allows status changes that match the legitimate OOO toggle pair.
-- Any other status transition raises an exception. service_role calls
-- via PostgREST set request.jwt.claim.role='service_role' and bypass.

CREATE OR REPLACE FUNCTION enforce_vendor_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Bypass for service_role (admin operations via PostgREST)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- No status change → allow (most updates: name, phone, bio, etc.)
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Allow OOO toggle pair both directions
  IF (OLD.status = 'active' AND NEW.status = 'out_of_office')
     OR (OLD.status = 'out_of_office' AND NEW.status = 'active') THEN
    RETURN NEW;
  END IF;

  -- All other transitions: reject
  RAISE EXCEPTION 'Vendor cannot change status from % to %', OLD.status, NEW.status
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS vendor_status_change_guard ON vendors;
CREATE TRIGGER vendor_status_change_guard
  BEFORE UPDATE OF status ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION enforce_vendor_status_change();

-- ============================================================
-- 7. Trigger: email immutability
-- ============================================================
-- Email is part of RLS identity. If a vendor's row email changes
-- mid-session, the next JWT-based query no longer matches and they
-- get locked out. service_role can still change email (account merges).

CREATE OR REPLACE FUNCTION enforce_vendor_email_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Vendor email is immutable (would break auth identity)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_email_immutable_guard ON vendors;
CREATE TRIGGER vendor_email_immutable_guard
  BEFORE UPDATE OF email ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION enforce_vendor_email_immutable();

COMMIT;

-- ============================================================================
-- ROLLBACK SQL (if anything goes wrong)
-- ============================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS vendor_select_own ON vendors;
-- DROP POLICY IF EXISTS vendor_insert_own ON vendors;
-- DROP POLICY IF EXISTS vendor_update_own ON vendors;
-- DROP TRIGGER IF EXISTS vendor_status_change_guard ON vendors;
-- DROP TRIGGER IF EXISTS vendor_email_immutable_guard ON vendors;
-- DROP FUNCTION IF EXISTS enforce_vendor_status_change();
-- DROP FUNCTION IF EXISTS enforce_vendor_email_immutable();
-- CREATE POLICY vendor_own ON vendors FOR ALL TO authenticated
--   USING (email = auth.jwt()->>'email');
-- COMMIT;

-- ============================================================================
-- PROD MIGRATION CHECKLIST (for Ryan, via Supabase Studio SQL Editor)
-- ============================================================================
--
-- 1. PRE-APPLY BASELINE — confirm current policy state:
--      SELECT polname, polcmd, polqual::text AS using_clause,
--             polwithcheck::text AS check_clause
--      FROM pg_policy
--      WHERE polrelid = 'vendors'::regclass;
--    Expect one row: vendor_own / polcmd='*' (FOR ALL) / polwithcheck NULL.
--
-- 2. APPLY — paste this file's contents into Studio SQL Editor → Run.
--    Expect: BEGIN, several DROP/CREATE, COMMIT. No errors.
--
-- 3. POST-APPLY POLICY CHECK:
--      SELECT polname, polcmd FROM pg_policy
--      WHERE polrelid = 'vendors'::regclass
--      ORDER BY polname;
--    Expect three rows (polcmd letters: r=SELECT, a=INSERT, w=UPDATE):
--      vendor_insert_own  a
--      vendor_select_own  r
--      vendor_update_own  w
--    No vendor_own. No DELETE policy.
--
-- 4. POST-APPLY TRIGGER CHECK:
--      SELECT tgname FROM pg_trigger
--      WHERE tgrelid = 'vendors'::regclass AND NOT tgisinternal
--      ORDER BY tgname;
--    Expect (in addition to any pre-existing triggers like
--    set_updated_at_vendors):
--      vendor_email_immutable_guard
--      vendor_status_change_guard
--
-- 5. APP SMOKE — positive (must keep working):
--    a. Profile save (Name/Phone/Bio/Address) → row updates, no error.
--    b. OOO toggle ON  (active → out_of_office) → status flips in DB.
--    c. OOO toggle OFF (out_of_office → active) → status flips back.
--    d. Fresh vendor signup → FillProfile submit → row inserted, status='pending'.
--
-- 6. NEGATIVE — should reject. Run as a vendor session (anon key + signed-in
--    JWT) via the REST API, or simulate in SQL Editor:
--
--    a. Self-promotion (vendor with status='pending'):
--         UPDATE vendors SET status='active' WHERE email='vendor@test.com';
--       Expect ERROR: Vendor cannot change status from pending to active.
--
--    b. Email change:
--         UPDATE vendors SET email='hacker@evil.com' WHERE email='vendor@test.com';
--       Expect ERROR: Vendor email is immutable.
--
--    c. Other-vendor mutation:
--         UPDATE vendors SET name='Hacked' WHERE email='other@vendor.com';
--       Expect: 0 rows affected (RLS silently filters).
--
--    d. Self-delete:
--         DELETE FROM vendors WHERE email='vendor@test.com';
--       Expect: 0 rows affected (no policy = default deny).
--
--    e. Forbidden transition (active → rejected/suspended):
--         UPDATE vendors SET status='suspended' WHERE email='vendor@test.com';
--       Expect ERROR: Vendor cannot change status from active to suspended.
--
-- 7. SERVICE-ROLE BYPASS — using the service_role key (admin portal):
--      UPDATE vendors SET status='active' WHERE status='pending';
--    Expect: succeeds. Trigger bypassed via request.jwt.claim.role='service_role'.
--    NOTE: This bypass only fires for PostgREST-mediated calls. Direct psql
--    sessions don't set the GUC; use `SET LOCAL session_replication_role =
--    'replica';` or a SECURITY DEFINER RPC if you need to suppress the trigger
--    from a non-PostgREST context.
