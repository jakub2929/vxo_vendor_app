-- RLS policies — these policies are intended to survive schema replacement.
-- They only depend on tables existing (not how they were created).

-- vendors: own row only
ALTER TABLE IF EXISTS vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendor_own" ON vendors;
CREATE POLICY "vendor_own" ON vendors FOR ALL
  USING (email = auth.jwt()->>'email');

-- jobs: only assigned jobs (SELECT)
ALTER TABLE IF EXISTS jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendor_jobs_select" ON jobs;
CREATE POLICY "vendor_jobs_select" ON jobs FOR SELECT USING (
  assigned_vendor_id = (SELECT id FROM vendors WHERE email = auth.jwt()->>'email')
);

-- jobs: vendor can update own jobs (status transitions)
DROP POLICY IF EXISTS "vendor_jobs_update" ON jobs;
CREATE POLICY "vendor_jobs_update" ON jobs FOR UPDATE USING (
  assigned_vendor_id = (SELECT id FROM vendors WHERE email = auth.jwt()->>'email')
);

-- job_messages: only for own jobs
ALTER TABLE IF EXISTS job_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendor_messages" ON job_messages;
CREATE POLICY "vendor_messages" ON job_messages FOR ALL USING (
  job_id IN (SELECT id FROM jobs WHERE assigned_vendor_id = (
    SELECT id FROM vendors WHERE email = auth.jwt()->>'email'
  ))
);

-- invoices: only for own jobs
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendor_invoices" ON invoices;
CREATE POLICY "vendor_invoices" ON invoices FOR ALL USING (
  job_id IN (SELECT id FROM jobs WHERE assigned_vendor_id = (
    SELECT id FROM vendors WHERE email = auth.jwt()->>'email'
  ))
);
