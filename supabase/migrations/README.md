# Supabase Migrations

Numbered SQL files that define the **baseline schema** plus the RLS,
storage, and realtime configuration the vendor app depends on. These are
authored as a dev-only reconstruction of Ryan's eventual prod schema; the
non-baseline files (`002`+) are written to **survive** replacement of the
baseline by Ryan's official schema.

For vendor-app-side **additive** SQL (extra columns, RPCs, candidate
schema changes), see [`supabase/schema/`](../schema/README.md) — that is
the staging directory.

## Apply order

Files apply in lexical order (`001`, `002`, `003`, `004`). Each file is
designed to be idempotent on its own (`CREATE … IF NOT EXISTS`, `DROP …
IF EXISTS` before `CREATE POLICY`, defensive `DO $$ … END $$` around
publication mutations), so the whole sequence is safe to re-run.

## Current files

- **[`001_alfred_tables_DEV_ONLY.sql`](001_alfred_tables_DEV_ONLY.sql)** — Dev-only reconstruction of the core tables (`vendors`, `jobs`, `job_messages`, `invoices`, `dispatch_log`), enums, indexes, and the shared `vxo_set_updated_at` trigger function with `BEFORE UPDATE` triggers on `vendors`, `jobs`, `invoices`. **Replace with Ryan's official schema** when it arrives — `002`–`004` are designed to re-apply on top of his tables unchanged.
- **[`002_ryan_email_migrations.sql`](002_ryan_email_migrations.sql)** — Two explicit additions Ryan requested by email: `vendors.email TEXT` and `vendors.expo_push_token TEXT`. Pure `ADD COLUMN IF NOT EXISTS`, survives baseline replacement.
- **[`003_rls_policies.sql`](003_rls_policies.sql)** — Enables RLS on `vendors`, `jobs`, `job_messages`, `invoices` and installs the baseline `vendor_own` / `vendor_jobs_*` / `vendor_messages` / `vendor_invoices` policies. **Superseded on `vendors`** by [`supabase/schema/harden-vendors-rls.sql`](../schema/harden-vendors-rls.sql) (Phase 2.5) — apply this file first to establish the baseline, then apply the hardening file on top.
- **[`004_storage_realtime.sql`](004_storage_realtime.sql)** — Adds `jobs`, `job_messages`, `invoices` to the `supabase_realtime` publication; creates the `job-photos` and (in the same file) vendor-document Storage buckets with INSERT/SELECT RLS scoped by `{vendor_id}/` or `{job_id}/` folder. **Gap-filled** by [`supabase/schema/add-job-photos-storage.sql`](../schema/add-job-photos-storage.sql) (10 MB cap + MIME allowlist + DELETE policy) and [`supabase/schema/add-vendors-to-realtime.sql`](../schema/add-vendors-to-realtime.sql) (adds `vendors` to the publication).
- **[`005_support_messages.sql.bak`](005_support_messages.sql.bak)** — Audit-trail backup of the original support-chat migration. The active version was relocated to [`supabase/schema/add-support-messages.sql`](../schema/add-support-messages.sql) to match convention (vendor-app additives live in `schema/`). `.bak` extension keeps it out of `*.sql` glob picks. See [docs/schema-cleanup-notes.md](../../docs/schema-cleanup-notes.md) for the move log.

## How to apply

### Dev (Supabase Studio)

1. Apply `001` → `002` → `003` → `004` in order via the Studio SQL Editor.
2. Then apply the vendor-app additives from [`supabase/schema/`](../schema/README.md) per that README's order.
3. Optionally run [`supabase/seed.sql`](../seed.sql) for a minimal seed (requires a matching Supabase Auth user — create one in the Auth dashboard first).

### Prod

`migrations/` baseline shape is owned by Ryan in his platform repo. The
vendor-app additive SQL in `supabase/schema/` is what Ryan applies on
prod from this repo — see [`supabase/schema/README.md`](../schema/README.md).

## Relationship to `schema/`

| Directory | Purpose | Authoritative |
|---|---|---|
| `migrations/` | Numbered baseline (dev) + RLS/Storage/Realtime | Ryan's prod source-of-truth (the baseline shape) |
| `schema/` | Vendor-app-side additive SQL pending prod apply | Promoted to `migrations/` (in Ryan's repo) once applied |

When Ryan applies a file from `schema/` to prod, it can optionally be
promoted into `migrations/` with the next numbered prefix. Files in
`schema/` stay there as the historical record of what was applied from
the vendor-app side.

## What NOT to do

- Don't edit a migration after it's been applied. Write a new file (in `schema/` for additive work, or coordinate with Ryan for a new numbered migration).
- Don't apply migrations out of order — `003` and `004` assume `001` has run (tables must exist), and the storage policies in `004` reference RLS helpers established earlier.
- Don't run `001_alfred_tables_DEV_ONLY.sql` against prod — it's a dev-only reconstruction and will collide with Ryan's official tables.
- Don't `DROP TABLE` from a migration. Everything here is non-destructive by design.
