# Phase 5 — Hardware Test Plan

Last updated: 2026-05-26. Companion to the Phase 5A code merge on
`merging-DB-schema`.

## Goals

Verify that the vendor app, built from `merging-DB-schema`, reads and
writes correctly against a Supabase project running Ryan's prod schema
(`baspxigjzkrotqxmpygf`) plus the additive columns in
[supabase/refract/](supabase/refract/).

Out of scope for this pass:

- The five blocked transition RPCs (Batch F stubs them). Re-run the
  Action card test once Ryan's reissue lands.
- GPS auto-arrival (location_lat/lng dropped — disabled until coords
  return).
- Server-side client-name search (Option B is in place; full coverage
  blocked on `search_jobs` RPC).

## Setup

1. Use a development Supabase project that mirrors Ryan's prod baseline.
   The additive SQL files in [supabase/refract/](supabase/refract/) must
   already be applied (verified live for the prod project on 2026-05-21
   per the investigation report).
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to
   the dev project values in `.env.local`.
3. Set `EXPO_PUBLIC_FORCE_REAL_DATA=1` to bypass `USE_MOCKS` for every
   tested flow.
4. `npx expo start --tunnel`, scan with Expo Go on a physical device
   (push tokens + FCM require a real device).

## Seed data

Run via the Supabase dashboard SQL editor against the dev project.
Replace `<auth_uid>` with the authenticated test vendor's `auth.users.id`.

```sql
-- 1. Vendor profile
insert into vendor_profiles (id, user_id, name, email, phone, business_name, state, city, zipcode, service_categories, radius_miles, insured, status)
values (
  gen_random_uuid(), '<auth_uid>',
  'Test Vendor', '<authed-email>', '5555550100',
  'Test HVAC Co', 'AB', 'Edmonton', 'T5K2J9',
  array['hvac','plumbing'], 25, true, 'active'
)
returning id;
-- copy the returned id into <vendor_id> below.

-- 2. Test client (auth.users.id distinct from vendor's)
insert into profiles (id, first_name, last_name, email, phone)
values ('11111111-1111-4000-8000-000000000001', 'Sarah', 'Mitchell',
        'sarah.test@example.com', '5555550101');

-- 3. Three test requests covering pending / in_progress / completed
insert into vendor_requests (id, client_id, service_type, description, location, zipcode, priority, status, eta_label, eta_datetime)
values
  ('22222222-2222-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001',
   'hvac', 'No-heat call — furnace not igniting.',
   '912 Jasper Ave, Edmonton AB', 'T5K1V3', 'High', 'pending',
   'ETA 25 min', now() + interval '30 minutes'),
  ('22222222-2222-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001',
   'plumbing', 'Leaking kitchen faucet — replace cartridge.',
   '4220 Whyte Ave, Edmonton AB', 'T6E2A8', 'Medium', 'in_progress',
   'Tomorrow, 9:00 AM', now() + interval '1 day'),
  ('22222222-2222-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001',
   'handyman', 'Replaced two rotted deck boards.',
   '231 Glenora Cres, Edmonton AB', 'T5N3W4', 'Low', 'completed',
   'Completed', now() - interval '5 days');

-- 4. Per-vendor associations (M2M)
insert into request_vendors (request_id, vendor_id, job_status)
values
  ('22222222-2222-4000-8000-000000000001', '<vendor_id>', 'pending'),
  ('22222222-2222-4000-8000-000000000002', '<vendor_id>', 'in_progress'),
  ('22222222-2222-4000-8000-000000000003', '<vendor_id>', 'completed');

-- 5. A couple of messages for the in_progress request
insert into job_messages (request_id, sender, message)
values
  ('22222222-2222-4000-8000-000000000002', 'alfred', 'Leaking faucet at 4220 Whyte Ave. Client home.'),
  ('22222222-2222-4000-8000-000000000002', 'vendor', 'On my way. ETA 25 min.');
```

## Test scenarios

### S1 — Sign-in + vendor profile load

- **Action:** Sign in with the test vendor's email.
- **Expected:** Tabs land on Home; Profile tab shows the seeded
  vendor_profile values. ProfileScreen prefills state / city / zipcode
  separately, not a single address field.
- **Verifies:** Batches A (auth + types), B (vendor reads), C (form
  shape).

### S2 — Push token registration

- **Action:** Allow the OS push prompt on first launch.
- **Expected:** A row appears in `device_tokens` for
  `(user_id=<auth_uid>, platform='ios'|'android')` with a non-empty
  token. Cold-launch a second time: only the timestamp changes (upsert,
  no duplicate row).
- **Verifies:** Batch A — `useNotificationToken` upsert + onConflict.

### S3 — Sign-out clears device token

- **Action:** From Settings → Sign out.
- **Expected:** The `device_tokens` row for this `(user_id, platform)`
  is gone. Re-sign-in re-inserts.
- **Verifies:** Batch A — `auth.signOut` device_tokens delete.

### S4 — Profile edit save

- **Action:** Edit state / city / zipcode in ProfileScreen, change the
  insured toggle, tap Save.
- **Expected:** `vendor_profiles` row reflects the new values; banner
  refreshes immediately (optimistic cache write). The form's "Save"
  button greys out once the new values become the clean baseline.
- **Verifies:** Batch C — `vendor_profiles` write path + Zod schema.

### S5 — Trades picker writes service_categories

