# VXO Vendor App

React Native + Expo mobile app for VXO field service vendors. Subcontracted
build by Expand Matrix s.r.o. for VXO AI LLC.

## Stack

- **Expo SDK 54** / **React Native 0.81.5** / **React 19.1**
- **expo-router 6** — file-based routing under [`app/`](app/)
- **Supabase JS 2.105** — Auth (email OTP), Postgres + RLS, Realtime, Storage, RPCs
- **TypeScript** (strict, `@/*` → `src/*`)
- **React Hook Form 7.75** + **Zod 4.4**
- **expo-notifications** (push), **expo-location** (GPS arrival), **expo-image-manipulator** (photo compression), **expo-secure-store**, **expo-local-authentication** (PIN / Face ID / fingerprint)
- **lucide-react-native** icons, **@tanstack/react-query**, **zustand**

Bundle IDs: `com.vxo.vendor` (iOS + Android). EAS project: `62c24a18-e6f8-442c-bfe4-f0ecfab4907a`.

## Repo layout

```
app/                       Expo Router routes
  (public)/                welcome, login, OTP, sign-up, lets-you-in, fill-profile
  (tabs)/                  chats home (index.tsx), profile, support
  (authed-no-tabs)/        setup-pin, setup-biometric, unlock
  job/[id]/                job chat screen
  learn-more/              learn-more landing
  _layout.tsx              root layout (auth gate, push handler wiring)
src/
  features/                feature-scoped UI + hooks
    auth/                  EmailAuthForm, OTPInput, FingerprintHero, CongratsModal
    chats/                 ChatsScreen + tab strip, OOO toggle/banner, jobs list/realtime
    chat/                  JobChatScreen + composer + completion sheet + arrival detection
    profile/               ProfileScreen, AvatarPicker, TradeServicesPicker, UploadField
    support/               support chat list + thread
    home/                  HomeTab (currently behind a flag in tabs)
    search/                SearchScreen + results hook
    learnMore/             LearnMore landing components
    jobs/, invoice/,
    earnings/              (empty placeholders — future work)
  hooks/                   useVendor, useVendorRealtime, useVendorStatusToast,
                           useVendorLocation, useNotificationToken, useCountdown
  lib/                     supabase client, vendorCache, vendorStorage, jobPhotos,
                           notifications, geo, biometric, pinStore, auth, uploadError,
                           appReady, queryClient, supportReadState, mock* (dev fixtures)
  components/              shared UI (FillProfile, AttachmentBottomSheet, ...)
  types/                   database.ts (generated), pushPayload.ts (Zod)
  theme/                   colors, spacing, typography, shadows
supabase/
  migrations/              numbered baseline schema (see supabase/migrations/README.md)
  schema/                  vendor-app additive SQL staged for prod (see supabase/schema/README.md)
  seed.sql                 manual dev seed
docs/
  push-notifications-audit.md
  schema-cleanup-notes.md
scripts/                   Figma pull (icons/screens/tokens/manifest/emoji), illustration builder
assets/                    icons, splash, fonts
app.json, app.config.js    Expo config (plugins, permissions, iOS UIBackgroundModes)
eas.json                   EAS build profiles (development, preview, production)
```

## Setup

