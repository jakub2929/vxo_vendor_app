# Supabase Schema (staging)

Vendor-app-side additive SQL — extensions, RPCs, hardening, and storage
configuration — staged here for review and apply to dev. Ryan applies
each file to prod from his platform repo on his own cadence.

Baseline tables, baseline RLS, and the initial storage/realtime
configuration live in [`supabase/migrations/`](../migrations/README.md);
this directory is everything we've added on top.

## Workflow

1. Write SQL here as a standalone, self-contained file with a descriptive
   `add-…` / `widen-…` / `harden-…` filename.
2. Each file should be **idempotent** where reasonable (`CREATE … IF NOT
   EXISTS`, `DROP POLICY IF EXISTS … CREATE POLICY`, defensive `DO $$ …
   END $$` around publication mutations, `CREATE OR REPLACE FUNCTION`).
3. Wrap multi-statement changes in `BEGIN; … COMMIT;` for transactional
   apply.
4. Document apply order in the file header if it depends on another
   `schema/` file.
5. Test on dev Supabase via Studio SQL Editor.
6. After Ryan applies to prod, optionally promote to `migrations/` with
   the next numbered prefix (or leave here as the historical record —
   both conventions are in use).

## Apply order

Some files depend on others. When provisioning a fresh dev DB after the
`migrations/` baseline has been applied, run these in this order:

1. [`add-vendor-documents-avatars.sql`](add-vendor-documents-avatars.sql) — adds `vendors.avatar_path / coi_path / w9_path` columns + Storage buckets/policies for vendor docs.
2. [`add-job-transition-rpcs.sql`](add-job-transition-rpcs.sql) — installs `current_vendor_id()` helper + `accept_job` / `reject_job` / `start_travel` / `mark_on_site` RPCs.
3. [`widen-mark-on-site-source-statuses.sql`](widen-mark-on-site-source-statuses.sql) — `CREATE OR REPLACE` of `mark_on_site` to accept `accepted` as well as `en_route` as source status. Depends on step 2.
4. [`add-job-photos-storage.sql`](add-job-photos-storage.sql) — tightens the `job-photos` bucket created in migration 004 (10 MB cap, JPEG/PNG/WEBP allowlist, DELETE policy).
5. [`add-complete-job-rpc.sql`](add-complete-job-rpc.sql) — `complete_job(p_job_id, p_photo_ids)` RPC. Depends on step 2 (`current_vendor_id`) and step 4 (bucket configured).
6. [`add-invoice-extensions.sql`](add-invoice-extensions.sql) — adds engagement timestamps + `invoice_items` table + `send_invoice` RPC. Depends on step 2 (`current_vendor_id`).
7. [`add-quote-extensions.sql`](add-quote-extensions.sql) — adds `invoices.valid_until` + expands the status enum for quotes. Depends on step 6.
8. [`add-support-messages.sql`](add-support-messages.sql) — `support_messages` table + RLS + realtime publication entry. Independent of the job/invoice files.
9. [`add-vendors-to-realtime.sql`](add-vendors-to-realtime.sql) — adds `public.vendors` to the `supabase_realtime` publication so OOO / status flips push live. Independent.
10. [`harden-vendors-rls.sql`](harden-vendors-rls.sql) — Phase 2.5: replaces the baseline `vendor_own` `FOR ALL` policy with per-action policies + status guard trigger + email immutability trigger. Apply **after** migration `003_rls_policies.sql` from the baseline; idempotent on re-run.
11. [`seed-jobs-for-smoke-test.sql`](seed-jobs-for-smoke-test.sql) — dev-only smoke fixtures (10 jobs across every status, job_messages, 1 test vendor). See companion [`seed-jobs-for-smoke-test.VERIFICATION.md`](seed-jobs-for-smoke-test.VERIFICATION.md) for expected counts and query checks.

## File-by-file

### [`add-vendor-documents-avatars.sql`](add-vendor-documents-avatars.sql)
**Purpose:** persist vendor avatar / COI / W-9 to Storage with paths held on the `vendors` row. **Dependencies:** none beyond the baseline `vendors` table. **Rollback:** not included (additive columns + buckets). **Status:** applied on dev; pending prod apply confirmation.

### [`add-job-transition-rpcs.sql`](add-job-transition-rpcs.sql)
**Purpose:** four vendor-initiated `jobs.status` transition RPCs (`accept_job`, `reject_job`, `start_travel`, `mark_on_site`) + shared `current_vendor_id()` helper. SECURITY DEFINER with locked search_path, auth via JWT email. **Dependencies:** baseline `jobs`, `vendors`, `dispatch_log` tables. **Rollback:** not included (idempotent `CREATE OR REPLACE`). **Status:** applied on dev.

### [`widen-mark-on-site-source-statuses.sql`](widen-mark-on-site-source-statuses.sql)
**Purpose:** widen `mark_on_site` to accept `accepted` in addition to `en_route` (vendor skipped Get Directions but arrived anyway). **Dependencies:** `add-job-transition-rpcs.sql`. **Rollback:** re-apply the original `mark_on_site` from `add-job-transition-rpcs.sql`. **Status:** applied on dev.

