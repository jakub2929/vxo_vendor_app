ALTER TABLE vendor_profiles
ADD COLUMN IF NOT EXISTS radius_miles integer DEFAULT 25;
