ALTER TABLE vendor_requests
ADD COLUMN IF NOT EXISTS completion_photo_ids text[];