### [`add-job-photos-storage.sql`](add-job-photos-storage.sql)
**Purpose:** gap-fill on the `job-photos` bucket created in migration 004 — sets `file_size_limit` (10 MB), `allowed_mime_types` (JPEG/PNG/WEBP), adds DELETE policy. **Dependencies:** migration 004. **Rollback:** not included. **Status:** applied on dev.

### [`add-complete-job-rpc.sql`](add-complete-job-rpc.sql)
**Purpose:** `complete_job(p_job_id, p_photo_ids)` RPC — vendor-initiated completion, writes photo paths + flips status to `complete` + sets `checkout_time` (COALESCE). 1–5 photo paths required, source status must be `on_site` or `en_route`. **Dependencies:** `current_vendor_id()` from `add-job-transition-rpcs.sql`; `job-photos` bucket. **Rollback:** `DROP FUNCTION IF EXISTS complete_job`. **Status:** applied on dev.

### [`add-invoice-extensions.sql`](add-invoice-extensions.sql)
**Purpose:** adds invoice engagement timestamps (`sent_at`, `viewed_at`, `paid_at`, `overdue_at`), expands status enum, creates normalized `invoice_items` table + RLS, adds `send_invoice` RPC. Legacy `invoices.line_items` JSONB stays for mock-fixture back-compat. **Dependencies:** `current_vendor_id()` from `add-job-transition-rpcs.sql`. **Rollback:** not included. **Status:** applied on dev.

### [`add-quote-extensions.sql`](add-quote-extensions.sql)
**Purpose:** adds `invoices.valid_until` + expands status enum with `accepted` (quote approved by client) and `expired`. Quotes share the `invoices` table with `kind='quote'`. **Dependencies:** `add-invoice-extensions.sql`. **Rollback:** not included. **Status:** applied on dev.

### [`add-support-messages.sql`](add-support-messages.sql)
**Purpose:** `support_messages` table (two thread types: `current_job`, `general`), senders `vendor` / `support` / `system`, RLS scoped by `vendor_id` matched on JWT email, realtime publication entry. Migrated from the original `supabase/migrations/005_support_messages.sql` (preserved as `.bak`). **Dependencies:** baseline `vendors` + `jobs`. **Rollback:** not included. **Status:** applied on dev via the original migration.

### [`add-vendors-to-realtime.sql`](add-vendors-to-realtime.sql)
**Purpose:** adds `public.vendors` to the `supabase_realtime` publication so `useVendorRealtime` receives `vendors.status` updates (powers PendingStatusBanner + OOO cross-device sync). **Dependencies:** publication must exist (defensive `DO $$` guard if not). **Rollback:** `ALTER PUBLICATION supabase_realtime DROP TABLE public.vendors`. **Status:** applied on dev.

### [`harden-vendors-rls.sql`](harden-vendors-rls.sql)
**Purpose:** Phase 2.5 hardening. Drops baseline `vendor_own FOR ALL` policy and replaces with per-action `vendor_select_own` / `vendor_insert_own` / `vendor_update_own` (no DELETE policy = default deny). Adds `vendor_status_change_guard` BEFORE UPDATE OF status trigger (only allows OOO toggle pair `active ↔ out_of_office`, service_role bypass) and `vendor_email_immutable_guard` (email is RLS identity). Replaces an earlier `WITH CHECK` subquery attempt that had a name-shadow bug — see file header for the why. **Dependencies:** baseline RLS from migration `003`. **Rollback:** inline at the bottom of the file. **Status:** applied on dev — verify on hardware that OOO toggle still works post-apply; pending prod apply by Ryan.

### [`seed-jobs-for-smoke-test.sql`](seed-jobs-for-smoke-test.sql) + [`seed-jobs-for-smoke-test.VERIFICATION.md`](seed-jobs-for-smoke-test.VERIFICATION.md)
**Purpose:** dev fixtures — 10 jobs (one per status value) + job_messages anchored near Springfield, IL, all assigned to one test vendor UUID. Idempotent via deterministic UUIDs + `ON CONFLICT DO NOTHING`. **Dependencies:** baseline `jobs` + `job_messages`; update `test_vendor_id` in the file to your dev vendor's UUID. **Status:** dev-only — never run in prod.

## What NOT to do

- Don't apply a file here without dev testing it first. Studio SQL Editor on the dev project is the canonical test bench.
- Don't delete a file after Ryan applies it — the file is the historical record of what shipped from the vendor-app side.
- Don't edit a file after Ryan has applied it on prod. Write a follow-up file (`widen-…`, `harden-…`, `relax-…`) and link it from the original's header.
- Don't reorder the apply sequence without re-reading each affected file's `-- Dependencies:` header. Several files assume `current_vendor_id()` exists.
- Don't include `DROP TABLE` / `DROP COLUMN` here. Use `IF EXISTS` everywhere additive; surface destructive intent to Ryan as a separate review.
