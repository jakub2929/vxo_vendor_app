# Progress — VXO Vendor App

Working document tracking Phase 1 → Phase 3 deliverables. Last updated: 2026-05-19.

## Phase 1 — Auth, Onboarding, Profile (Week 1)

### Shipped

- **Auth** — Supabase email OTP, session persistence (SecureStore native / localStorage web), `autoRefreshToken`, RLS via `email = auth.jwt()->>'email'` ([src/lib/supabase.ts](src/lib/supabase.ts), [src/lib/auth.ts](src/lib/auth.ts))
- **Welcome + OTP screens** — auto-advance OTP input, 50s resend countdown ([app/(public)/otp.tsx:20](app/(public)/otp.tsx:20), [useCountdown.ts](src/hooks/useCountdown.ts))
- **FillProfile (merged Personal Info + Company Details)** — single screen with three sections ([src/components/FillProfile.tsx](src/components/FillProfile.tsx)):
  - Personal Info: Full Name, Email (read-only), Phone (10-digit US mask, stored digits-only), Bio
  - Service Area: Street Address, ZIP Code (5-digit)
  - Business: Business Name, Trade & Services (multi-select)
  - Optional: COI upload, W-9 upload
  - Zod validation: phone refine to 10 digits, ZIP regex `^\d{5}$`, address `trim().min(3)`, name/business `min(2)`, trades `min(1)`
- **Vendors row insert** — upsert with `onConflict: 'email'`, `status='pending'` on fresh insert, status preserved on re-entry via pre-flight existing-row check ([FillProfile.tsx:293-326](src/components/FillProfile.tsx:293))
- **Application Submitted refactor** — banner + 3s success state replaces dedicated screen (Ryan signoff)
- **Approved Welcome refactor** — toast + Realtime auto-banner-removal replaces dedicated screen (Ryan signoff)
- **Profile screen** — editable Name / Phone / Address / ZIP / Business / Trades / Bio; Email read-only; `isDirty` save gating; optimistic cache update; toast on success; Alert only on error ([src/features/profile/ProfileScreen.tsx](src/features/profile/ProfileScreen.tsx))
- **Bottom navigation** — Stack (not Tabs) per Figma layout (Ryan signoff, accepted divergence from contract)
- **Avatar / COI / W-9 picker stability** — fixed stale picker state, document picker race condition, avatar URL cache-busting via `updated_at` query param
- **Push token wiring** — Expo push token registration + rotation listener + sign-out clear ([useNotificationToken.ts](src/hooks/useNotificationToken.ts)); Zod payload schema for `new_job` / `client_message` / `invoice_approved` / `payment_received` / `account_approved` ([src/types/pushPayload.ts](src/types/pushPayload.ts))
- **Build infra** — `google-services.json` wired via [app.config.js](app.config.js) (env-overridable); iOS `UIBackgroundModes: remote-notification` in [app.json:14-18](app.json); Apple Distribution Cert generated via EAS

### Pending (external dependencies)

- **`add-vendors-to-realtime.sql`** — staged in [supabase/schema/](supabase/schema/add-vendors-to-realtime.sql), needs prod apply by Ryan (approved-state banner removal depends on it)
- **FCM service account key** — blocked on Ryan's org policy override (Google Cloud `iam.managed.disableServiceAccountKeyCreation` constraint); see [docs/push-notifications-audit.md](docs/push-notifications-audit.md)
- **iOS push delivery** — blocked on `.ipa` build + APNs cert

## Phase 2 — Chats, Job Flow, Chat Screen (Week 2)

### Shipped

- **Chats home screen** — renders job list filtered by `assigned_vendor_id`, sorted by `updated_at desc`, excludes closed/cancelled ([src/features/chats/ChatsScreen.tsx](src/features/chats/ChatsScreen.tsx), [useJobsList.ts](src/features/chats/useJobsList.ts))
- **Jobs Realtime subscription** — `postgres_changes` on `jobs` table, live updates without manual refresh ([useJobsRealtime.ts](src/features/chats/useJobsRealtime.ts))
- **OOO toggle** — green / red pill in ChatsHeader; indigo banner with 🌙 on Jobs tab; optimistic cache update via `setCachedVendor`; confirmation Alert on enabling; Realtime cross-device sync via vendors publication (pending prod apply of SQL) ([OOOToggle.tsx](src/features/chats/OOOToggle.tsx), [OOOBanner.tsx](src/features/chats/OOOBanner.tsx), [useToggleOOO.ts](src/features/chats/useToggleOOO.ts))
- **AuthGate** — treats `out_of_office` same as `active` (vendor not kicked back to pending) ([app/_layout.tsx:116](app/_layout.tsx:116))
- **Accept/Decline screen** — full job detail rendering ([src/features/chat/JobChatScreen.tsx](src/features/chat/JobChatScreen.tsx)):
  - Job title / trade / description
  - Address (full, formatted)
  - Urgency badge (Emergency / Same-day / Scheduled)
  - Dispatch fee (rendered as `💵 Dispatch fee $XX.XX`, null-skip)
  - Customer first name (derived client-side from `client_name`, rendered as `👤 Customer {first}`, null-skip) ([buildTimeline.ts:169,356-359](src/features/chat/buildTimeline.ts:169))
  - Accept RPC: `accept_job(p_job_id)` — status `offered` → `accepted` ([JobChatScreen.tsx:248](src/features/chat/JobChatScreen.tsx:248))
  - Decline RPC: `reject_job(p_job_id)` — status `offered` → `declined` ([JobChatScreen.tsx:267](src/features/chat/JobChatScreen.tsx:267))
