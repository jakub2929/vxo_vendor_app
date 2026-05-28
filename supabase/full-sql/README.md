# Phase 5 Cutover SQL — Consolidated Bundle

**Audit date:** 2026-05-28
**Branch:** `merging-DB-schema`
**Target:** Ryan's prod Supabase (`baspxigjzkrotqxmpygf`)

This folder is the single source of truth for the SQL Ryan needs to apply on
prod so the Phase 5–refactored vendor app works. It exists to end the
fragmentation across `supabase/migrations/`, `supabase/schema/`, and
`supabase/refract/`.

---

## TL;DR

- Apply **`CUTOVER.sql`** on Ryan's prod. Nothing else.
- Sections 1–6 are uncontroversial; **read Section 7 first** before applying it.
- Run the verification block at the bottom of the file when done.
- Phase 5B RPCs (`accept_job`, `reject_job`, `start_travel`, `mark_on_site`,
  `complete_job`, `send_invoice`, `send_quote`) are **not** in this SQL —
  they're Ryan-authored functions. App calls are currently stubbed.

---

## SQL folder map

The repo has four SQL folders. They are NOT interchangeable:

| Folder | Targets | Status after Phase 5 |
|---|---|---|
| `supabase/migrations/` | OUR original dev baseline (custom `vendors`, `jobs`, …) | **OBSOLETE.** Reference only. Do NOT apply to Ryan's prod. |
| `supabase/schema/` | Additive SQL written during dev against OUR old schema | **OBSOLETE.** All files target `vendors`/`jobs`. Do NOT apply. |
| `supabase/refract/` | Additive SQL targeting **Ryan's** prod tables | **Relevant.** All 10 files are merged into `CUTOVER.sql`. |
| `supabase/ryan-prod-mirror/` | Local reconstruction of Ryan's schema | **Reference only.** It's a copy *of* prod, not applied *to* it. |
| `supabase/full-sql/` | This folder: the consolidated cutover + this README | **THE bundle.** |

---

## What Ryan applies on prod

Exactly one file: **`supabase/full-sql/CUTOVER.sql`**.

Procedure:

1. Run `CUTOVER.sql` end-to-end on `baspxigjzkrotqxmpygf`.
2. Run the verification block at the bottom of the same file.
3. Confirm every check returns the expected row count.
4. Notify the app team — we swap `.env` to Ryan-prod credentials and run
   the hardware smoke test (`PHASE_5_TEST_PLAN.md` at the repo root).

**Do not apply** anything from `supabase/migrations/` or `supabase/schema/`.
Those target the old `vendors`/`jobs` dev schema and would conflict with
Ryan's prod model.

---

## Full SQL file inventory

Every `.sql` file in the repo, classified.

### `supabase/full-sql/`
| File | Status | Apply to Ryan prod? |
|---|---|---|
| `CUTOVER.sql` | **CONSOLIDATED — single source of truth** | ✅ YES — this is the one |

### `supabase/refract/` — ADDITIVE-RYAN (all merged into CUTOVER.sql)
| File | Adds | In bundle? |
|---|---|---|
| `add-vendor-profiles-about.sql` | `vendor_profiles.about` | ✅ Section 1 |
| `add-vendor-profiles-business-name.sql` | `vendor_profiles.business_name` | ✅ Section 1 |
| `add-vendor-profiles-insured.sql` | `vendor_profiles.insured` | ✅ Section 1 |
| `add-vendor-profiles-notification-prefs.sql` | `vendor_profiles.notification_prefs` (jsonb default) | ✅ Section 1 |
| `add-vendor-profiles-radius-miles.sql` | `vendor_profiles.radius_miles` | ✅ Section 1 |
| `add-vendor-profiles-availability-status.sql` | `vendor_profiles.availability_status` + CHECK | ✅ Section 1 |
| `add-vendor-requests-checkin-checkout.sql` | `vendor_requests.checkin_time`, `checkout_time` | ✅ Section 2 |
| `add-vendor-requests-completion-photo-ids.sql` | `vendor_requests.completion_photo_ids` | ✅ Section 2 |
| `add-vendor-requests-eta-fields.sql` | `vendor_requests.eta_label`, `eta_datetime` | ✅ Section 2 |
| `add-device-tokens-unique-constraint.sql` | `device_tokens` unique (user_id, platform) | ✅ Section 3 |

