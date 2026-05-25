ALTER TABLE vendor_profiles
ADD COLUMN IF NOT EXISTS insured boolean DEFAULT false;
