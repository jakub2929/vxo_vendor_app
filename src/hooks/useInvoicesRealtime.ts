// Realtime subscription on the invoices table, scoped to this vendor.
// Two responsibilities: keep the Home tab + Earnings sections in sync with
// server-side status flips, and surface user-facing toasts on the notable
// transitions (payment received, quote accepted, invoice overdue).
//
// REPLICA IDENTITY caveat: 004_storage_realtime.sql adds invoices to the
// supabase_realtime publication but doesn't set REPLICA IDENTITY FULL. With
// the Postgres default, payload.old in UPDATE events contains only the
// primary key — payload.old.status is undefined. We track previous status
// client-side via a useRef map keyed by invoice id; first sighting seeds
// without toasting, subsequent events that move the stored value fire the
// matching toast. Matches the useVendorStatusToast ref pattern.
//
// Bypassed when USE_MOCKS is on — no Realtime against fixtures, mirrors the
// other Realtime hooks so EXPO_PUBLIC_FORCE_REAL_DATA=1 activates this in lock
// step with the rest.
//
// Replaces the invoices half of useHomeRealtime: that hook now subscribes
// to jobs only, this one is the single source of truth for invoice events
// (both ['home'] and ['earnings'] invalidations live here).
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/components/Toast';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { useVendor } from '@/hooks/useVendor';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { formatMoney } from '@/utils/formatters';

type Invoice = Database['public']['Tables']['invoices']['Row'];

// Coerce numeric(10,2) which may arrive as number or string. Falsy / NaN → 0.
function toMoneyNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Invoice | Record<string, never>;
  old: Partial<Invoice>;
};

export function useInvoicesRealtime() {
  const { vendor } = useVendor();
  const vendorId = vendor?.id;
  const qc = useQueryClient();
  const lastSeen = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!vendorId) return;
    if (USE_MOCKS) return;

    // Different vendor → fresh tracker. Sign-out then sign-in as the same
    // vendor also re-runs this effect (vendorId reference identity flips via
    // useVendor's state), which is the right behavior: the lastSeen map is
    // session-scoped, not persistent.
    lastSeen.current.clear();

    const channel = supabase
      .channel(`invoices:${vendorId}`)
      .on(
        // Loose cast — postgres_changes payload types lag the runtime contract.
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload: RealtimePayload) => {
          // Fire-and-forget invalidations. React Query dedupes back-to-back
          // calls within the same tick, so emitting both keys per event is
          // fine. ['home'] covers summary/stats/recent; ['earnings'] covers
          // pending-invoices/paid-invoices/pending-quotes.
          void qc.invalidateQueries({ queryKey: ['earnings'] });
          void qc.invalidateQueries({ queryKey: ['home'] });
          handleTransition(payload, lastSeen.current);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [vendorId, qc]);
}

function handleTransition(
  payload: RealtimePayload,
  lastSeen: Map<string, string>,
) {
  if (payload.eventType === 'DELETE') {
    const oldId = payload.old.id;
    if (oldId) lastSeen.delete(oldId);
    return;
  }

  const next = payload.new as Invoice;
  if (!next.id || !next.status) return;

  const prev = lastSeen.get(next.id);
  lastSeen.set(next.id, next.status);

  // First sighting (INSERT, or an UPDATE we haven't observed before): seed
  // only. We can't distinguish "this just transitioned" from "this is the
  // existing state we're learning about for the first time", and toasting
  // on every cold-open INSERT would spam the user. Push notifications cover
  // events that happened while the app was backgrounded (Phase 1 wiring).
  if (prev === undefined) return;
  if (prev === next.status) return;

  if (next.status === 'paid' && next.kind === 'invoice') {
    showToast({
      title: 'Payment received',
      body: `${formatMoney(toMoneyNum(next.total))} from invoice paid`,
    });
    return;
  }

  if (next.status === 'accepted' && next.kind === 'quote') {
    showToast({
      title: 'Quote accepted',
      body: 'Client approved your quote',
    });
    return;
  }

  if (next.status === 'overdue') {
    showToast({
      title: 'Invoice overdue',
      body: `${formatMoney(toMoneyNum(next.total))} invoice is past due`,
    });
    return;
  }
  // Other transitions (sent → viewed, draft → sent, etc.) are silent; the
  // invalidations above already refresh the lists.
}
