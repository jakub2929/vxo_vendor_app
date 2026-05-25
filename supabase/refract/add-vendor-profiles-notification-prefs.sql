ALTER TABLE vendor_profiles
ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
  "new_job": true,
  "client_message": true,
  "invoice_paid": true,
  "quote_accepted": true,
  "invoice_overdue": true,
  "account_status": true
}'::jsonb;