- **Chat screen** — `useJobChat` + `useJobChatRealtime` for live message updates; sender enum (vendor / client / admin / alfred / system) rendered with distinct styling; insert flow via composer
- **Auto-scroll** — flatListRef + atBottomRef tracking; `onContentSizeChange` triggers `scrollToEnd` only when user is near bottom (80px threshold); preserves scroll position when reading history
- **GPS arrival detection** — `useArrivalDetection` watches device location, fires `mark_on_site` when within 0.5 mi (haversine), AppState foreground gate for battery; eligible statuses `['en_route', 'accepted']` ([useArrivalDetection.ts](src/features/chat/useArrivalDetection.ts))
- **Directions tap** → status `accepted` → `en_route` via `start_travel` RPC ([JobChatScreen.tsx:294](src/features/chat/JobChatScreen.tsx:294))
- **Manual "I've arrived" card** — action visible in both `accepted` and `en_route` status sets (fallback for missed GPS auto-detect)
- **System message on arrival** — "📍 Arrived on site" inserted client-side
- **Photo upload completion flow** — camera + gallery + files via `expo-image-picker` + `expo-document-picker`; 1920px compression at 0.8 quality via `expo-image-manipulator`; min 1 / max 5 photos; 3-column grid preview; `complete_job(p_job_id, p_photo_ids)` RPC ([JobChatScreen.tsx:363](src/features/chat/JobChatScreen.tsx:363)); storage bucket with 10 MB limit + JPEG/PNG/WEBP allowlist + vendor DELETE policy ([src/lib/jobPhotos.ts](src/lib/jobPhotos.ts), [supabase/schema/add-job-photos-storage.sql](supabase/schema/add-job-photos-storage.sql))

### Pending (external dependencies + scope)

- **ETA picker UI + RPC params** — contract-mandatory, blocked on Ryan's `accept_job` RPC extension (needs `p_eta_label TEXT` + `p_eta_datetime TIMESTAMPTZ`). Effort ~2–3 h client-side once RPC is ready.
- **SQL files awaiting prod apply by Ryan:**
  - [`widen-mark-on-site-source-statuses.sql`](supabase/schema/widen-mark-on-site-source-statuses.sql) — widens RPC source set to include `accepted` (manual arrival)
  - [`add-job-photos-storage.sql`](supabase/schema/add-job-photos-storage.sql) — storage bucket cap + RLS DELETE policy
  - [`add-complete-job-rpc.sql`](supabase/schema/add-complete-job-rpc.sql) — completion RPC
- **FCM key + iOS push** — same as Phase 1 push delivery dependencies

## Phase 2.5 — Security hardening (extracted from Phase 2 audit)

### Shipped

- **Vendors RLS hardening** — [supabase/schema/harden-vendors-rls.sql](supabase/schema/harden-vendors-rls.sql):
  - Replaces FOR ALL `vendor_own` with per-action policies (SELECT / INSERT / UPDATE)
  - DELETE blocked (no policy = default deny)
  - BEFORE UPDATE trigger `vendor_status_change_guard` restricts status changes to `active <-> out_of_office` only (vendor self-promotion blocked)
  - BEFORE UPDATE trigger `vendor_email_immutable_guard` blocks email changes (RLS identity protection)
  - Both triggers bypass via service_role JWT for admin operations
  - Applied on dev — verify on hardware that OOO toggle still works post-apply; pending prod apply by Ryan
- **FillProfile pre-flight check** — detects existing vendor row via `maybeSingle()` before upsert; omits `status` from payload if row exists; prevents accidental `active → pending` revert that would trigger the new status guard ([FillProfile.tsx:293-326](src/components/FillProfile.tsx:293))

### Pending

- **`job_messages` RLS hardening** — vendor can currently INSERT with `sender='system'` (system-message spoof on the client-inserted "Arrived on site" path). Fix requires server-side RPC for arrival message + client refactor. Deferred pending Ryan's RPC change.

## Phase 3 — Earnings + Invoice/Quote builders (Week 3, ~90% complete)

### Shipped

