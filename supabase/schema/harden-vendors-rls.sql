-- Phase 2.5 hardening: tighten vendors RLS
-- Drops the FOR ALL policy and replaces with granular per-action policies.
-- Vendor can:
--   - SELECT own row
--   - INSERT own row only during onboarding (status='pending')
--   - UPDATE own row but cannot change status EXCEPT active <-> out_of_office
-- Vendor cannot:
--   - DELETE (no policy means default deny)
--   - Change status to anything other than the legitimate OOO toggle pair
--   - Modify other vendor rows
--
-- Source of truth for prod: this file is candidate SQL under supabase/schema/.
-- Ryan applies via Supabase Studio SQL Editor (see PROD MIGRATION CHECKLIST
-- at the bottom of this file). Not added to supabase/migrations/ — that
-- directory is Ryan's prod source-of-truth and is owned by him.
--
-- !! REVIEW NOTE — RLS WITH CHECK self-referential subquery shadow bug !!
-- The (SELECT col FROM vendors WHERE id = vendors.id) pattern below is the
-- form the audit prescribed. PostgreSQL's name resolution shadows the outer
-- `vendors` reference with the inner FROM alias of the same name, so the
-- inner `vendors.id` resolves to the subquery's own row, not the row being
-- checked. The predicate degrades to `WHERE id = id` (tautology) and the
-- subquery returns every vendor's value, weakening the intended constraint.
--   - email immutability is still enforced indirectly: USING + WITH CHECK
--     both pin email = auth.jwt()->>'email', so NEW.email must equal OLD.email
--     (both equal the caller's JWT email). The subquery line is redundant.
--   - status pinning, however, is the actual control we want, and the broken
--     subquery undermines it. Before applying to dev, recommend either:
--       (a) alias the subquery: `(SELECT v.status FROM vendors v WHERE
--           v.email = auth.jwt()->>'email')`, OR
--       (b) move the status-transition rule to a BEFORE UPDATE trigger
--           comparing OLD.status / NEW.status (cleaner, no RLS subquery
--           recursion concerns).
-- Ship-as-specified preserved here for unambiguous review; do NOT apply on
-- dev until this is resolved.

BEGIN;

DROP POLICY IF EXISTS vendor_own ON vendors;

-- SELECT: vendor reads own row
CREATE POLICY vendor_select_own ON vendors
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt()->>'email');

-- INSERT: vendor onboarding (one-time, status must be 'pending')
CREATE POLICY vendor_insert_own ON vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    email = auth.jwt()->>'email'
    AND status = 'pending'
  );

-- UPDATE: vendor edits profile fields; status restricted to OOO toggle only
CREATE POLICY vendor_update_own ON vendors
  FOR UPDATE
  TO authenticated
  USING (email = auth.jwt()->>'email')
  WITH CHECK (
    email = auth.jwt()->>'email'
    -- Email immutable
    AND email = (SELECT email FROM vendors WHERE id = vendors.id)
    -- Status: either unchanged, OR within the active <-> out_of_office pair
    AND (
      status = (SELECT status FROM vendors WHERE id = vendors.id)
      OR (
        (SELECT status FROM vendors WHERE id = vendors.id) IN ('active', 'out_of_office')
        AND status IN ('active', 'out_of_office')
      )
    )
  );

-- No DELETE policy = default deny.

COMMIT;

-- ============================================================================
-- PROD MIGRATION CHECKLIST (for Ryan)
-- ============================================================================
-- 1. Confirm pre-state:
--      SELECT polname, polcmd, polqual, polwithcheck
--      FROM pg_policy
--      WHERE polrelid = 'public.vendors'::regclass;
--    Expect: one row, polname='vendor_own', polcmd='*' (FOR ALL),
--    polwithcheck IS NULL.
--
-- 2. Apply this file via Supabase Studio SQL Editor.
--
-- 3. Confirm post-state:
--      SELECT polname, polcmd FROM pg_policy
--      WHERE polrelid = 'public.vendors'::regclass
--      ORDER BY polname;
--    Expect three rows:
--      vendor_insert_own (r)  -- FOR INSERT
--      vendor_select_own (r)  -- FOR SELECT
--      vendor_update_own (w)  -- FOR UPDATE
--    polcmd letters: r=SELECT, a=INSERT, w=UPDATE, d=DELETE, *=ALL.
--    Confirm: no policy for DELETE → default-deny applies.
--
-- 4. Smoke test in the app: Profile save (no status change), OOO ON, OOO OFF.
--    All three must continue to work end-to-end as authenticated vendor.
--
-- 5. Rollback (if needed):
--      BEGIN;
--      DROP POLICY IF EXISTS vendor_select_own ON vendors;
--      DROP POLICY IF EXISTS vendor_insert_own ON vendors;
--      DROP POLICY IF EXISTS vendor_update_own ON vendors;
--      CREATE POLICY vendor_own ON vendors FOR ALL
--        USING (email = auth.jwt()->>'email');
--      COMMIT;
