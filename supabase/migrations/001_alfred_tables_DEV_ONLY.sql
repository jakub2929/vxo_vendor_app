-- ⚠️  DEV-ONLY SCHEMA — DO NOT RUN ON PRODUCTION
--
-- Reconstructed from Ryan's email + API Reference doc.
-- Will be replaced entirely when the official schema arrives.
-- See supabase/migrations/README.md for the replacement workflow.

-- Ensure uuid generator is available (dev-only safe CREATE EXTENSION)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigger helper to set updated_at
CREATE OR REPLACE FUNCTION vxo_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  business TEXT,
  trades JSONB DEFAULT '[]'::jsonb,
  zip_code TEXT,
  radius_miles INTEGER DEFAULT 25,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'out_of_office')),
  insured BOOLEAN DEFAULT false,
  pay_preference TEXT,
  dispatch_fee NUMERIC(10,2),
  stripe_account_id TEXT,
  expo_push_token TEXT,
  rating NUMERIC(3,2),
  bio TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- jobs table
-- Note: location_lat / location_lng are dev-only assumptions pending Ryan confirmation
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','dispatched','accepted','en_route','on_site','complete','invoiced','paid','closed','cancelled')),
  description TEXT,
  urgency TEXT CHECK (urgency IN ('standard','priority','emergency')),
  address TEXT NOT NULL,
  zip_code TEXT,
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(10,7),
  client_name TEXT,
  client_email TEXT,
  assigned_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  pm_id UUID,
  checkin_time TIMESTAMPTZ,
  checkout_time TIMESTAMPTZ,
  eta_label TEXT,
  eta_datetime TIMESTAMPTZ,
  completion_photo_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  dispatch_fee NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- job_messages
CREATE TABLE IF NOT EXISTS job_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('client','vendor','admin','alfred','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- invoices
-- Note: `kind` and some columns are dev-only assumptions for distinguishing quotes/invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice','quote')),
  labor NUMERIC(10,2),
  parts NUMERIC(10,2),
  diagnostic_fee NUMERIC(10,2),
  total NUMERIC(10,2),
  line_items JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','paid','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- dispatch_log (dev assumption: log responses to dispatch)
CREATE TABLE IF NOT EXISTS dispatch_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('offered','accepted','declined','timed_out')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendors_email ON vendors(email);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_vendor ON jobs(assigned_vendor_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_messages_job_created ON job_messages(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor_status ON invoices(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_vendor_created ON dispatch_log(vendor_id, created_at);

-- updated_at triggers
DROP TRIGGER IF EXISTS set_updated_at_vendors ON vendors;
CREATE TRIGGER set_updated_at_vendors
BEFORE UPDATE ON vendors
FOR EACH ROW
EXECUTE FUNCTION vxo_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_jobs ON jobs;
CREATE TRIGGER set_updated_at_jobs
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION vxo_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_invoices ON invoices;
CREATE TRIGGER set_updated_at_invoices
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION vxo_set_updated_at();