### `supabase/ryan-prod-mirror/`
| File | Status | Apply to Ryan prod? |
|---|---|---|
| `schema.sql` | MIRROR-ONLY — a snapshot OF Ryan's prod for dev parity | ❌ Never (it's a copy of prod) |
| `1.JPG`, `2.JPG` | Source screenshots | n/a |

### `supabase/migrations/` — OBSOLETE
| File | Targets | Apply to Ryan prod? |
|---|---|---|
| `001_alfred_tables_DEV_ONLY.sql` | Our old `vendors`/`jobs`/`invoices`/`dispatch_log`/`job_messages` baseline | ❌ Never |
| `002_ryan_email_migrations.sql` | Adds `email`/`expo_push_token` to old `vendors` table | ❌ Never — wrong table |
| `003_rls_policies.sql` | RLS for old `vendors`/`jobs`/etc. | ❌ Never |
| `004_storage_realtime.sql` | Storage bucket + Realtime + RLS targeting old `jobs` | ❌ Never — bucket setup re-done idempotently in CUTOVER.sql §5 |
| `005_support_messages.sql.bak` | `.bak` (not active) | ❌ Never |

### `supabase/schema/` — OBSOLETE (every file targets the old `vendors`/`jobs` schema)
| File | What it does | Apply to Ryan prod? |
|---|---|---|
| `add-complete-job-rpc.sql` | RPC against old `jobs` | ❌ Phase 5B — Ryan reauthors |
| `add-invoice-extensions.sql` | Adds columns + RPC to old `invoices` | ❌ Wrong FK targets |
| `add-job-photos-storage.sql` | Storage tightening; bucket name `job-photos` is correct | ❌ Re-done in CUTOVER.sql §5 |
| `add-job-transition-rpcs.sql` | 4 RPCs against old `jobs` | ❌ Phase 5B — Ryan reauthors |
| `add-quote-extensions.sql` | RPC + column against old `invoices` | ❌ Phase 5B |
| `add-support-messages.sql` | `support_messages` table FK to OLD `vendors` | ❌ Use CUTOVER.sql §7 shape instead |
| `add-vendor-documents-avatars.sql` | Storage buckets + columns on old `vendors` | ❌ Re-done in CUTOVER.sql §1 + §5 |
| `add-vendor-notification-prefs.sql` | **Duplicate** of refract version; targets OLD `vendors` | ❌ Wrong table — use refract version (already in §1) |
| `add-vendors-to-realtime.sql` | Adds OLD `vendors` to publication | ❌ CUTOVER.sql §6 publishes the right tables |
| `harden-vendors-rls.sql` | RLS hardening on OLD `vendors` | ❌ Never |
| `seed-jobs-for-smoke-test.sql` | Dev seed data | ❌ Dev-only |
| `widen-mark-on-site-source-statuses.sql` | RPC update for OLD `jobs` | ❌ Phase 5B |

### Root-level
| File | Status |
|---|---|
| `supabase/seed.sql` | Dev seed for old schema. ❌ Never apply to prod. |

---

## Gap analysis — what the audit added beyond the refract bundle

The refract bundle covers the columns Ryan needs on his existing tables. The
backend code audit (every `supabase.from()` / `supabase.rpc()` /
`supabase.channel()` / `supabase.storage.from()` call in `src/`) surfaced
additional requirements not covered by any existing SQL file:

| Requirement | Source | Now covered in |
|---|---|---|
| `vendor_profiles.avatar_path` / `coi_path` / `w9_path` (text) | `FillProfile.tsx:407-414` writes these after Storage uploads | CUTOVER.sql §1 |
| `vendor_profiles.updated_at` + BEFORE-UPDATE trigger | Vendor type + earnings fallback ordering | CUTOVER.sql §1 |
| `vendor_profiles` UNIQUE on `email` | `FillProfile.tsx:338` `.upsert(..., { onConflict: 'email' })` | CUTOVER.sql §1 |
| `profiles.status` (`pending`/`approved`/`suspended`/`rejected`) | `vendorCache.ts:60-62` reads, `FillProfile.tsx:354` writes | CUTOVER.sql §4 |
| Storage buckets `vendor-avatars` / `vendor-documents` / `job-photos` | `src/lib/vendorStorage.ts`, `src/lib/jobPhotos.ts` | CUTOVER.sql §5 |
| Storage RLS for the 3 buckets | App relies on own-folder write + RLS for delete | CUTOVER.sql §5 (minimal — Ryan should review) |
| Realtime publication membership for `vendor_profiles`, `request_vendors`, `job_messages`, `support_messages` | 6 channels in `src/hooks/*Realtime.ts` + 2 support channels | CUTOVER.sql §6 |

