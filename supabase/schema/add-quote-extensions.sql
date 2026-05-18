-- Quote feature extensions to the invoices table.
--
-- Quotes are not a separate table — they live in `invoices` with kind='quote'.
-- This file adds the only thing missing from the invoice extensions to
-- support quote semantics: a `valid_until` expiry timestamp plus two new
-- status enum values ('accepted' for client-side approval of a quote,
-- 'expired' for auto-aged-out quotes).
--
-- Baseline definition is in supabase/migrations/001_alfred_tables_DEV_ONLY.sql.
-- Layered on top of supabase/schema/add-invoice-extensions.sql (engagement
-- timestamps + invoice_items table + send_invoice RPC + current_vendor_id).
--
-- When Ryan ships his official invoices schema, reconcile by porting these
-- additions into his structure or coordinating new RPC signatures. Likely
-- touch points: whether his model treats quotes vs invoices as distinct
-- types, whether valid_until belongs on a separate quotes table, and how
-- 'accepted' relates to his 'approved' state.
--
-- Apply via Supabase Studio SQL Editor. Idempotent.

-- =============================================================================
-- 1. ALTER invoices — add valid_until + expand status enum
-- =============================================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

-- Expand status CHECK to the 10-value union. Earlier values preserved
-- (from add-invoice-extensions.sql + DEV_ONLY baseline) so existing rows
-- continue to pass. New: 'accepted' (client approved a quote — distinct
-- from 'approved' which Ryan uses for invoice client-side approval) and
-- 'expired' (quote past valid_until).
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (
  status IN (
    'draft', 'sent', 'viewed', 'approved', 'accepted',
    'paid', 'overdue', 'rejected', 'cancelled', 'expired'
  )
);

-- =============================================================================
-- 2. send_quote(p_job_id, p_items, p_notes, p_expires_in_days) — atomic insert
-- =============================================================================
-- Mirrors send_invoice (add-invoice-extensions.sql) but writes kind='quote'
-- and optionally stamps valid_until from a relative day offset.
--
-- p_expires_in_days conventions:
--   0   → no expiry (valid_until = NULL)
--   1..365 → valid_until = NOW() + days
--   default 7
--   negative or > 365 → RAISE (defensive — the client should clamp, but
--     server enforces the sanity bound regardless)
--
-- SECURITY DEFINER + locked search_path + own auth via current_vendor_id().

CREATE OR REPLACE FUNCTION public.send_quote(
  p_job_id          UUID,
  p_items           JSONB,
  p_notes           TEXT DEFAULT NULL,
  p_expires_in_days INT  DEFAULT 7
)
RETURNS SETOF public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id  UUID := public.current_vendor_id();
  v_quote_id   UUID;
  v_total      NUMERIC(10,2);
  v_item       JSONB;
  v_expires_at TIMESTAMPTZ;
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

  -- Items array required + non-empty.
  IF p_items IS NULL THEN
    RAISE EXCEPTION 'p_items is required' USING ERRCODE = '22023';
  END IF;

  v_count := jsonb_array_length(p_items);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Quote must have at least one item'
      USING ERRCODE = '22023';
  END IF;

  -- Expiry bound (defensive — client should also clamp).
  IF p_expires_in_days < 0 OR p_expires_in_days > 365 THEN
    RAISE EXCEPTION 'p_expires_in_days must be between 0 and 365'
      USING ERRCODE = '22023';
  END IF;

  -- Per-item validation — done up-front so an error message points at the
  -- offending index without partial-state confusion. (Function is wrapped
  -- in a transaction, so even mid-loop failures roll back cleanly; the
  -- separate validate-then-insert is for clarity, not safety.)
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
    IF (v_item ->> 'amount')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Item % has a negative amount', v_idx
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Sum total server-side.
  SELECT COALESCE(SUM((item ->> 'amount')::NUMERIC), 0)
    INTO v_total
    FROM jsonb_array_elements(p_items) AS item;

  -- Resolve expiry. p_expires_in_days = 0 → NULL (open-ended).
  IF p_expires_in_days > 0 THEN
    v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
  ELSE
    v_expires_at := NULL;
  END IF;

  -- Insert the quote row (status='sent' — client hasn't viewed yet).
  INSERT INTO invoices (
    job_id, vendor_id, kind, total, notes, status, sent_at, valid_until
  ) VALUES (
    p_job_id, v_vendor_id, 'quote', v_total, p_notes,
    'sent', NOW(), v_expires_at
  )
  RETURNING id INTO v_quote_id;

  -- Insert items. sort_order = array index preserves user's ordering.
  FOR v_idx IN 0..v_count - 1 LOOP
    v_item := p_items -> v_idx;
    INSERT INTO invoice_items (
      invoice_id, description, amount, sort_order
    ) VALUES (
      v_quote_id,
      trim(v_item ->> 'description'),
      (v_item ->> 'amount')::NUMERIC,
      v_idx
    );
  END LOOP;

  RETURN QUERY SELECT * FROM invoices WHERE id = v_quote_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_quote(UUID, JSONB, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_quote(UUID, JSONB, TEXT, INT) TO authenticated;

-- =============================================================================
-- Smoke tests (manual, run after apply)
-- =============================================================================
-- 1. Confirm the new column + expanded enum:
--    \d invoices
--    SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname = 'invoices_status_check';
--    -- expect 10-value IN list including 'accepted' and 'expired'
--
-- 2. Auth-guard smoke from Studio SQL Editor (no JWT):
--    SELECT * FROM send_quote(
--      'a1234567-0000-4000-8000-000000000003',
--      '[{"description":"Diagnostic","amount":50}]'::jsonb,
--      NULL,
--      14
--    );
--    -- expect: ERROR: Not authenticated (proves wiring)
--
-- 3. After full app test, verify quote row shape:
--    SELECT id, kind, status, total, valid_until, sent_at
--      FROM invoices WHERE kind = 'quote' ORDER BY sent_at DESC LIMIT 5;
