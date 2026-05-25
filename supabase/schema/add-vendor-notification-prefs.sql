-- Phase 4: Notification preferences for vendors.
--
-- Adds a JSONB column with default-ON for every push event the vendor app
-- currently emits. Read by the backend before delivering a push; in-app
-- Realtime toasts (Toast.tsx, useInvoicesRealtime, useVendorStatusToast) are
-- unaffected — those fire from the same Supabase Realtime stream regardless
-- of these toggles.
--
-- Apply order: AFTER the baseline 001_alfred_tables_DEV_ONLY.sql.
-- Dependencies: none beyond the baseline vendors table.
-- Idempotent: ADD COLUMN IF NOT EXISTS — safe to re-run.
-- Rollback: ALTER TABLE vendors DROP COLUMN notification_prefs;
-- Status: STAGED FOR DEV/PROD APPLY

BEGIN;

ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{
  "new_job": true,
  "client_message": true,
  "invoice_paid": true,
  "quote_accepted": true,
  "invoice_overdue": true,
  "account_status": true
}'::jsonb;

COMMENT ON COLUMN vendors.notification_prefs IS
  'JSONB toggles per push notification event type. Backend reads this before sending a push. In-app Realtime toasts are unaffected.';

COMMIT;

-- Verify (run separately in Studio):
--   SELECT id, email, notification_prefs FROM vendors LIMIT 5;
-- Existing rows pick up the DEFAULT via the column add; all six keys
-- should read `true` until a vendor toggles one off.
