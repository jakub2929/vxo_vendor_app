# Vendor app real-Supabase smoke test — verification plan

Companion to [`seed-jobs-for-smoke-test.sql`](./seed-jobs-for-smoke-test.sql).

Goal: exercise the real-Supabase code paths in `useJobsList`, `useJobChat`,
`useJobChatRealtime`, and `useJobsRealtime` end-to-end against the dev DB
on a real device. Mock paths already smoke-tested separately.

**Test vendor ID:** `79ea38f3-7ea9-4547-94c6-9471df984dce`
**Anchor location:** Springfield, IL (~39.78N, -89.65W)

---

## 1. Apply the seed

1. Open Supabase Studio for the dev project.
2. SQL Editor → New query → paste contents of
   [`seed-jobs-for-smoke-test.sql`](./seed-jobs-for-smoke-test.sql) → Run.
3. Expected: query succeeds with no errors. Re-running is safe (idempotent).

## 2. Verify the seed in Studio

Run these three queries and check the expected counts:

```sql
SELECT count(*) FROM jobs
  WHERE assigned_vendor_id = '79ea38f3-7ea9-4547-94c6-9471df984dce';
-- Expected: 10
```

```sql
SELECT status, count(*) FROM jobs
  WHERE assigned_vendor_id = '79ea38f3-7ea9-4547-94c6-9471df984dce'
  GROUP BY status ORDER BY status;
-- Expected: 1 each of accepted, cancelled, closed, complete, dispatched,
--           en_route, invoiced, new, on_site, paid
```

```sql
SELECT count(*) FROM job_messages
  WHERE job_id IN (
    SELECT id FROM jobs
    WHERE assigned_vendor_id = '79ea38f3-7ea9-4547-94c6-9471df984dce'
  );
-- Expected: 13
```

If counts don't match, stop and investigate before continuing.

## 3. Launch the app against real Supabase

1. In `vxo-vendor-app/.env`, set:
   ```
   EXPO_PUBLIC_FORCE_REAL_DATA=1
   ```
   Confirm `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` point
   at the dev project.
2. `cd vxo-vendor-app && npx expo start --clear`
3. Open the app on a real device (Expo Go or dev client) — sign in as the test
   vendor.

> GPS note: distance UI uses real device location. Run the test from somewhere
> near Springfield IL, or expect distance values to read "very far" — the rest
> of the UI is still valid.

---

## 4. Jobs list

Tap the **Jobs** tab.

- [ ] **8 rows visible** (jobs 1–8). Jobs 9 (`closed`) and 10 (`cancelled`)
      must be filtered out.
- [ ] Order is `updated_at DESC` — top-to-bottom roughly:
      4 (en_route, ~5min), 5 (on_site, ~40min), 2 (dispatched, ~15min ago),
      3 (accepted, ~2h), 8 (paid, ~4d), 7 (invoiced, ~2d), 6 (complete, ~1d),
      1 (new, ~30min)
      *(exact order depends on the moment you applied the seed — the dispatched/new/etc.
      relative gaps are stable but absolute ordering can shift by minutes.)*
- [ ] Status colors match Figma spec
      (red/orange for in-progress states, grey for `paid`, etc.)
- [ ] Distance shows per row (computed from real GPS — values will vary).
- [ ] Client first names visible: Sarah, Michael, Jennifer, David, Lisa,
      Robert, Emily, Thomas.

## 5. Search

- [ ] Type `plumbing` → only the 2 visible plumbing jobs (1, 4) appear.
- [ ] Clear, type `Sarah` → only job 1 appears.
- [ ] Clear, type `Springfield` → jobs 1 and 5 appear.

## 6. Open chat with messages — job 4 (en_route, emergency plumbing, David Park)

Tap the **en_route** row.

- [ ] Chat opens with **4 message bubbles** in order:
      1. alfred — "New emergency job assigned…" (grey, left)
      2. vendor — "On my way. ETA 25 min." (blue, right)
      3. alfred — "Client confirmed they're home…" (grey, left)
      4. client — "Thanks — the leak is in the cabinet…" (grey, left)
- [ ] Job action card / header shows: David Park, plumbing, en_route status,
      Riverton address.

## 7. Open chat without messages — job 1 (new, Sarah Mitchell)

Back to Jobs list → tap the **new** plumbing row.

- [ ] Chat opens empty (no bubbles).
- [ ] Composer visible at bottom.

## 8. Send a message — exercise the insert path

Still in job 1 chat:

1. Type "Heading over now." into the composer.
2. Tap send.

- [ ] Bubble appears in the chat (vendor, blue, right side).
- [ ] In Supabase Studio, the row is now visible:
      ```sql
      SELECT id, sender, content, created_at FROM job_messages
        WHERE job_id = 'a1234567-0000-4000-8000-000000000001'
        ORDER BY created_at DESC LIMIT 1;
      ```
      `sender` = `'vendor'`, `content` matches what you typed.

> **Known gap — no optimistic insert.** `useSendMessage` (`useJobChat.ts:71-100`)
> awaits the Supabase insert response, then invalidates the messages query,
> which refetches. So the bubble appears only **after** the network roundtrip
> completes — typically 200–500ms on a good connection, longer on flaky
> networks. There is no `optimistic-*` placeholder ID stage.
> **TODO:** implement optimistic insert pattern (mirror Support chat) in a
> follow-up so the bubble appears instantly on tap, then reconciles with the
> server-assigned UUID on response.