1. **Prerequisites** — Node 20+, npm, Xcode (iOS dev), Android Studio (Android dev), Expo account (for EAS).
2. **Install** — `npm install`.
3. **Env vars** — copy `.env.example` to `.env` and fill:
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   EXPO_PUBLIC_APP_ENV=development
   ```
4. **Dev workflow** — `npm start`, then open in an **EAS development build** (not Expo Go — this app uses native modules: push notifications, secure store, biometrics, FCM). See [EAS build](#eas-builds) below.

## Features

Verified against current code on branch `hardening-vendors-rls`.

### Auth & onboarding (Phase 1)

- Email OTP auth — [src/features/auth/EmailAuthForm.tsx](src/features/auth/EmailAuthForm.tsx) + [OTPInput.tsx](src/features/auth/OTPInput.tsx), resend countdown via [useCountdown.ts](src/hooks/useCountdown.ts).
- FillProfile — [src/components/FillProfile.tsx](src/components/FillProfile.tsx). Three sections (Personal Info / Service Area / Business), 9 fields, phone mask, 5-digit ZIP validation, trades multi-select. Two-step submit: upsert vendor row → upload avatar/COI/W-9 to Storage scoped by `vendor.id` → update row with returned paths. Pre-flight existence check so re-entry preserves `status` (Phase 2.5).
- PendingStatusBanner + status toast — [src/features/chats/PendingStatusBanner.tsx](src/features/chats/PendingStatusBanner.tsx), [src/hooks/useVendorStatusToast.ts](src/hooks/useVendorStatusToast.ts). Reacts to `vendors.status` Realtime updates.
- ProfileScreen — [src/features/profile/ProfileScreen.tsx](src/features/profile/ProfileScreen.tsx). Editable Phase 1 fields, `isDirty` Save button, optimistic cache update via `setCachedVendor`.

### Chats + Jobs (Phase 2)

- ChatsScreen with Realtime — [src/features/chats/ChatsScreen.tsx](src/features/chats/ChatsScreen.tsx), [useJobsList.ts](src/features/chats/useJobsList.ts), [useJobsRealtime.ts](src/features/chats/useJobsRealtime.ts).
- OOO pill toggle + banner with cross-device Realtime sync — [OOOToggle.tsx](src/features/chats/OOOToggle.tsx), [OOOBanner.tsx](src/features/chats/OOOBanner.tsx), [useToggleOOO.ts](src/features/chats/useToggleOOO.ts).
- Job chat — [src/features/chat/JobChatScreen.tsx](src/features/chat/JobChatScreen.tsx), Realtime via [useJobChatRealtime.ts](src/features/chat/useJobChatRealtime.ts), composer [JobChatComposer.tsx](src/features/chat/JobChatComposer.tsx), auto-scroll on new messages.
- Accept / Decline + full job detail — urgency badge, dispatch fee, customer first name (header popover).
- GPS arrival detection — [useArrivalDetection.ts](src/features/chat/useArrivalDetection.ts). Flips `en_route` → `on_site` within 0.5 mi of job coords; runs on mount + background→active transitions. Manual "I've arrived" card is the always-visible fallback.
- Photo upload completion flow — [src/lib/jobPhotos.ts](src/lib/jobPhotos.ts), [JobCompletionSheet.tsx](src/features/chat/JobCompletionSheet.tsx). Compress to 1920px wide @ 0.8 JPEG quality before upload, 1–5 photos, server bucket cap 10 MB.

### Phase 2.5 — Hardening

- Vendors RLS — per-action policies (SELECT/INSERT/UPDATE), default-deny DELETE, BEFORE UPDATE triggers for status guard and email immutability. SQL: [supabase/schema/harden-vendors-rls.sql](supabase/schema/harden-vendors-rls.sql).
- FillProfile pre-flight check so re-running onboarding for an already-active vendor doesn't trip the status guard ([FillProfile.tsx:293](src/components/FillProfile.tsx:293)).

### Support chat

- Vendor ↔ admin thread, two thread types (`current_job` + `general`), Realtime — [src/features/support/](src/features/support/), schema [supabase/schema/add-support-messages.sql](supabase/schema/add-support-messages.sql).

### Push notifications

- Token registration + rotation + sign-out clear — [src/hooks/useNotificationToken.ts](src/hooks/useNotificationToken.ts), persists to `vendors.expo_push_token`.
- Foreground display config + tap-routing + cold-start handling — [src/lib/notifications.ts](src/lib/notifications.ts).
- Payload contract (Zod) — [src/types/pushPayload.ts](src/types/pushPayload.ts): `new_job`, `account_approved`, `client_message`, `invoice_approved`, `payment_received`.
- iOS background mode `remote-notification` declared in [app.json:14-18](app.json).
- Android FCM file wired via `expo.android.googleServicesFile` + env-overridable in [app.config.js](app.config.js).

### Security / device

- PIN setup + unlock — [src/lib/pinStore.ts](src/lib/pinStore.ts), [app/(authed-no-tabs)/setup-pin.tsx](app/(authed-no-tabs)/setup-pin.tsx).
- Biometric unlock (Face ID / fingerprint) — [src/lib/biometric.ts](src/lib/biometric.ts), permission string in [app.json:58-62](app.json).
- Secure storage via `expo-secure-store`.

## Build (EAS)

Profiles in [eas.json](eas.json):

| Profile | Distribution | Android | Channel |
|---|---|---|---|
| `development` | internal | APK + dev client | development |
| `preview` | internal | APK | preview |
| `production` | (store) | (default) | production, autoIncrement |

Common commands:

```
eas build --profile development --platform android
eas build --profile development --platform ios
eas build:list
```

App version source is **remote** (`cli.appVersionSource: "remote"`), so version bumps happen in EAS, not in `app.json`.

The `GOOGLE_SERVICES_JSON` env var (set in EAS project secrets) overrides the local committed `google-services.json` at build time — see [app.config.js](app.config.js).

## Database (Supabase)

Two SQL directories with distinct roles:

- [`supabase/migrations/`](supabase/migrations/README.md) — numbered baseline schema (dev-only reconstruction of Ryan's eventual prod schema) + RLS + storage/realtime.
- [`supabase/schema/`](supabase/schema/README.md) — vendor-app additive SQL staged for prod apply (extensions, RPCs, hardening).

Full apply order, current files, and dev/prod workflow are documented in those two READMEs.

## Design

Canonical design source: [VXO Vendor App V.1 Final (Figma)](https://www.figma.com/design/BOenpimP099TBsGHwgLmxD/VXO-Vendor-App-V.1-Final?node-id=0-1&t=y7OxXbgEgj6eXOGV-1).

Figma pull scripts (icons / screens / tokens / manifest / emoji / inventory) are in [`scripts/`](scripts/) and exposed via `npm run figma:*`.

## Phase 4 status

In progress. Recently shipped:

- Shared `EmptyState` + `Skeleton` primitives ([src/components/EmptyState.tsx](src/components/EmptyState.tsx), [src/components/Skeleton.tsx](src/components/Skeleton.tsx)) — replace three one-off empty states and two inline skeletons across Home, Search, Profile, and JobChat.
- Version info in Settings — `Application.nativeApplicationVersion` + `nativeBuildVersion` from `expo-application`, read at runtime so EAS remote-versioned builds report the actual installed version ([app/settings.tsx](app/settings.tsx)).
- `LICENSE` file at repo root (proprietary, per VXO AI LLC subcontract).
- Welcome-screen padding fix on `JobsWelcome` (Phase 3 carryover: `paddingVertical` / `gap` reduced from 60 → 32).

Pending:

- **Stripe Connect** — onboarding WebView blocked on backend account-link endpoint ([ChatsScreen.tsx:41](src/features/chats/ChatsScreen.tsx:41)).
- **Notification preferences UI** — blocked on schema design call with Ryan.
- **Account deletion flow** — blocked on soft-vs-hard delete decision.
- **Privacy policy + EULA URL links** — pending policy URLs.
- **E2E testing** — blocked on FCM server key + iOS Distribution Cert (carried from Phase 1).
- **`supabase gen types typescript`** — `src/types/database.ts` Functions block is still hand-maintained; regen on next CLI session (see comment in file).

## Open external dependencies

State as of 2026-05-18 — verify before relying on:

- **FCM server-side service account key** — blocked on Ryan's org policy override (Workspace org policy disallows service-account key creation by default). Tracked in [docs/push-notifications-audit.md](docs/push-notifications-audit.md). Token registration / Android FCM file is wired and shipped; outbound sends are blocked until the key lands.
- **iOS APNs / Apple Distribution credentials** — Apple Distribution Cert is provisioned via EAS. Check current build status with `eas build:list` rather than trusting any README claim.
- **`accept_job` RPC ETA-picker extension** — current `accept_job` ([supabase/schema/add-job-transition-rpcs.sql](supabase/schema/add-job-transition-rpcs.sql)) doesn't accept an ETA argument. Phase 2 ETA picker is on hold until the RPC signature is extended.
- **Several SQL files awaiting prod apply** — full list in [supabase/schema/README.md](supabase/schema/README.md). Ryan applies on prod from his platform repo's migrations directory.

## Contact

Subcontracted build for VXO AI LLC. Repo: [github.com/jakub2929/vxo_vendor_app](https://github.com/jakub2929/vxo_vendor_app).
