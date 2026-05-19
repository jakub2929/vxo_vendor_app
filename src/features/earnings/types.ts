// Shared types for the Earnings tab hooks + UI. The DB row shape comes from
// the generated Database types; EarningsRow augments it with the inner-join
// payload from `jobs` (client_name + trade) so the card can render both
// without a second fetch.
import type { Database } from '@/types/database';

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

export type EarningsRow = InvoiceRow & {
  // jobs!inner(...) — PostgREST returns the joined row as an object (or array
  // depending on the relationship side). With an FK from invoices.job_id this
  // is a single object. Mark fields nullable to match the source columns.
  jobs: {
    client_name: string | null;
    trade: string;
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
