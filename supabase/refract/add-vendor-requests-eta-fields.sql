ALTER TABLE vendor_requests
ADD COLUMN IF NOT EXISTS eta_label text,
ADD COLUMN IF NOT EXISTS eta_datetime timestamptz;
