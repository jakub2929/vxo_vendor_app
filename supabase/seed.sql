-- Dev seed data. Run manually after schema is set up.
-- Requires: an auth user already created via Supabase Auth dashboard
-- with the matching email below.

INSERT INTO vendors (email, name, business, phone, trades, zip_code, radius_miles, status)
VALUES (
  'test-vendor@example.com',
  'Test Vendor',
  'Test HVAC LLC',
  '+1-555-0100',
  '["hvac"]'::jsonb,
  '22202',
  25,
  'active'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO jobs (
  trade, status, description, urgency, address, zip_code,
  location_lat, location_lng, client_name, assigned_vendor_id, dispatch_fee
) VALUES (
  'hvac',
  'dispatched',
  'AC unit not cooling on rooftop unit #2',
  'priority',
  '1100 S Hayes St, Arlington, VA 22202',
  '22202',
  38.8628,
  -77.0586,
  'Lacoste',
  (SELECT id FROM vendors WHERE email = 'test-vendor@example.com'),
  75.00
);