- **Action:** Open Trade & Services, toggle two categories, save.
- **Expected:** `vendor_profiles.service_categories` is a `text[]`
  with the selected slugs (e.g. `{hvac,plumbing}`). Refresh re-prefills
  the same selection.
- **Verifies:** Batch C — `trades` → `service_categories` mapping.

### S6 — Home recent jobs feed

- **Action:** Open Home tab.
- **Expected:** The seeded three requests appear, newest first. The
  pending one shows "🆕 New", the in_progress one shows "👍 Accepted",
  the completed one shows "✅ Complete". Client name displays as
  "Sarah Mitchell" on each card.
- **Verifies:** Batch D — `useHomeRecentJobs` M2M query + client embed
  + status label remap.

### S7 — Jobs list

- **Action:** Switch to the Jobs strip.
- **Expected:** Pending + in_progress + completed all visible.
  Cancelled (if you insert one) is hidden.
- **Verifies:** Batch D — `useJobsList` filter on
  `request_vendors.job_status != 'cancelled'`.

### S8 — Job chat detail

- **Action:** Tap the in_progress row.
- **Expected:** Header shows the formatted job number. Location info
  card reads "4220 Whyte Ave, Edmonton AB" (no distance line — coords
  dropped). Customer first name "Sarah". WO card shows "Plumbing" trade,
  description. SLA banner reads "4 Hour" (Medium priority). Bubbles from
  Alfred and the vendor render in order. Action card row shows
  Directions + Manual arrival + Invoice/Quote/Questions buttons (in_progress).
- **Verifies:** Batch D — synthetic Job, buildTimeline field renames,
  status enum remap; Batch E — chat realtime channel.

### S9 — Send a chat message

- **Action:** Type "Test from device" in the composer, send.
- **Expected:** Bubble appears immediately. A row lands in `job_messages`
  with `request_id=<id>`, `sender='vendor'`, `message='Test from device'`.
  Realtime invalidation re-fetches; no double bubble.
- **Verifies:** Batch D (write) + Batch E (realtime filter on
  `request_id=eq.<id>`).

### S10 — Action card stubs

- **Action:** From the pending request, tap Accept. Then tap Reject.
- **Expected:** Each tap surfaces an Alert with "Coming soon" copy
  referencing the dispatch system. No DB writes.
- **Verifies:** Batch F — all five RPC call sites stubbed.

### S11 — Get Directions opens Maps

- **Action:** From the in_progress request, tap Get Directions.
- **Expected:** Alert appears ("On the way" copy), then the OS Maps app
  opens with the location string as the destination. No DB write to
  `request_vendors.job_status`.
- **Verifies:** Batch D (openMapsForJob field swap) + Batch F (status
  flip suppressed).

### S12 — Complete Job sheet

- **Action:** From the in_progress request, tap Complete Job, attach 1
  photo, tap Mark Complete.
- **Expected:** Photo uploads to Storage. Alert appears ("Coming soon"
  copy). The sheet closes; `request_vendors.job_status` stays
  `in_progress`.
- **Verifies:** Batch F — completion stub keeps the upload path but
  blocks the RPC.

### S13 — Search

- **Action:** Open Search, type "whyte".
- **Expected:** The in_progress request appears (matches location).
  Type "Sarah" → all three requests appear (matches client name via
  post-filter).
- **Verifies:** Batch D — `useSearchResults` Option B post-filter.

### S14 — Earnings tab

- **Action:** Seed an invoice for the completed request, status='paid'.
  Open Earnings.
- **Expected:** The card shows "$<total>", client name "Sarah Mitchell",
  trade "Handyman".
- **Verifies:** Batch D — earnings join shape +
  `clientNameFromRow`/`serviceTypeFromRow` helpers.

### S15 — Notification prefs

- **Action:** Settings → toggle a notification pref.
- **Expected:** `vendor_profiles.notification_prefs` updates; Switch
  state persists across kill/relaunch.
- **Verifies:** Batch C — `useNotificationPrefs` write to
  `vendor_profiles`.

### S16 — OOO toggle

- **Action:** From the Chats header, flip the OOO toggle on, then off.
- **Expected:** `vendor_profiles.status` flips between `out_of_office`
  and `active`; banner state matches.
- **Verifies:** Batch C — `useToggleOOO` write target.

## Known limitations (Phase 5B / 5C)

- **Action card transitions** (S10, S11, S12) only surface "Coming
  soon" copy until Ryan reissues the five RPCs. Track in
  [PROGRESS.md](PROGRESS.md#phase-5b--pending-ryan).
- **GPS auto-arrival** (`useArrivalDetection`) is permanently no-op
  in this build until coords return to `vendor_requests`.
- **Distance label** in JobRow + the SLA banner shows "—" / no suffix
  for the same reason.
- **Client-name search** capped at 50 server-pre-filtered rows; rare
  edge case where a vendor has 50+ matching jobs by location and an
  additional client-name-only match exists beyond the cap will miss
  it. Lift in Phase 5C with `search_jobs` RPC.
- **PM contact card** falls back to mock PM data in real mode (Ryan's
  `project_managers` table doesn't exist yet).
- **`info_card_wo.dispatchFee`** renders null until Ryan exposes a
  replacement column.
- **Push payload `urgency`** field accepts both legacy and new values
  during Alfred's rollout window — narrow once cutover is done.
