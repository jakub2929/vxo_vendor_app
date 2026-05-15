# Push Notifications — Discovery Audit (vxo-vendor-app)

Date: 2026-05-15
Scope: read-only audit of the existing push notifications implementation across the vendor app, the Next.js backend (`/app`), and Supabase (`/supabase`, `/migrations`).

This report inventories what exists, identifies gaps, and presents architecture options. **No code, schema, or config was changed.**

---

## 1. Token Registration

### Hook: `useNotificationToken`

- File: [`vxo-vendor-app/src/hooks/useNotificationToken.ts`](../src/hooks/useNotificationToken.ts)
- Lines: 1–69
- Mount point: [`vxo-vendor-app/app/(tabs)/_layout.tsx:18`](../app/(tabs)/_layout.tsx) — called once at the authed-tabs root, co-located with `useVendorLocation()`.

### Walk-through

1. **Gate** ([useNotificationToken.ts:14–17](../src/hooks/useNotificationToken.ts)) — effect runs only when `vendor?.id` resolves; effectively gated on auth + a successfully loaded vendor row. Re-fires whenever `vendor?.id` changes (account switching ⇒ new registration).
2. **Device check** ([useNotificationToken.ts:21–26](../src/hooks/useNotificationToken.ts)) — early return on simulator/emulator with a `console.warn`. No user-facing alert.
3. **Permission flow** ([useNotificationToken.ts:28–39](../src/hooks/useNotificationToken.ts)) — calls `getPermissionsAsync`, prompts via `requestPermissionsAsync` only if not already granted. Silent degradation on denial (no re-prompt, no alert).
4. **Project ID resolution** ([useNotificationToken.ts:44–50](../src/hooks/useNotificationToken.ts)) — reads `Constants.expoConfig.extra.eas.projectId` with `Constants.easConfig.projectId` as fallback. Warns and returns if missing.
5. **Token fetch** ([useNotificationToken.ts:52–58](../src/hooks/useNotificationToken.ts)) — `Notifications.getExpoPushTokenAsync({ projectId })`. Failure logged, no retry.
6. **Persistence** ([useNotificationToken.ts:60–68](../src/hooks/useNotificationToken.ts)) — `UPDATE vendors SET expo_push_token = ? WHERE id = vendorId`. Failure logged, never throws.

```ts
// useNotificationToken.ts:52–68 — token fetch + persist
token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
const { error } = await supabase
  .from('vendors')
  .update({ expo_push_token: token })
  .eq('id', vendorId);
if (error) console.error('[push] Token upload failed:', error);
```

### EAS projectId — verified

- Config: [`vxo-vendor-app/app.json:81–86`](../app.json)
- **Value: `62c24a18-e6f8-442c-bfe4-f0ecfab4907a`** (present, populated by `eas init`).
- The handoff claim "EAS projectId was flagged as a possible blocker" is **stale** — it is configured.

### Schema — `vendors.expo_push_token` exists

- Defined: [`supabase/migrations/001_alfred_tables_DEV_ONLY.sql:34`](../../supabase/migrations/001_alfred_tables_DEV_ONLY.sql)
  - `expo_push_token TEXT,` on the `vendors` table.
- Re-added defensively: [`supabase/migrations/002_ryan_email_migrations.sql:5`](../../supabase/migrations/002_ryan_email_migrations.sql)
  - `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS expo_push_token TEXT;`
- Typescript binding: [`vxo-vendor-app/src/types/database.ts:346, 370, 394`](../src/types/database.ts) — Row/Insert/Update all include `expo_push_token: string | null`.

### Behaviour summary

| Scenario | Behaviour | Notes |
|---|---|---|
| Permission denied | Silent — no token, no nag | Correct per spec |
| Token refresh (Expo rotates) | **NOT handled** — only fires on `vendor?.id` change | Gap: no `addPushTokenListener` |
| Sign-out | Token **remains in the DB** for the previous vendor row | Privacy/staleness concern |
| Account switching (same device) | New token written on next mount | OK because effect re-fires |
| Re-mount on every render | Effect deps `[vendor?.id]` — only triggers on identity change | Effectively once-per-session-per-vendor |

