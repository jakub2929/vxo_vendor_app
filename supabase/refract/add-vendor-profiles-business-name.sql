ALTER TABLE vendor_profiles
ADD COLUMN IF NOT EXISTS business_name text;

COMMENT ON COLUMN vendor_profiles.business_name IS
  'Vendor business display name. Replaces service_area workaround.';