### Flagged for Ryan review — Section 7 of CUTOVER.sql

The app code reads/writes three tables that are **not** in
`supabase/ryan-prod-mirror/schema.sql`:

- `invoices` — used by `useHomeData`, `useJobChat`, `usePendingInvoices`,
  `usePaidInvoices`, `usePendingQuotes`.
- `invoice_items` — embedded select `*, invoice_items(*)` in `useJobChat`.
- `support_messages` — used by `useSupportThread`, `useSupportSummary`.

Two possibilities:

1. **Ryan's prod already has them**, the mirror is just stale. In that case
   the `CREATE TABLE IF NOT EXISTS` in Section 7 is a no-op — safe to apply.
2. **They genuinely do not exist on prod**. In that case the entire earnings
   tab + invoice flow + support chat is broken regardless of what's in this
   SQL bundle, and Ryan should author these tables to fit his backend
   conventions before we ship.

**Recommendation:** apply Sections 1–6 first. Then ask Ryan whether prod has
`invoices`, `invoice_items`, `support_messages`. If yes, Section 7 was
unnecessary (or apply it idempotently — still a no-op). If no, get his
sign-off on the inferred shapes in Section 7 (or his own preferred shapes)
before running it.

---

## Phase 5B — what's pending after this SQL lands

Phase 5B is the RPC reissue. Ryan needs to author these functions against
his `vendor_requests` / `request_vendors` model. They are **not** part of
`CUTOVER.sql` — they are server-side functions, his domain.

App calls are currently stubbed with `Alert.alert('Coming soon')`:

| RPC | Trigger in app | Affects |
|---|---|---|
| `accept_job(p_job_id)` | Accept button on incoming job | `request_vendors.job_status` → in_progress |
| `reject_job(p_job_id, p_reason)` | Reject button | `request_vendors.job_status` → cancelled |
| `start_travel(p_job_id)` | "On the way" CTA | `request_vendors.job_status` → on_the_way |
| `mark_on_site(p_job_id)` | "I'm here" CTA + `checkin_time` | → arrived |
| `complete_job(p_job_id, p_photo_ids)` | Final completion + `checkout_time` + photo IDs | → completed |
| `send_invoice(p_job_id, p_items, p_notes)` | Invoice composer | inserts into `invoices` |
| `send_quote(p_job_id, p_items, p_notes, p_expires_in_days)` | Quote composer | inserts into `invoices` (kind=quote) |

Once Ryan ships these, we un-stub the call sites in the app (one PR).

---

## Cutover checklist

1. [ ] Ryan reviews Section 7 of `CUTOVER.sql` and confirms whether his prod
       already has `invoices` / `invoice_items` / `support_messages`.
2. [ ] Ryan applies `supabase/full-sql/CUTOVER.sql` on
       `baspxigjzkrotqxmpygf` (Sections 1–6 unconditionally; Section 7 per
       step 1).
3. [ ] Ryan runs the verification block at the bottom of `CUTOVER.sql` and
       confirms every query returns the expected row count.
4. [ ] App team swaps `.env` to Ryan prod credentials.
5. [ ] Hardware smoke test per `PHASE_5_TEST_PLAN.md` at repo root.
6. [ ] Phase 5B: Ryan ships the 7 RPCs above; we un-stub the call sites.

---

## Why this folder exists (history)

The vendor app refactor (Phase 5A) re-targeted the data layer from our
custom `vendors`/`jobs` schema to Ryan's prod tables (`vendor_profiles`,
`vendor_requests`, `request_vendors`, `job_messages`, `device_tokens`,
`notifications`). The old SQL in `supabase/migrations/` and
`supabase/schema/` was never deleted (kept for historical reference and in
case anything in it was still needed), and additive SQL targeting Ryan's
tables accumulated in `supabase/refract/`. This created a real risk of
applying the wrong files. `supabase/full-sql/` is the answer: one bundle,
one README, no ambiguity.
