-- Phase 5 hotfix: vendor availability toggle (Phase 2 OOO feature)
--
-- Adds availability_status column to track OOO state.
-- This is separate from profiles.status which tracks approval lifecycle
-- (pending → approved → suspended). Splitting these resolves the live
-- 42703 surfaced by hardware test against the schema mirror:
--   "Could not find the 'status' column of 'vendor_profiles'".
--
-- Apply order: AFTER Ryan's baseline vendor_profiles
-- Status: STAGED FOR PROD APPLY (Ryan notified 2026-05-21)
-- Rollback: ALTER TABLE vendor_profiles DROP COLUMN availability_status;

ALTER TABLE vendor_profiles
ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'active'
CHECK (availability_status IN ('active', 'out_of_office'));

COMMENT ON COLUMN vendor_profiles.availability_status IS
  'Vendor self-toggled availability. Active = receiving dispatches. Out_of_office = paused.';
