# Schema cleanup notes

Running log of vendor-app-side schema files that have been relocated to match
the project's `schema/` vs `migrations/` convention. Source-of-truth folders:

- `supabase/migrations/` — numbered, dev-only baseline reconstruction of
  Ryan's eventual official schema (see `supabase/migrations/README.md`).
- `supabase/schema/` — vendor-app additive extensions, candidate schema
  awaiting promotion into a numbered migration.

## 2026-05-15 — `support_messages` moved migrations → schema

**Why.** `005_support_messages.sql` was added to `supabase/migrations/` even
though it is a vendor-app-side additive (support chat table + RLS +
realtime publication entry) — every comparable extension (invoice, quote,
vendor docs, avatars, vendors-realtime) already lives in
`supabase/schema/`. Flagged in
[push-notifications-audit.md](push-notifications-audit.md) during the
Phase 0 audit.

**What changed (files only — no DB changes).**

- New: `supabase/schema/add-support-messages.sql` — exact contents of the
  original migration plus a header explaining the move. Idempotent
  (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `DROP POLICY IF EXISTS … CREATE POLICY`, defensive `DO $$ … END $$` for
  the realtime publication ALTER). Safe to re-run.
- Renamed: `supabase/migrations/005_support_messages.sql` →
  `005_support_messages.sql.bak` via `git mv` (preserves history as a
  rename, not an add+delete). The `.bak` suffix keeps the file out of any
  `*.sql` provisioning glob so it isn't double-applied, while leaving
  evidence of the original applied migration.
- Updated: `supabase/migrations/README.md` — added a note pointing readers
  to the new schema-side location.

**DB state.** Unchanged. The `support_messages` table, indexes, RLS
policies, and realtime publication entry are already present in dev DB
from the original 005 migration; the rename is a file-system operation
only. No `DROP`, no re-`CREATE`, no functional code change. The Support
chat hooks (`useSupportChat`, `SupportListScreen`, `SupportChatScreen`)
are untouched.

**Verification.**

- `tsc` / `eslint` not re-run — no source code touched.
- `git status` after the move shows only: `R supabase/migrations/005_…sql → …sql.bak`, plus the new `add-support-messages.sql`, plus the README edit. No code files modified.

**Reconcile when.** Ryan ships an official support_messages schema, OR
`schema/add-support-messages.sql` is promoted into the numbered
`migrations/` sequence (e.g. as `006_support_messages.sql`) at which point
the `.bak` can be deleted.