- **Invoice + Quote builders** — vendor-side composers wired to `send_invoice` / `send_quote` RPCs, mock-aware ([app/job/[id]/invoice.tsx](app/job/[id]/invoice.tsx), [app/job/[id]/quote.tsx](app/job/[id]/quote.tsx)). Shared `LineItemsInput` component; quote adds preset-chip expiry row (7d / 14d / 30d / none).
- **Client info in builder header** — full client first name + address rendered as subtitle below the title, formal em-dash heading copy. Uses `useJob(id)` shared with the chat screen (warm cache, no extra fetch). First-name-only per chat privacy contract; `firstNameOf` helper exported from `buildTimeline.ts` so all three consumer surfaces share it.
- **Earnings sections in Home tab** — three sections (Paid invoices / Pending invoices / Pending quotes), per-section totals, drill-down on tap → job chat where the invoice/quote bubble lives. Pull-to-refresh invalidates the whole `'earnings'` key group ([src/features/earnings/](src/features/earnings/)).
- **Month-scoped Home stats** — Home summary card shows "earned this month" + "jobs count this month" ([useHomeData.ts](src/features/home/useHomeData.ts)).
- **2-line `HomeJobRow`** — Job# (bold primary) + status + first-name on a muted second line; amount color reflects invoice status (green/blue/red/gray per Ryan's palette). Amount dropped from the title to avoid overflow on standard mobile widths.
- **`useInvoicesRealtime` hook** — invoices stripped out of `useHomeRealtime` into a dedicated channel; lets invoice cache invalidate independently of jobs ([useInvoicesRealtime.ts](src/features/realtime/useInvoicesRealtime.ts)).
- **Aggregation fixes** — Home + Jobs paddingBottom no longer stacks on SafeAreaView inset; latest-invoice amount surfaced on each HomeJobRow.
- **Shared invoice status colors** — three palettes consolidated into [src/theme/invoiceStatusColors.ts](src/theme/invoiceStatusColors.ts) (`INVOICE_STATUS_BADGE`, `QUOTE_STATUS_BADGE`, `INVOICE_AMOUNT_COLOR`); chat bubble, earnings card, and home row all import from there. Tables intentionally separate — they encode different design intents (loud badge red vs. soft row gray for terminal states) but live side-by-side for visibility.

### Pending (external dependencies)

- **Quote → Invoice conversion** — blocked on Ryan's RPC side (`convert_quote_to_invoice` or equivalent). Client surface ready to wire as soon as RPC contract lands.
- **ETA picker UI** — still blocked on Ryan's `accept_job` extension (carried over from Phase 2).

## Phase 4 — Settings + payouts (Week 4 scope, ~30% surface plumbed)

### Already in place

- **Sign-out** — wired via `MoreMenu` in ChatsHeader ([src/features/chats/MoreMenu.tsx](src/features/chats/MoreMenu.tsx)); session cleared from SecureStore + push token revoked.
- **Settings shell** — `/settings` route mounts; menu rows pre-stubbed pending Phase 4 spec finalization.
- **Stripe Connect placeholder** — `handleStripe` in ChatsScreen logs intent; awaiting backend endpoint to mint the account link before WebView wiring ([ChatsScreen.tsx:41-44](src/features/chats/ChatsScreen.tsx:41)).

### Not started

(rest of Phase 4 scope — finalize as spec arrives)

## Known issues / minor

- **RPC naming inconsistency** — contract says `decline_job` / `mark_en_route`, code calls `reject_job` / `start_travel` (same behavior, Ryan's existing names — see [supabase/schema/add-job-transition-rpcs.sql](supabase/schema/add-job-transition-rpcs.sql))
- **Job UUID prefix collision in seeded mocks** — all `a1234567-…` causes Job# display ambiguity; cosmetic only (dev seed data, [seed-jobs-for-smoke-test.sql](supabase/schema/seed-jobs-for-smoke-test.sql))
- **`job_messages` RLS gap** — see Phase 2.5 pending

## External tracker (Ryan's side)

- ✅ Apple Admin role granted (iOS Distribution Cert ready)
- ⏳ FCM service account key (org policy override in progress)
- ⏳ `accept_job` RPC extension (blocks ETA picker)
- ⏳ SQL files in [`supabase/schema/`](supabase/schema/) awaiting prod apply
- ⏳ iOS `.ipa` build (in EAS queue or done — check `eas build:list`)

## Out of scope (clarifications)

- **Profile screen with edit support** — contract Phase 4 explicitly says this is Week 4; shipped early as part of Phase 1 onboarding (vendor needs to edit phone / address / ZIP)
- **Bottom navigation** — contract says 3-tab Tabs layout; Figma supersedes with Stack pattern (Ryan signoff)
- **Application Submitted screen** — contract says dedicated screen; refactored to banner + success state (Ryan signoff)
- **Approved Welcome screen** — contract says dedicated screen; refactored to toast + Realtime banner removal (Ryan signoff)

---

This file is updated as Phase work progresses. Last updated: 2026-05-19.
