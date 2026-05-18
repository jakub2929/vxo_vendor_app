-- Additive extensions to the invoices table for vendor-initiated invoicing.
--
-- Baseline definition lives in supabase/migrations/001_alfred_tables_DEV_ONLY.sql
-- (the user's local reconstruction of Ryan's eventual schema). This file is
-- explicitly separate so the dev-only baseline stays a clean "as-Ryan-said-it"
-- snapshot, and our additions can be reviewed / ported as a single unit.
--
-- Scope of this file:
--   1. ALTER invoices: add engagement timestamps (sent_at, viewed_at, paid_at,
--      overdue_at) and expand the status CHECK to a union of the original
--      Ryan-semantics values + our additions. Backfill sent_at for existing
--      rows whose status implies they've already been sent.
--   2. CREATE invoice_items: normalized line items (alongside the legacy
--      invoices.line_items JSONB which we leave in place for backward compat
--      with mock fixtures). New code reads/writes invoice_items.
--   3. RLS on invoice_items mirroring the existing vendor_invoices policy
--      pattern (parent-join through invoices → jobs → assigned_vendor_id).
--   4. send_invoice RPC: atomic insert of invoice + line items, returns the
--      invoice row. Uses current_vendor_id() helper from
--      add-job-transition-rpcs.sql.
--
-- When Ryan ships his official invoices schema, reconcile by porting these
-- additions into his structure or coordinating new RPC signatures. Likely
-- touch points: column names (total vs total_amount), engagement-timestamp
-- presence, whether his model normalizes line items or keeps them JSONB.
--
-- Apply via Supabase Studio SQL Editor against dev DB. Idempotent.

-- =============================================================================
-- 1. ALTER invoices — engagement timestamps + expanded status enum
-- =============================================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at    TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at  TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at    TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overdue_at TIMESTAMPTZ;

-- Expand status CHECK to the 8-value union. The original 5 are kept so
-- existing rows + mock fixtures pass the new constraint, and Ryan's
-- semantics ('approved' = client viewed + accepted, 'rejected' = client
-- declined) survive. Our additions: 'viewed', 'overdue', 'cancelled'.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (
  status IN (
    'draft', 'sent', 'approved', 'viewed',
    'paid', 'overdue', 'rejected', 'cancelled'
  )
);

-- Backfill sent_at for rows that imply the invoice has already been sent
-- to the client. Idempotent: NULL-guarded, won't re-stamp.
UPDATE invoices
   SET sent_at = updated_at
 WHERE status IN ('sent', 'approved', 'paid', 'rejected')
   AND sent_at IS NULL;

-- =============================================================================
-- 2. CREATE invoice_items — normalized line items
-- =============================================================================
-- New code (send_invoice RPC, timeline read path) uses this table.
-- invoices.line_items JSONB is left in place for backward compat with
-- mockInvoices.ts fixtures — vendor-initiated inserts go here.

CREATE TABLE IF NOT EXISTS invoice_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
  ON invoice_items(invoice_id, sort_order);

-- =============================================================================
-- 3. RLS on invoice_items
-- =============================================================================
-- Parent-join pattern matching the existing vendor_invoices policy in
-- 003_rls_policies.sql: invoice → job → assigned_vendor_id → vendor.email.
-- SECURITY DEFINER RPC bypasses RLS but enforces its own auth, so this
-- policy only affects direct table reads (e.g. the timeline fetch).

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_invoice_items" ON invoice_items;
CREATE POLICY "vendor_invoice_items" ON invoice_items
  FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices
       WHERE job_id IN (
         SELECT id FROM jobs
          WHERE assigned_vendor_id = (
            SELECT id FROM vendors WHERE email = auth.jwt() ->> 'email'
          )
       )
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices
       WHERE job_id IN (
         SELECT id FROM jobs
          WHERE assigned_vendor_id = (
            SELECT id FROM vendors WHERE email = auth.jwt() ->> 'email'
          )
       )
    )
  );

-- =============================================================================
-- 4. send_invoice(p_job_id, p_items, p_notes) — atomic insert
-- =============================================================================
-- p_items is a JSONB array of {description, amount} objects. Sort order
-- equals array index. Total is computed server-side from the items so the
-- client can't lie about it.
--
-- Status is hard-coded to 'sent'. No 'draft' path from this RPC — drafts
-- live entirely in client-side state during the builder UX.
--
-- SECURITY DEFINER + locked search_path + own auth check via
-- current_vendor_id() (defined in add-job-transition-rpcs.sql).

