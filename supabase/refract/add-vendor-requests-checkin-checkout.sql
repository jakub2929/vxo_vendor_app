ALTER TABLE vendor_requests
ADD COLUMN IF NOT EXISTS checkin_time timestamptz,
ADD COLUMN IF NOT EXISTS checkout_time timestamptz;
