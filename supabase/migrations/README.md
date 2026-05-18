Supabase Dev Migrations — VXO Vendor App

These SQL files are a DEV-ONLY reconstruction of the Supabase schema used by the VXO Vendor App. They are not the official schema and are meant to be disposable.

Key points:

- **Not official:** The authoritative schema will be provided by Ryan (the client). When that official schema arrives, `001_alfred_tables_DEV_ONLY.sql` should be discarded and replaced by Ryan's schema.
- **Survivable migrations:** `002_ryan_email_migrations.sql`, `003_rls_policies.sql`, and `004_storage_realtime.sql` are written to be additive and to survive replacement of the core tables. They are idempotent and safe to re-run.
- **Run order:** Run the files in this order when provisioning a dev DB: `001_alfred_tables_DEV_ONLY.sql` → `002_ryan_email_migrations.sql` → `003_rls_policies.sql` → `004_storage_realtime.sql`.
- **When official schema arrives:** Drop the dev DB (or start a fresh DB), run Ryan's official schema, then run **only** `002_ryan_email_migrations.sql`, `003_rls_policies.sql`, and `004_storage_realtime.sql` (skip `001_alfred_tables_DEV_ONLY.sql`).
- **Manual steps:** `supabase/seed.sql` is a manual dev-only seed. Create an auth test user in the Supabase Auth dashboard matching the seed email before running the seed.

Purposefully conservative rules:

- All statements are non-destructive and idempotent where possible (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`).
- No `DROP TABLE` or `DROP DATABASE` statements are included.

Notes for reviewers:

- Keep `supabase-schema.sql` in the repository untouched — it is the client's source-of-truth and should not be modified or run against the dev DB.
- These migrations are designed so that RLS, storage policies, and minor additive columns will be re-appliable after replacing the core schema.
- `005_support_messages.sql.bak` is a vendor-app-side additive that has been moved to `supabase/schema/add-support-messages.sql` to match the convention used by the other vendor-app schema extensions (invoice, quote, vendor docs, etc.). The `.bak` is preserved here as evidence of the original applied migration; it is not picked up by `*.sql` provisioning globs.
