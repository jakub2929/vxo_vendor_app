# Phase 5 Cutover SQL — Consolidated Bundle

**Audit date:** 2026-05-28 (split from single CUTOVER.sql after curl probes against prod)
**Branch:** `merging-DB-schema`
**Target:** Ryan's prod Supabase (`baspxigjzkrotqxmpygf`)

This folder is the single source of truth for the SQL Ryan needs to apply on
prod so the Phase 5–refactored vendor app works. It exists to end the
fragmentation across `supabase/migrations/`, `supabase/schema/`, and
`supabase/refract/`.

---

## TL;DR

There are now **two** files in this folder:

| File | Status | Apply when |
|---|---|---|
| **`CUTOVER_SAFE.sql`** | ✅ Apply immediately. Additive-only, idempotent, no new tables. | Now. |
| **`CUTOVER_NEEDS_RYAN_DECISION.sql`** | 🛑 DRAFT — do NOT apply. Three open design questions for Ryan. | After Ryan reviews and picks an approach per concern. |

After `CUTOVER_SAFE.sql` lands, the hardware smoke covers profile / jobs /
chat / push. Earnings, support chat, and the accept flow stay deferred
pending the decisions in the second file (plus Phase 5B RPCs).

---

## Why the split (curl probe results, 2026-05-28)

We probed Ryan's prod directly to map the real state, instead of trusting
the local mirror. Findings:

### Exists today (safe to ALTER)

| Object | Notes |
|---|---|
| `vendor_profiles` | Base columns + the 5 Ryan added 2026-05-21 (about, business_name, insured, notification_prefs, radius_miles). |
| `vendor_requests` | All Phase 5 columns including the refract additions (eta_*, checkin/out, completion_photo_ids). |
| `request_vendors` | Per Ryan's model. |
| `job_messages` | Phase 5 shape (request_id, message, sender). |
| `device_tokens` | Table exists; UNIQUE constraint may be missing — guarded ADD in SAFE file. |
| `profiles.status` | **Already exists** — earlier draft proposed adding this; turned out to be present. |
| `invoices` | Exists but Alfred/Telegram-era shape: `job_id BIGINT` → legacy `jobs`, plus vendor_id, total, status, labor, parts, notes, paid_at. No UUID link to `vendor_requests`, no `kind`, no `sent_at/viewed_at/overdue_at`, no `valid_until`, no `line_items`. |
| `quotes` | Exists as a separate table. App code does NOT use `from('quotes')` — it uses `invoices` with `kind='quote'`. |

### Missing — purely additive (safe, in `CUTOVER_SAFE.sql`)

| Object | Why the app needs it |
|---|---|
| `vendor_profiles.availability_status` | OOO toggle (Phase 2 feature). |
| `vendor_profiles.avatar_path` / `coi_path` / `w9_path` | `FillProfile.tsx` writes after Storage uploads. |
| `vendor_profiles.updated_at` + BEFORE-UPDATE trigger | Read by vendorCache; ordering fallback in queries. |
| `vendor_profiles` UNIQUE (email) | `FillProfile.upsert(..., onConflict: 'email')` needs it or errors at runtime. |
| `device_tokens` UNIQUE (user_id, platform) | `useNotificationToken.upsert(..., onConflict: 'user_id,platform')`. |
| Storage buckets `vendor-avatars` / `vendor-documents` / `job-photos` + own-folder RLS | All Storage upload paths in `src/lib/vendorStorage.ts` and `src/lib/jobPhotos.ts`. |
| Realtime publication membership for `vendor_profiles`, `request_vendors`, `job_messages` | `useVendorRealtime`, `useHomeRealtime`, `useJobsRealtime`, `useJobChatRealtime`. |

### Missing — design decisions (DRAFT in `CUTOVER_NEEDS_RYAN_DECISION.sql`)

These are NOT in the SAFE file because they aren't simple column adds — each
involves a structural choice only Ryan can make.