CREATE OR REPLACE FUNCTION public.send_invoice(
  p_job_id UUID,
  p_items  JSONB,
  p_notes  TEXT DEFAULT NULL
)
RETURNS SETOF public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id  UUID := public.current_vendor_id();
  v_invoice_id UUID;
  v_total      NUMERIC(10,2);
  v_item       JSONB;
  v_count      INT;
  v_idx        INT;
BEGIN
  -- Vendor must own the job.
  IF NOT EXISTS (
    SELECT 1 FROM jobs
     WHERE id = p_job_id AND assigned_vendor_id = v_vendor_id
  ) THEN
    RAISE EXCEPTION 'Job not found or not assigned to this vendor'
      USING ERRCODE = 'P0002';
  END IF;

  -- At least one item required.
  IF p_items IS NULL THEN
    RAISE EXCEPTION 'p_items is required' USING ERRCODE = '22023';
  END IF;

  v_count := jsonb_array_length(p_items);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one item'
      USING ERRCODE = '22023';
  END IF;

  -- Sum total from item amounts. SUM is NULL if any amount is missing —
  -- COALESCE to 0 so the CHECK constraint below still triggers, and the
  -- per-row insert below will RAISE its own error for the bad row.
  SELECT COALESCE(SUM((item ->> 'amount')::NUMERIC), 0)
    INTO v_total
    FROM jsonb_array_elements(p_items) AS item;

  -- Defensive: should be impossible via the per-item amount >= 0 check
  -- below, but keep the guard so corrupt input fails loudly.
  IF v_total < 0 THEN
    RAISE EXCEPTION 'Total amount cannot be negative'
      USING ERRCODE = '22023';
  END IF;

  -- Insert the invoice row using the existing column shape. kind defaults
  -- to 'invoice'; we set it explicitly for readability.
  INSERT INTO invoices (
    job_id, vendor_id, kind, total, notes, status, sent_at
  ) VALUES (
    p_job_id, v_vendor_id, 'invoice', v_total, p_notes, 'sent', NOW()
  )
  RETURNING id INTO v_invoice_id;

  -- Insert each line item. sort_order = array index so the client can
  -- preserve the user's original ordering.
  FOR v_idx IN 0..v_count - 1 LOOP
    v_item := p_items -> v_idx;

    IF v_item ->> 'description' IS NULL
       OR length(trim(v_item ->> 'description')) = 0 THEN
      RAISE EXCEPTION 'Item % is missing a description', v_idx
        USING ERRCODE = '22023';
    END IF;

    IF v_item ->> 'amount' IS NULL THEN
      RAISE EXCEPTION 'Item % is missing an amount', v_idx
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO invoice_items (
      invoice_id, description, amount, sort_order
    ) VALUES (
      v_invoice_id,
      trim(v_item ->> 'description'),
      (v_item ->> 'amount')::NUMERIC,
      v_idx
    );
  END LOOP;

  RETURN QUERY SELECT * FROM invoices WHERE id = v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_invoice(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_invoice(UUID, JSONB, TEXT) TO authenticated;

-- =============================================================================
-- Smoke tests (manual, run after apply)
-- =============================================================================
-- 1. Confirm the new columns landed:
--    \d invoices
--    -- expect sent_at, viewed_at, paid_at, overdue_at TIMESTAMPTZ
--
-- 2. Confirm expanded status enum:
--    SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname = 'invoices_status_check';
--    -- expect 8-value IN list
--
-- 3. Backfill effect:
--    SELECT status, count(*) FILTER (WHERE sent_at IS NULL) AS nulls
--    FROM invoices GROUP BY status;
--    -- expect 0 nulls in status IN ('sent','approved','paid','rejected')
--
-- 4. Auth-guard smoke from Studio SQL Editor (no JWT):
--    SELECT * FROM send_invoice(
--      'a1234567-0000-4000-8000-000000000005',
--      '[{"description":"Labor","amount":100}]'::jsonb,
--      NULL
--    );
--    -- expect: ERROR: Not authenticated (proves wiring)
