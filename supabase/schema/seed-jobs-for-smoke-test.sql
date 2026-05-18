-- Seed jobs + job_messages for vendor app real-Supabase smoke test.
--
-- Apply via Supabase Studio SQL Editor against the dev DB.
-- Idempotent: re-running produces no duplicates (ON CONFLICT (id) DO NOTHING
-- on both tables, all IDs deterministic).
--
-- All rows assigned to a single test vendor. Update test_vendor_id below if
-- your dev vendor UUID has changed.
--
-- Schema reference (supabase/migrations/001_alfred_tables_DEV_ONLY.sql):
--   jobs.status enum:
--     new, dispatched, accepted, en_route, on_site,
--     complete, invoiced, paid, closed, cancelled
--   jobs scheduling columns: eta_label TEXT, eta_datetime TIMESTAMPTZ
--     (NB: no sla_hours / scheduled_at columns exist)
--   job_messages.sender enum: client, vendor, admin, alfred, system
--
-- Locations anchored around Springfield, IL (~39.78N, -89.65W) per the
-- selected hardware test region. Spread 1-45mi from anchor to exercise the
-- distance UI's expected range.

DO $$
DECLARE
  test_vendor_id UUID := '79ea38f3-7ea9-4547-94c6-9471df984dce';
BEGIN

  -- =========================================================================
  -- jobs
  -- =========================================================================
  -- 10 jobs covering every status value. 8 should be visible in the Jobs list
  -- (closed + cancelled are filtered by useJobsList).

  -- 1. new — plumbing — tomorrow — Springfield
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name, client_email,
    eta_label, eta_datetime, description, created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-000000000001',
    test_vendor_id,
    'plumbing', 'new', 'standard',
    '742 Evergreen Terrace, Springfield, IL 62704', '62704',
    39.7817, -89.6501,
    'Sarah Mitchell', 'sarah.mitchell@example.com',
    'Tomorrow 9-11 AM', NOW() + INTERVAL '1 day',
    'Kitchen sink leaking under cabinet. Slow drip onto stored items.',
    NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes'
  ) ON CONFLICT (id) DO NOTHING;

  -- 2. dispatched — electrical — today — Chatham (~10mi S)
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name,
    eta_label, eta_datetime, description, created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-000000000002',
    test_vendor_id,
    'electrical', 'dispatched', 'priority',
    '218 Mulberry Ln, Chatham, IL 62629', '62629',
    39.6753, -89.7011,
    'Michael Reyes',
    'Today 2-4 PM', NOW() + INTERVAL '3 hours',
    'Two outlets on living room wall stopped working after storm.',
    NOW() - INTERVAL '1 hour', NOW() - INTERVAL '15 minutes'
  ) ON CONFLICT (id) DO NOTHING;

  -- 3. accepted — HVAC — tomorrow — Sherman (~7mi N)
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name,
    eta_label, eta_datetime, description, created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-000000000003',
    test_vendor_id,
    'HVAC', 'accepted', 'standard',
    '54 Orchard Pl, Sherman, IL 62684', '62684',
    39.8917, -89.6042,
    'Jennifer Okafor',
    'Tomorrow 1-3 PM', NOW() + INTERVAL '1 day 4 hours',
    'AC unit running but blowing warm air. Filter is clean.',
    NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours'
  ) ON CONFLICT (id) DO NOTHING;

  -- 4. en_route — plumbing — today — Riverton (~6mi E)
  -- This job has the richest seeded chat (see job_messages below).
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name,
    eta_label, eta_datetime, description, checkin_time,
    created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-000000000004',
    test_vendor_id,
    'plumbing', 'en_route', 'emergency',
    '1130 Park Ave, Riverton, IL 62561', '62561',
    39.8439, -89.5320,
    'David Park',
    'Today 2-4 PM', NOW() + INTERVAL '45 minutes',
    'Burst pipe under bathroom sink. Water shut off at main. Urgent.',
    NULL,
    NOW() - INTERVAL '2 hours', NOW() - INTERVAL '5 minutes'
  ) ON CONFLICT (id) DO NOTHING;

  -- 5. on_site — handyman — today — Springfield (close to anchor)
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name,
    eta_label, eta_datetime, description, checkin_time,
    created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-000000000005',
    test_vendor_id,
    'handyman', 'on_site', 'standard',
    '88 Lakeshore Dr, Springfield, IL 62711', '62711',
    39.7563, -89.7180,
    'Lisa Tanaka',
    'Today 10 AM', NOW() - INTERVAL '1 hour',
    'Replace 3 interior door knobs, patch drywall hole in hallway.',
    NOW() - INTERVAL '40 minutes',
    NOW() - INTERVAL '6 hours', NOW() - INTERVAL '40 minutes'
  ) ON CONFLICT (id) DO NOTHING;

  -- 6. complete — electrical — yesterday — Pawnee (~17mi S)
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name,
    eta_label, eta_datetime, description,
    checkin_time, checkout_time,
    created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-000000000006',
    test_vendor_id,
    'electrical', 'complete', 'standard',
    '14 Oak Hollow Rd, Pawnee, IL 62558', '62558',
    39.5950, -89.5803,
    'Robert Hsu',
    'Yesterday 11 AM', NOW() - INTERVAL '1 day 3 hours',
    'Install new ceiling fan in master bedroom, replace old fixture.',
    NOW() - INTERVAL '1 day 3 hours', NOW() - INTERVAL '1 day 1 hour',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day 1 hour'
  ) ON CONFLICT (id) DO NOTHING;

  -- 7. invoiced — snow_removal — last week — Lincoln (~30mi NE)
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name,
    eta_label, eta_datetime, description,
    checkin_time, checkout_time,
    created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-000000000007',
    test_vendor_id,
    'snow_removal', 'invoiced', 'priority',
    '305 W Pekin St, Lincoln, IL 62656', '62656',
    40.1486, -89.3648,
    'Emily Wojcik',
    'Last Tuesday', NOW() - INTERVAL '6 days',
    'Driveway + walkway clearing after overnight storm. ~150 ft total.',
    NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '90 minutes',
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- 8. paid — HVAC — last week — Jacksonville (~35mi W)
  -- "paid" = the "Completed / Payment received" terminal state shown grey in Figma.
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name,
    eta_label, eta_datetime, description,
    checkin_time, checkout_time,
    created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-000000000008',
    test_vendor_id,
    'HVAC', 'paid', 'standard',
    '622 N Diamond St, Jacksonville, IL 62650', '62650',
    39.7339, -90.2290,
    'Thomas Bianchi',
    'Last Friday', NOW() - INTERVAL '5 days',
    'Annual furnace inspection + filter swap.',
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '50 minutes',
    NOW() - INTERVAL '8 days', NOW() - INTERVAL '4 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- 9. closed — handyman — old — Decatur (~40mi E)
  -- Should NOT appear in the Jobs list (filtered by useJobsList).
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name,
    eta_label, eta_datetime, description,
    checkin_time, checkout_time,
    created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-000000000009',
    test_vendor_id,
    'handyman', 'closed', 'standard',
    '2410 N Water St, Decatur, IL 62526', '62526',
    39.8403, -88.9548,
    'Patricia Ndlovu',
    'Two weeks ago', NOW() - INTERVAL '14 days',
    'Mount 4 floating shelves in home office.',
    NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days' + INTERVAL '2 hours',
    NOW() - INTERVAL '20 days', NOW() - INTERVAL '13 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- 10. cancelled — plumbing — old — Springfield
  -- Should NOT appear in the Jobs list (filtered by useJobsList).
  INSERT INTO jobs (
    id, assigned_vendor_id, trade, status, urgency, address, zip_code,
    location_lat, location_lng, client_name,
    eta_label, eta_datetime, description,
    created_at, updated_at
  ) VALUES (
    'a1234567-0000-4000-8000-00000000000a',
    test_vendor_id,
    'plumbing', 'cancelled', 'standard',
    '901 S 6th St, Springfield, IL 62703', '62703',
    39.7903, -89.6443,
    'James Halverson',
    'Cancelled', NULL,
    'Water heater replacement — client rescheduled with another vendor.',
    NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'
  ) ON CONFLICT (id) DO NOTHING;

  -- =========================================================================
  -- job_messages
  -- =========================================================================
  -- Deterministic IDs prefixed `b...` so re-running the seed is a no-op.
  -- Jobs 1, 5, 10 are intentionally left without messages to exercise the
  -- empty-chat state.

  -- Job 4 (en_route, emergency plumbing) — richest thread, 4 messages
  INSERT INTO job_messages (id, job_id, sender, content, created_at) VALUES
    ('b1234567-0000-4000-8000-000000000401',
     'a1234567-0000-4000-8000-000000000004',
     'alfred',
     'New emergency job assigned. Client has water shut off at main — they need you on site ASAP.',
     NOW() - INTERVAL '2 hours'),
    ('b1234567-0000-4000-8000-000000000402',
     'a1234567-0000-4000-8000-000000000004',
     'vendor',
     'On my way. ETA 25 min.',
     NOW() - INTERVAL '30 minutes'),
    ('b1234567-0000-4000-8000-000000000403',
     'a1234567-0000-4000-8000-000000000004',
     'alfred',
     'Client confirmed they''re home and will meet you at the side door.',
     NOW() - INTERVAL '20 minutes'),
    ('b1234567-0000-4000-8000-000000000404',
     'a1234567-0000-4000-8000-000000000004',
     'client',
     'Thanks — the leak is in the cabinet under the upstairs bathroom sink.',
     NOW() - INTERVAL '10 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- Job 2 (dispatched, electrical) — 2 messages
  INSERT INTO job_messages (id, job_id, sender, content, created_at) VALUES
    ('b1234567-0000-4000-8000-000000000201',
     'a1234567-0000-4000-8000-000000000002',
     'alfred',
     'Job dispatched. Client expects you between 2-4 PM.',
     NOW() - INTERVAL '1 hour'),
    ('b1234567-0000-4000-8000-000000000202',
     'a1234567-0000-4000-8000-000000000002',
     'vendor',
     'Acknowledged. Will confirm 30 min before arrival.',
     NOW() - INTERVAL '50 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- Job 3 (accepted, HVAC) — 2 messages
  INSERT INTO job_messages (id, job_id, sender, content, created_at) VALUES
    ('b1234567-0000-4000-8000-000000000301',
     'a1234567-0000-4000-8000-000000000003',
     'alfred',
     'Job accepted. Scheduled for tomorrow 1-3 PM.',
     NOW() - INTERVAL '3 hours'),
    ('b1234567-0000-4000-8000-000000000302',
     'a1234567-0000-4000-8000-000000000003',
     'vendor',
     'Got it. Any history on the unit — model or last service date?',
     NOW() - INTERVAL '2 hours 30 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- Job 6 (complete, electrical) — 3 messages including a wrap-up
  INSERT INTO job_messages (id, job_id, sender, content, created_at) VALUES
    ('b1234567-0000-4000-8000-000000000601',
     'a1234567-0000-4000-8000-000000000006',
     'alfred',
     'Job assigned. Standard urgency.',
     NOW() - INTERVAL '3 days'),
    ('b1234567-0000-4000-8000-000000000602',
     'a1234567-0000-4000-8000-000000000006',
     'vendor',
     'Done. Ceiling fan installed, old fixture removed and bagged.',
     NOW() - INTERVAL '1 day 1 hour'),
    ('b1234567-0000-4000-8000-000000000603',
     'a1234567-0000-4000-8000-000000000006',
     'alfred',
     'Thanks — please submit your invoice when ready.',
     NOW() - INTERVAL '1 day 30 minutes')
  ON CONFLICT (id) DO NOTHING;

  -- Job 8 (paid) — terminal state, 2 messages
  INSERT INTO job_messages (id, job_id, sender, content, created_at) VALUES
    ('b1234567-0000-4000-8000-000000000801',
     'a1234567-0000-4000-8000-000000000008',
     'vendor',
     'Furnace inspection complete, filter replaced. Invoice attached.',
     NOW() - INTERVAL '5 days' + INTERVAL '50 minutes'),
    ('b1234567-0000-4000-8000-000000000802',
     'a1234567-0000-4000-8000-000000000008',
     'alfred',
     'Payment processed. Thanks!',
     NOW() - INTERVAL '4 days')
  ON CONFLICT (id) DO NOTHING;

END $$;

-- =============================================================================
-- Sanity queries — run these manually after applying the seed.
-- =============================================================================
-- SELECT count(*) FROM jobs
--   WHERE assigned_vendor_id = '79ea38f3-7ea9-4547-94c6-9471df984dce';
-- -- Expected: 10
--
-- SELECT status, count(*) FROM jobs
--   WHERE assigned_vendor_id = '79ea38f3-7ea9-4547-94c6-9471df984dce'
--   GROUP BY status ORDER BY status;
-- -- Expected: 1 each of new, dispatched, accepted, en_route, on_site,
-- --           complete, invoiced, paid, closed, cancelled
--
-- SELECT count(*) FROM job_messages
--   WHERE job_id IN (
--     SELECT id FROM jobs
--     WHERE assigned_vendor_id = '79ea38f3-7ea9-4547-94c6-9471df984dce'
--   );
-- -- Expected: 13 (4 + 2 + 2 + 3 + 2)