| Concern | What's needed | Decision Ryan owns |
|---|---|---|
| **1. invoices ↔ vendor_requests link** | A UUID link from invoices to vendor_requests (current FK is bigint → legacy jobs). Without this, the earnings hooks' embedded `vendor_requests!inner(...)` PostgREST select 400s. Likely also needs `kind`, `sent_at`, `viewed_at`, `overdue_at`, `valid_until`, `updated_at`, `description`, `diagnostic_fee`. | Add `vendor_request_id uuid` to existing invoices (A) vs split into a new `invoices_v2` table (B) vs re-key (C). Plus whether the existing `quotes` table folds into invoices with `kind='quote'`. |
| **2. invoice_items modeling** | The chat timeline does `.select('*, invoice_items(*)')`. No `invoice_items` table or `line_items` JSONB exists today. | New `invoice_items` table (A) vs `invoices.line_items jsonb` (B). A is zero app change; B requires a chat hook rewrite. |
| **3. support_messages** | The Support tab + Chats summary read/write/realtime against `support_messages`. Table doesn't exist. | New `support_messages` table (A) vs reuse `job_messages` with a `source` flag (B). A is zero app change; B requires support hook rewrites. |

See `CUTOVER_NEEDS_RYAN_DECISION.sql` for full context, draft SQL for each
approach, and the questions Ryan needs to answer.

---

## SQL folder map

The repo has four SQL folders. They are NOT interchangeable:

| Folder | Targets | Status after Phase 5 |
|---|---|---|
| `supabase/migrations/` | OUR original dev baseline (custom `vendors`, `jobs`, …) | **OBSOLETE.** Reference only. Do NOT apply to Ryan's prod. |
| `supabase/schema/` | Additive SQL written during dev against OUR old schema | **OBSOLETE.** All files target `vendors`/`jobs`. Do NOT apply. |
| `supabase/refract/` | Additive SQL targeting **Ryan's** prod tables | **Relevant.** All 10 files folded into the SAFE file (or already applied on prod). |
| `supabase/ryan-prod-mirror/` | Local reconstruction of Ryan's schema | **Reference only** (and known stale re: invoices shape — superseded by the 2026-05-28 curl probes). |
| `supabase/full-sql/` | This folder: the cutover bundle + this README | **THE bundle.** |

---

## What Ryan applies on prod

### Now: `supabase/full-sql/CUTOVER_SAFE.sql`

1. Run end-to-end on `baspxigjzkrotqxmpygf`.
2. **Watch the NOTICE output.** The `vendor_profiles` email unique constraint
   self-skips (with a `RAISE NOTICE`) if duplicate non-null emails already
   exist in the table — this is non-fatal, the rest of the file applies
   regardless. If skipped, resolve the duplicates (the NOTICE prints the
   diagnostic query) and re-run the file to add the constraint.
3. Run the verification block at the bottom of the file — every SELECT
   should return the expected row count. (Check #2 may legitimately return
   0 rows if the email constraint was intentionally skipped per step 2.)
4. Notify the app team. We swap `.env` to Ryan-prod credentials and run the
   hardware smoke for **profile / jobs / chat / push notifications** only.

### Later (deferred): `supabase/full-sql/CUTOVER_NEEDS_RYAN_DECISION.sql`

This file is a **DRAFT**. Every statement in it is commented out. The file
documents the three open design questions (invoices↔vendor_requests link,
invoice_items, support_messages) and provides the SQL for each candidate
approach. Ryan reviews, picks an approach per concern, and either edits the
file in place (uncomment chosen approach, delete others) or replies with his
preference so we author a follow-up SQL file matching his decisions.

**Do not apply** anything from `supabase/migrations/` or `supabase/schema/`.
Those target the old `vendors`/`jobs` dev schema and would conflict with
Ryan's prod model.

---

## Full SQL file inventory

Every `.sql` file in the repo, classified.

### `supabase/full-sql/`
| File | Status |
|---|---|
| `CUTOVER_SAFE.sql` | ✅ Apply now. Additive-only, idempotent. |
| `CUTOVER_NEEDS_RYAN_DECISION.sql` | 🛑 DRAFT. Discuss with Ryan; do not apply as-is. |