---

## 2. Notification Handler & Tap Routing

- File: [`vxo-vendor-app/src/lib/notifications.ts`](../src/lib/notifications.ts) — module-level side-effect import.
- Imported once at: [`vxo-vendor-app/app/_layout.tsx:10`](../app/_layout.tsx) (`import '@/lib/notifications';`).

### Foreground handler — [notifications.ts:9–16](../src/lib/notifications.ts)

```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
```

- Modernised for SDK 54 — uses `shouldShowBanner` / `shouldShowList` (not deprecated `shouldShowAlert`).
- Sound + badge + foreground banner all on. No per-notification suppression rules.

### Tap response listener — [notifications.ts:36–55](../src/lib/notifications.ts)

```ts
if (!G.__vxoPushWired) {
  G.__vxoPushWired = true;
  Notifications.addNotificationResponseReceivedListener((response) => {
    handleResponse(response.notification.request.content.data as NotificationData);
  });
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handleResponse(response.notification.request.content.data as NotificationData);
  });
}
```

- Cold-start tap **is** drained (line 49 — `getLastNotificationResponseAsync`).
- Double-subscribe guarded by `globalThis.__vxoPushWired` (Fast-Refresh-safe).
- Payload routing: [notifications.ts:23–30](../src/lib/notifications.ts) — `data.type === 'job' && data.jobId` ⇒ `router.push('/job/${jobId}')`. All other types fall through (the OS already foregrounded the app; that's the only behaviour the test button needs).

---

## 3. Realtime ↔ Push Interplay

- The vendor app handles "vendor is currently in the app" via realtime: [`vxo-vendor-app/src/hooks/useVendorStatusToast.ts`](../src/hooks/useVendorStatusToast.ts) watches `vendors.status` flipping `pending → active` and surfaces an in-app `showToast(...)`.
- A documented TODO at [useVendorStatusToast.ts:20–25](../src/hooks/useVendorStatusToast.ts) explicitly notes that the "vendor NOT in the app" case is **not yet covered**:

```ts
// TODO (Alfred / Ryan handoff): for vendors who are NOT in the app when
// approval lands, send a push notification via Expo Push API
// (POST https://exp.host/--/api/v2/push/send) to the vendor's
// expo_push_token. ... out of scope for this iteration; the in-app
// toast covers the "vendor has app open" case.
```

- **No Postgres triggers** anywhere in `supabase/migrations/` or `supabase/schema/` send pushes. The only triggers present are `set_updated_at_*` housekeeping ([001_alfred_tables_DEV_ONLY.sql:115–128](../../supabase/migrations/001_alfred_tables_DEV_ONLY.sql)).
- **No webhook hooks** (`pg_net`, `supabase_functions.http_request`, etc.) on `vendors`, `jobs`, `job_messages`, or `dispatch_log`.
- **No realtime-to-push bridge.**

---

## 4. Existing Send Infrastructure

### Vendor app

- `_debug.tsx` has a "Send test notification" button — see section 6.

### Supabase Edge Functions

- `supabase/functions/` — **does not exist** at repo root.
- `vxo-vendor-app/supabase/` — empty directory (no `functions/`, `migrations/`, or `config.toml`).
- No `supabase` CLI project is initialised in this repo.

### Next.js (`/app/api`)

Search results for `exp.host`, `expoPush`, `sendPush`, etc. across `/app`, `/lib`, `/supabase`, `/migrations`:

- **Only one outbound Expo Push call exists**: the debug button in `vxo-vendor-app/app/_debug.tsx:340`. **No server-side push send exists.**

### Adjacent (but unused-for-push) backend routes

These exist but **none of them call the Expo Push API**:

- [`/app/api/devices/route.ts`](../../app/api/devices/route.ts) — POST/DELETE for a `device_tokens` table; legacy/parallel to `vendors.expo_push_token`.
- [`/app/api/notifications/route.ts`](../../app/api/notifications/route.ts) — GET/PATCH against a `notifications` inbox table; in-app inbox only, no push fan-out.

### Parallel migrations (`/migrations` — not Supabase CLI managed)

- [`/migrations/add_device_tokens_table.sql`](../../migrations/add_device_tokens_table.sql) — creates `device_tokens(user_id, token, platform)` keyed on `auth.users.id` (not `vendors.id`).
- [`/migrations/add_notifications_table.sql`](../../migrations/add_notifications_table.sql) — creates a generic `notifications` inbox table.

**Note:** there are now **two parallel push-token schemas**:
- `vendors.expo_push_token TEXT` (used by the vendor app, supabase/migrations)
- `device_tokens` table (used by `/app/api/devices`, in `/migrations` — appears to be from the customer-facing web app, keyed on `auth.users`)

This duplication is a finding to flag — it's not currently a bug because nothing reads `device_tokens` for vendor push, but if the architecture decision converges on multi-device support per vendor, the model needs to be reconciled.

---

## 5. Payload Schema

### What exists

Defined in [`vxo-vendor-app/src/lib/notifications.ts:18–21`](../src/lib/notifications.ts):

```ts
type NotificationData = {
  type?: string;
  jobId?: string;
};
```

- One known type: `'job'` ⇒ routes to `/job/${jobId}`.
- One debug type: `'test'` ⇒ no-op (intentional).
- No formal documentation, no exported constants, no validator.

### Recommended convention (NOT implemented — proposal only)

Define a tagged-union payload in a shared module (e.g. `src/types/pushPayload.ts`). For each event surface a `data` object the listener can switch on:

| `data.type` | Required keys | Tap route | Trigger event |
|---|---|---|---|
| `account_approved` | none | `/(tabs)` | `vendors.status: pending → active` |
| `new_job` | `jobId: string` | `/job/{jobId}` | `jobs` insert with `assigned_vendor_id = vendor.id`, or status `dispatched → accepted` for this vendor |
| `message_from_alfred` | `jobId: string`, `messageId?: string` | `/job/{jobId}` (chat tab) | `job_messages` insert with `sender = 'alfred'` |
| `invoice_status_change` | `invoiceId: string`, `jobId: string`, `newStatus: 'approved'\|'paid'\|'rejected'` | `/job/{jobId}/invoice` | `invoices.status` update |

The existing `data.type === 'job'` handler can be kept as a backward-compatible alias for `new_job`.

---

## 6. Hardware Verification Status

### Test button — `_debug.tsx`

- File: [`vxo-vendor-app/app/_debug.tsx`](../app/_debug.tsx), button at lines 293–361.
- It calls the **Expo Push API directly from the device** (not `scheduleNotificationAsync` — actually exercises the full server round-trip):

```ts
// _debug.tsx:340–349
const res = await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: token,
    title: 'Test notification',
    body: 'If you see this, push works!',
    data: { type: 'test' },
  }),
});
```

- The button re-fetches the token at click time and shows a truncated preview in the alert. It does **not** depend on the `useNotificationToken` write succeeding — useful for diagnosing whether the token is even obtainable.

### Verification state (per handoff + verified)

| Check | Status | Notes |
|---|---|---|
| iOS permission dialog fires | ✅ verified per handoff (Expo Go) | Code path confirmed correct ([useNotificationToken.ts:31–34](../src/hooks/useNotificationToken.ts)) |
| Android permission dialog | ❓ **unknown** | No notes / smoke seed found. Android in Expo Go SDK 53+ does not support remote push at all (see §7) |
| Token written to `vendors.expo_push_token` | ❓ **not confirmed** — no smoke seed, no debug log artifact in repo | Worth verifying via Supabase Studio next session |
| End-to-end push received (`exp.host` → device) | ❓ unknown | The debug button exists but no recorded result |
| Cold-start tap routing | ✅ code present, not verified on hardware | [notifications.ts:49–55](../src/lib/notifications.ts) |

---

## 7. Limitations & Known Gaps

### Expo Go restrictions (SDK 53+)

- **Android remote push is removed from Expo Go.** Token fetch will fail on Android in Expo Go; requires a dev build / standalone build.
- iOS in Expo Go still works for development (with Expo's shared APNs cert).

### Standalone build prerequisites

- iOS: APNs auth key (`.p8`) uploaded to EAS. **Not in repo** (correct — these never live in the repo). No reference in `app.json` / `eas.json`.
- Android: FCM credentials (`google-services.json` + service account). **No `google-services.json` in `vxo-vendor-app/`.**
- `eas.json` **does not exist** in `vxo-vendor-app/`. Per the memory note, Ryan owns the EAS dev client + iOS Face ID testing — this is expected.

### Token lifecycle gaps

- No `Notifications.addPushTokenListener` — if Expo rotates the token mid-session, the new value is lost until next vendor reload.
- No teardown on sign-out — `expo_push_token` remains pointing at a device that no longer belongs to that vendor account.
- No per-device fanout — `vendors.expo_push_token` is `TEXT` (single value). One vendor signing into a second device overwrites the first. Compare to `device_tokens` (UNIQUE(user_id, token)) in `/migrations/add_device_tokens_table.sql`.

### TODO / FIXME inventory (notification-related)

- [useVendorStatusToast.ts:18](../src/hooks/useVendorStatusToast.ts): `TODO: add distinct negative-state toasts.`
- [useVendorStatusToast.ts:20–25](../src/hooks/useVendorStatusToast.ts): `TODO (Alfred / Ryan handoff): … send a push notification via Expo Push API …` (the headline gap)
- [FillProfile.tsx:8–9](../src/components/FillProfile.tsx): `TODO: when Alfred approves via Telegram, push notification triggers and routes user to (tabs). Real-time subscription to vendors.status would also work.`
- [settings.tsx:29](../app/settings.tsx): `TODO: future additions … notification preferences …`

---

## Architecture Diagram (current state)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            VENDOR APP (Expo / RN)                            │
│                                                                              │
│  app/_layout.tsx                                                             │
│    └─ side-effect import: src/lib/notifications.ts                           │
│         ├─ Notifications.setNotificationHandler({...})         ✅ implemented│
│         ├─ addNotificationResponseReceivedListener(handleResp) ✅ implemented│
│         └─ getLastNotificationResponseAsync() (cold-start)     ✅ implemented│
│                                                                              │
│  app/(tabs)/_layout.tsx                                                      │
│    └─ useNotificationToken()                                                 │
│         ├─ Device.isDevice gate                                ✅ implemented│
│         ├─ getPermissionsAsync / requestPermissionsAsync       ✅ implemented│
│         ├─ projectId resolve (app.json extra.eas.projectId)    ✅ implemented│
│         ├─ Notifications.getExpoPushTokenAsync({ projectId })  ✅ implemented│
│         └─ supabase.from('vendors').update({ expo_push_token })✅ implemented│
│                                                                              │
│  app/_debug.tsx                                                              │
│    └─ "Send test notification" button                                        │
│         └─ fetch('https://exp.host/--/api/v2/push/send', ...)  ✅ implemented│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │  (1) write expo_push_token
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE (Postgres)                             │
│                                                                              │
│  vendors.expo_push_token TEXT                                  ✅ schema     │
│  device_tokens (auth.users-keyed, customer-facing, unused      ⚠️ parallel   │
│      by vendor app)                                              schema     │
│  notifications inbox table                                     ⚠️ unused by  │
│                                                                  vendor app  │
│                                                                              │
│  Postgres TRIGGERs for push:                                   ❌ missing    │
│  pg_net / supabase_functions.http_request hooks:               ❌ missing    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │  (2) some event happens
                                       │      (e.g. Alfred flips status to 'active')
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       SERVER-SIDE PUSH TRIGGER                               │
│                                                                              │
│  supabase/functions/send-push (Edge Function):                 ❌ missing    │
│  /app/api/push/send  (Next.js route):                          ❌ missing    │
│  Alfred-side outbound to Expo Push:                            ❌ missing    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │  (3) POST to exp.host
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            EXPO PUSH API (exp.host)                          │
│                                                                              │
│  expo-server-sdk:                                              ❌ missing    │
│  EXPO_ACCESS_TOKEN env var:                                    ❌ missing    │
│  Receipt polling / token cleanup:                              ❌ missing    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │  (4) APNs / FCM
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  iOS APNs .p8 in EAS:                                          ❓ unknown    │
│  Android FCM google-services.json:                             ❌ missing    │
│                                                                              │
│  Device receives → addNotificationResponseReceivedListener     ✅ implemented│
│  Tap → router.push('/job/${jobId}') (only 'job' type)         ⚠️ partial    │
└──────────────────────────────────────────────────────────────────────────────┘
```

Legend: ✅ implemented · ⚠️ partial · ❌ missing · ❓ unknown / unverified

---

## Gap Analysis

| Gap | Blocks which goal | Severity |
|---|---|---|
| **No server-side sender** (no Edge Function, no Next.js route, no Alfred outbound) | All four target notification types | 🔴 Blocker |
| `expo-server-sdk` not installed; `EXPO_ACCESS_TOKEN` env var not set | Any backend send path | 🔴 Blocker |
| No DB trigger / webhook from `vendors`, `jobs`, `job_messages` to a sender | Server-originated push fan-out | 🔴 Blocker (depends on chosen architecture) |
| **No formal payload schema** (`type` constants, validator, route-table) | Future maintainability — adding `account_approved`, `new_job`, etc. without contract drift | 🟡 Important |
| No `addPushTokenListener` (token rotation) | Long-lived deliverability — silent failure mode after Expo rotates token | 🟡 Important |
| No token clear on sign-out | Privacy: previous vendor's device receives pushes destined for the account on shared devices | 🟡 Important |
| `vendors.expo_push_token` is single-valued; no multi-device support | A vendor on phone + tablet only receives push on the most recent login | 🟡 Important |
| **No FCM credentials** for Android standalone | Android beyond Expo Go | 🟠 Standalone-build blocker |
| iOS APNs .p8 status in EAS not verified | iOS standalone (vs Expo Go) | 🟠 Standalone-build blocker (Ryan-owned per memory) |
| No verified end-to-end test recorded — token in DB, push actually delivered | Confidence to ship | 🟡 Hardware verification |
| Two parallel push-token schemas (`vendors.expo_push_token` + `device_tokens`) | Architectural clarity; future consolidation cost | 🟡 Schema cleanup |
| Android in Expo Go can't receive remote push (SDK 53+) | Android dev iteration | 🟠 Tooling constraint (need dev build) |

---

## Recommended Next Steps — three architecture options

The headline target — push for `account_approved` (and the three other event types in §5) when the vendor is **not in the app** — needs three things: (a) a server-side caller of `exp.host`, (b) a trigger that fires when the event happens, (c) credentials.

The three options below differ in **where** (a) and (b) live. All three share the same prerequisites: install `expo-server-sdk` in the chosen runtime, provision `EXPO_ACCESS_TOKEN`, formalise the payload schema from §5, and (eventually) wire APNs `.p8` + FCM credentials in EAS for standalone builds.

### Option A — Postgres trigger → Supabase Edge Function → Expo Push

```
vendors.status UPDATE (pending → active)
    └─ AFTER UPDATE trigger
        └─ pg_net.http_post(...) → supabase/functions/send-push
            └─ expo-server-sdk → exp.host
```

**Pros**
- Co-located with data — every status flip (manual, Alfred-driven, admin Studio) fires consistently. No way to "forget" to send.
- Edge Function has Supabase service-role auth natively; minimal glue.
- Independent of Alfred / Next.js deploy cycles.
- Trivially extensible to other tables: `job_messages` insert trigger ⇒ `message_from_alfred`; `jobs` insert ⇒ `new_job`; `invoices` status update ⇒ `invoice_status_change`.

**Cons**
- Requires `supabase` CLI to be initialised in repo (not currently — `vxo-vendor-app/supabase/` is empty). Per memory note, SQL goes in `supabase/schema/` and Ryan owns prod migrations, so this needs coordination.
- `pg_net` extension must be enabled on the project.
- Edge Function logging is shallower than a Next.js route.
- Trigger failures can be silent if not monitored (pg_net is fire-and-forget).

**Prerequisites**
- Enable `pg_net` extension.
- `supabase init` + `supabase/functions/send-push/index.ts` scaffold.
- `EXPO_ACCESS_TOKEN` secret on the Supabase project.
- Coordinated migration via Ryan: trigger SQL + function file.

---

### Option B — Alfred / admin webhook → Next.js `/api/push/send` → Expo Push

```
Alfred (or admin action) POSTs to vendors.status=active
    └─ same caller also POSTs /api/push/send
        └─ Next.js route handler
            └─ expo-server-sdk → exp.host
```

**Pros**
- Lives in the same Next.js codebase as `/app/api/devices` and `/app/api/notifications` — consistent observability, deploy story, and auth (`requireAuth` / service role helpers already exist in [lib/api-utils.ts](../../lib/api-utils.ts)).
- Easy to attach metadata (sender, request id, idempotency key) that DB triggers can't see.
- Can write a row to the existing `notifications` inbox table at the same time — single source of truth for "what was sent".

**Cons**
- Requires every status-changing path to remember to call the push route. If Alfred flips a status directly in SQL or someone toggles via Supabase Studio, no push fires.
- Couples Alfred backend velocity to push delivery — Alfred has to land the outbound call.
- One more network hop vs Option A.

**Prerequisites**
- `npm i expo-server-sdk` in the Next.js workspace.
- `EXPO_ACCESS_TOKEN` env var on the Next.js host.
- New route `/app/api/push/send/route.ts` + a thin client wrapper.
- Alfred (or whichever service writes `vendors.status`) needs to add the outbound call.

---

### Option C — Client-only (interim, no server work)

```
Vendor B's app polls/realtime-subscribes vendors.status
    └─ on pending→active edge → useVendorStatusToast (already works in-app)
    └─ no push fires
```

**Pros**
- Zero new infrastructure. Already implemented for the "vendor has app open" case ([useVendorStatusToast.ts](../src/hooks/useVendorStatusToast.ts)).
- No coordination with Ryan/Alfred required.

**Cons**
- **Does not solve the actual problem** — vendor not in the app gets no notification. Realtime only fires when the app is foreground/background-foregroundable on iOS (and not at all when fully killed).
- Useless for `message_from_alfred` (chat won't notify when app closed).
- Useless for `new_job` (vendor needs to know about a job *because* they're not looking).

**Prerequisites**
- None. This is effectively the status quo.

---

### Decision inputs (for the orchestrator)

1. **Who currently flips `vendors.status` to `active`?** If it's always Alfred via an HTTP call, Option B is one PR. If it's also Supabase Studio / manual SQL by Ryan, Option A is more robust.
2. **Multi-device support — needed at launch?** If yes, the schema decision (keep `vendors.expo_push_token`, or migrate vendors to `device_tokens`) should be made before either A or B is built.
3. **How much work has Ryan already started on the Alfred → push path?** Memory note says iOS Face ID / dev build is Ryan's lane; verify whether server-side push is also his lane before scoping.
4. **Android standalone urgency?** If Android needs to work soon, FCM credentials become a parallel workstream regardless of A vs B.

---

## Out-of-scope (intentionally not covered)

- Implementation of any of the three options.
- Reconciliation of the two parallel push-token schemas (`vendors.expo_push_token` vs `device_tokens`).
- Notification preferences UI ([settings.tsx:29](../app/settings.tsx) TODO).
- Quiet hours, do-not-disturb, batching, deduplication policy.
- Receipt polling + automatic invalidation of dead tokens.
