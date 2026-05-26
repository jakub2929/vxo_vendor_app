// Shared types for the Earnings tab hooks + UI. The DB row shape comes from
// the generated Database types; EarningsRow augments it with the joined
// vendor_requests payload (service_type) + embedded client profile (name)
// so the card can render both without a second fetch.
//
// Phase 5: the join target is `vendor_requests` (renamed from `jobs`) and
// client name lives on a separate `profiles` row reached via client_id —
// it's no longer a direct column on the request.
import type { Database } from '@/types/database';

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

export type EarningsRow = InvoiceRow & {
  // vendor_requests!inner(...) — PostgREST returns the joined row as an
  // object (or array depending on relationship cardinality). With an FK from
  // invoices.job_id → vendor_requests.id this is a single object.
  vendor_requests: {
    service_type: string;
    client:
      | { first_name: string | null; last_name: string | null }
      | { first_name: string | null; last_name: string | null }[]
      | null;
  } | null;
};

// Postgres `numeric` arrives from PostgREST as a string. The generated type
// claims `number | null`, but in practice `total: 2200` comes back as
// "2200.00". Same coercion as src/features/home/useHomeData.ts (toNum). Kept
// local to the earnings folder so it's clear at the boundary.
export function toMoney(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// Derive a display client name from the embedded profile join. Returns null
// when both name parts are missing or the join didn't resolve.
export function clientNameFromRow(row: EarningsRow): string | null {
  const reqRaw = row.vendor_requests;
  if (!reqRaw) return null;
  const clientRaw = reqRaw.client;
  const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
  if (!client) return null;
  const joined = [client.first_name, client.last_name]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join(' ')
    .trim();
  return joined.length > 0 ? joined : null;
}

// Service type (trade) lives on vendor_requests now. NULL when the join
// didn't resolve (shouldn't happen with !inner but keep the type honest).
export function serviceTypeFromRow(row: EarningsRow): string | null {
  return row.vendor_requests?.service_type ?? null;
}