### `supabase/refract/` — ADDITIVE-RYAN (folded into SAFE or already applied)
| File | Adds | Status |
|---|---|---|
| `add-vendor-profiles-about.sql` | `vendor_profiles.about` | Applied by Ryan 2026-05-21 |
| `add-vendor-profiles-business-name.sql` | `vendor_profiles.business_name` | Applied by Ryan 2026-05-21 |
| `add-vendor-profiles-insured.sql` | `vendor_profiles.insured` | Applied by Ryan 2026-05-21 |
| `add-vendor-profiles-notification-prefs.sql` | `vendor_profiles.notification_prefs` | Applied by Ryan 2026-05-21 |
| `add-vendor-profiles-radius-miles.sql` | `vendor_profiles.radius_miles` | Applied by Ryan 2026-05-21 |
| `add-vendor-profiles-availability-status.sql` | `vendor_profiles.availability_status` | Folded into SAFE §1 |
| `add-vendor-requests-checkin-checkout.sql` | `vendor_requests.checkin_time`, `checkout_time` | Already on prod (probe-confirmed) |
| `add-vendor-requests-completion-photo-ids.sql` | `vendor_requests.completion_photo_ids` | Already on prod (probe-confirmed) |
| `add-vendor-requests-eta-fields.sql` | `vendor_requests.eta_label`, `eta_datetime` | Already on prod (probe-confirmed) |
| `add-device-tokens-unique-constraint.sql` | `device_tokens` UNIQUE (user_id, platform) | Folded into SAFE §2 |