## 9. Realtime — incoming message

Keep job 1's chat **open** on device. In Supabase Studio:

```sql
INSERT INTO job_messages (id, job_id, sender, content, created_at)
VALUES (
  gen_random_uuid(),
  'a1234567-0000-4000-8000-000000000001',
  'alfred',
  'Realtime test — alfred ping.',
  NOW()
);
```

- [ ] Within 1–3 seconds, an alfred bubble appears at the bottom of the chat
      **without you touching the app**.
- [ ] Bubble is grey, left-aligned.

Repeat with `sender = 'client'`:

```sql
INSERT INTO job_messages (id, job_id, sender, content, created_at)
VALUES (
  gen_random_uuid(),
  'a1234567-0000-4000-8000-000000000001',
  'client',
  'Realtime test — client ping.',
  NOW()
);
```

- [ ] Client bubble appears within 1–3s.

## 10. Realtime — jobs list updates

Navigate back to the **Jobs list** (don't close the app). In Supabase Studio:

```sql
UPDATE jobs
  SET status = 'on_site', updated_at = NOW()
  WHERE id = 'a1234567-0000-4000-8000-000000000002';
```

- [ ] Within 1–3 seconds, job 2's row updates: status badge changes from
      "dispatched" to "on_site", row may reorder to the top
      (newest `updated_at`).

```sql
UPDATE jobs
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = 'a1234567-0000-4000-8000-000000000003';
```

- [ ] Within 1–3s, job 3 **disappears** from the list (status now excluded by
      `useJobsList`'s `not in ('closed','cancelled')`).

> **Known gap — open chat does NOT auto-update on `jobs` status change.**
> `useJobChatRealtime` (`useJobChatRealtime.ts:14`) only subscribes to
> `job_messages` INSERTs. `useJobsRealtime` invalidates the `['jobs']` cache
> prefix, but `useJob` inside the chat screen reads from `['chat','job',jobId]`
> — a different prefix. So if you have the chat detail screen open and update
> the job's status in Studio, the status card on the open screen will **not**
> refresh until you back out and re-enter, or pull-to-refresh if the screen
> supports it.
> **TODO:** add a Realtime subscription on `jobs` UPDATE filtered by
> `id=eq.{jobId}` to `useJobChatRealtime`, invalidating
> `['chat','job',jobId]`. Or invalidate both prefixes from `useJobsRealtime`.

## 11. Persistence / cold-start

1. Force-quit the app from the OS app switcher.
2. Reopen the app.

- [ ] Jobs tab still shows the list (now reflecting the Studio updates from
      step 10 — job 2 as `on_site`, job 3 gone, plus any new messages from
      step 9 reflected in job 1's chat preview if the row shows last message).
- [ ] No visible flicker / re-fetch spinner that's worse than the mock flow.

## 12. Reset state (optional, between runs)

To reset to a clean seed state without re-running the full script:

```sql
-- Wipes messages + jobs for the test vendor only.
DELETE FROM job_messages
  WHERE job_id IN (
    SELECT id FROM jobs
    WHERE assigned_vendor_id = '79ea38f3-7ea9-4547-94c6-9471df984dce'
  );
DELETE FROM jobs
  WHERE assigned_vendor_id = '79ea38f3-7ea9-4547-94c6-9471df984dce';
```

Then re-apply [`seed-jobs-for-smoke-test.sql`](./seed-jobs-for-smoke-test.sql).

---

## Known gaps / follow-up TODOs

These were surfaced during the audit (Phase 0) and are out of scope for this
seed task. Track separately if the smoke test confirms them.

1. **Optimistic insert missing** — see step 8. Bubble appears after network
   roundtrip, not on tap. Mirror Support chat's optimistic pattern.
2. **Open chat doesn't react to `jobs` UPDATE Realtime** — see step 10.
   Add a `jobs`-table subscription to `useJobChatRealtime` (or invalidate
   the `['chat','job',jobId]` key from `useJobsRealtime`).
3. **Distance UI depends on real GPS** — if a tester is far from Springfield,
   distances will read large. Consider a settable "test anchor" override for
   smoke testing from outside the US.
4. **Schema vs API reference drift** — the task brief referenced `sla_hours`,
   `scheduled_at`, `awaiting_invoice`, `completed`, `confirmed`. None exist in
   the dev schema (`001_alfred_tables_DEV_ONLY.sql`). Either the API reference
   is ahead of schema (Ryan's prod migrations may add these) or the brief is
   stale. Worth reconciling with Ryan before relying on those fields.
5. **No RLS path verified** — this seed assumes the anon key + signed-in user
   can read jobs assigned to them. Audit `003_rls_policies.sql` separately if
   the smoke test hits permission errors.

## Things NOT covered by this seed

- Multi-vendor scenarios (all rows assigned to one vendor)
- Invoices / quotes (`invoices` table not seeded)
- Dispatch log (`dispatch_log` not seeded)
- Push notifications (separate flow)
- Storage / completion photos (`completion_photo_ids` left empty)
- Support chat (`support_messages` — covered by a different MVP)