### `supabase/ryan-prod-mirror/`
| File | Status | Apply to Ryan prod? |
|---|---|---|
| `schema.sql` | MIRROR — known stale on invoices/quotes shape; superseded by 2026-05-28 curl probes. | ❌ Never (it's a copy of prod, not applied to it). |
| `1.JPG`, `2.JPG` | Source screenshots | n/a |

### `supabase/migrations/` — OBSOLETE
| File | Targets | Apply? |
|---|---|---|
| `001_alfred_tables_DEV_ONLY.sql` | Our old `vendors`/`jobs`/`invoices`/etc. baseline | ❌ Never |
| `002_ryan_email_migrations.sql` | Adds columns to old `vendors` | ❌ Never — wrong table |
| `003_rls_policies.sql` | RLS for old tables | ❌ Never |
| `004_storage_realtime.sql` | Storage + Realtime targeting old `jobs` | ❌ Never — re-done idempotently in SAFE §3/§4 |
| `005_support_messages.sql.bak` | `.bak`, not active | ❌ Never |

### `supabase/schema/` — OBSOLETE (every file targets the old `vendors`/`jobs` schema)
| File | What it does | Apply? |
|---|---|---|
| `add-complete-job-rpc.sql` | RPC against old `jobs` | ❌ Phase 5B — Ryan reauthors |
| `add-invoice-extensions.sql` | Adds columns + RPC to old `invoices` | ❌ Wrong FK targets |
| `add-job-photos-storage.sql` | Storage tightening; bucket name `job-photos` is correct | ❌ Re-done in SAFE §3 |
| `add-job-transition-rpcs.sql` | 4 RPCs against old `jobs` | ❌ Phase 5B — Ryan reauthors |
| `add-quote-extensions.sql` | RPC + column against old `invoices` | ❌ Phase 5B + see Concern 1 |
| `add-support-messages.sql` | `support_messages` FK to OLD `vendors` | ❌ See NEEDS_RYAN Concern 3 |
| `add-vendor-documents-avatars.sql` | Storage + columns on old `vendors` | ❌ Re-done in SAFE §1 + §3 |
| `add-vendor-notification-prefs.sql` | Duplicate of refract version targeting OLD `vendors` | ❌ Wrong table |
| `add-vendors-to-realtime.sql` | Adds OLD `vendors` to publication | ❌ SAFE §4 publishes the right tables |
| `harden-vendors-rls.sql` | RLS hardening on OLD `vendors` | ❌ Never |
| `seed-jobs-for-smoke-test.sql` | Dev seed data | ❌ Dev-only |
| `widen-mark-on-site-source-statuses.sql` | RPC update for OLD `jobs` | ❌ Phase 5B |

### Root-level
| File | Status |
|---|---|
| `supabase/seed.sql` | Dev seed for old schema. ❌ Never apply to prod. |

---

## Phase 5B — what's still pending after SAFE lands

Phase 5B is the RPC reissue. Ryan needs to author these functions against
his `vendor_requests` / `request_vendors` model. They are server-side
functions, not in either SQL file in this folder.

App calls are currently stubbed with `Alert.alert('Coming soon')`:

| RPC | Trigger in app | Affects |
|---|---|---|
| `accept_job(p_job_id)` | Accept button on incoming job | `request_vendors.job_status` → in_progress |
| `reject_job(p_job_id, p_reason)` | Reject button | `request_vendors.job_status` → cancelled |
| `start_travel(p_job_id)` | "On the way" CTA | → on_the_way |
| `mark_on_site(p_job_id)` | "I'm here" CTA + `checkin_time` | → arrived |
| `complete_job(p_job_id, p_photo_ids)` | Final completion + `checkout_time` + photo IDs | → completed |
| `send_invoice(p_job_id, p_items, p_notes)` | Invoice composer | inserts into `invoices` |
| `send_quote(p_job_id, p_items, p_notes, p_expires_in_days)` | Quote composer | inserts into `invoices` (kind=quote) |

`send_invoice` and `send_quote` interact with the Concern 1 / Concern 2
decisions — Ryan likely wants those resolved before authoring them.

Once Ryan ships these RPCs, we un-stub the call sites in the app (one PR).

---

## Cutover checklist

### Phase A — apply now

1. [ ] Ryan applies `supabase/full-sql/CUTOVER_SAFE.sql` on `baspxigjzkrotqxmpygf`.
2. [ ] Ryan runs the verification block at the bottom of `CUTOVER_SAFE.sql`
       and confirms every query returns the expected row count.
3. [ ] App team swaps `.env` to Ryan-prod credentials.
4. [ ] Hardware smoke test (per `PHASE_5_TEST_PLAN.md` at repo root) covering:
   - Profile (FillProfile upload, OOO toggle, notification prefs)
   - Jobs list + job detail
   - Job chat (vendor↔client messaging, realtime)
   - Push notifications (device token registration)

### Phase B — needs Ryan's decisions

5. [ ] Ryan reviews `CUTOVER_NEEDS_RYAN_DECISION.sql` and picks an approach
       per concern (1: invoices↔vendor_requests link; 2: invoice_items;
       3: support_messages).
6. [ ] We author a follow-up SQL file matching his decisions and update
       the app where needed (most "approach A" choices are zero app change).
7. [ ] Ryan applies the follow-up; we hardware-smoke earnings + support.

### Phase 5B — RPCs

8. [ ] Ryan ships the 7 transition / invoice / quote RPCs. We un-stub the
       call sites in the app.

---

## Why this folder exists (history)

The vendor app refactor (Phase 5A) re-targeted the data layer from our
custom `vendors`/`jobs` schema to Ryan's prod tables (`vendor_profiles`,
`vendor_requests`, `request_vendors`, `job_messages`, `device_tokens`,
`notifications`). The old SQL in `supabase/migrations/` and
`supabase/schema/` was never deleted (kept for historical reference and in
case anything in it was still needed), and additive SQL targeting Ryan's
tables accumulated in `supabase/refract/`. This created a real risk of
applying the wrong files. `supabase/full-sql/` is the answer.

The single `CUTOVER.sql` was further split into SAFE + NEEDS_RYAN after
curl probes (2026-05-28) revealed three structural mismatches that aren't
addressable by additive SQL alone — they require Ryan's design call.
