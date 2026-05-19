import { useQuery } from '@tanstack/react-query';
import { mockInvoices } from '@/lib/mockInvoices';
import { mockJobs } from '@/lib/mockJobs';
import { supabase } from '@/lib/supabase';
import { formatJobNumber } from '@/utils/formatters';

export type JobStatus =
  | 'new'
  | 'dispatched'
  | 'accepted'
  | 'en_route'
  | 'on_site'
  | 'complete'
  | 'invoiced'
  | 'paid'
  | 'closed'
  | 'cancelled';

export type InvoiceStatus = 'draft' | 'sent' | 'approved' | 'paid' | 'rejected';

export type HomeSummary = { earnedThisMonth: number; jobsCount: number };
export type HomeStats = { invoicesSent: number; invoicesPaid: number };
export type HomeRecentJob = {
  jobId: string;
  shortId: string;
  total: number | null;
  invoiceStatus: InvoiceStatus | null;
  jobStatus: JobStatus;
  updatedAt: string;
  // Client display name pulled from jobs.client_name. NULL when the dispatch
  // row never had one set. Renderers should fall back to status-only.
  clientName: string | null;
};

// In dev we return mocks. Real Supabase is hit only when:
//   - the build is NOT a __DEV__ build (release / TestFlight / etc), OR
//   - EXPO_PUBLIC_FORCE_REAL_DATA=1 in env (non-destructive override for
//     Realtime smoke tests — survives across restarts; flip on the env, not
//     this file, so nobody accidentally checks in USE_MOCKS=false).
export const USE_MOCKS =
  __DEV__ && process.env.EXPO_PUBLIC_FORCE_REAL_DATA !== '1';

// "This month" is the vendor's local-clock month. Computing first-of-month in
// UTC would shift the cutoff by hours: e.g. for a vendor in UTC-7, late-April
// 17:00 local is May 1 00:00 UTC, which UTC math would mis-classify as "May".
// Build the local-time Date and let .toISOString() convert to UTC.
function firstOfCurrentMonthISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).toISOString();
}

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Postgres `numeric` columns are returned by PostgREST as strings (to preserve
// precision beyond JS Number's 53 bits). The codegen'd Database types claim
// `number | null`, but in practice a `total` of 2200 arrives as "2200.00".
// Coerce at the data-layer boundary; arithmetic on strings would silently
// concat ("0" + "2200.00" = "02200.00") and break the totals.
function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function toNumOrNull(
  v: number | string | null | undefined,
): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function useHomeSummary(vendorId: string | null | undefined) {
  return useQuery<HomeSummary>({
    queryKey: ['home', 'summary', vendorId, monthKey()],
    enabled: !!vendorId,
    queryFn: async () => {
      const startIso = firstOfCurrentMonthISO();

      if (USE_MOCKS) {
        const paid = mockInvoices.filter((inv) => {
          if (inv.status !== 'paid') return false;
          // Mock parity with the real query: prefer paid_at, fall back to
          // updated_at when paid_at is unset on legacy/seed rows.
          const ts =
            (inv as { paid_at?: string | null }).paid_at ??
            inv.updated_at ??
            inv.created_at ??
            '';
          return ts >= startIso;
        });
        const earned = paid.reduce((s, i) => s + (i.total ?? 0), 0);
        const jobs = new Set(paid.map((i) => i.job_id)).size;
        return { earnedThisMonth: earned, jobsCount: jobs };
      }

      // "Earned this month" must filter by *when the invoice was paid*, not
      // when it was created. The migration that added paid_at didn't backfill
      // it (only sent_at was filled), so seed/legacy rows have paid_at NULL.
      // The .or() expression covers both: a real timestamp >= startIso, or
      // a NULL paid_at with updated_at >= startIso as the fallback. PostgREST
      // doesn't support COALESCE inside .gte(), so .or() is the cleanest path.
      const { data, error } = await supabase
        .from('invoices')
        .select('total, job_id')
        .eq('vendor_id', vendorId as string)
        .eq('status', 'paid')
        .or(`paid_at.gte.${startIso},and(paid_at.is.null,updated_at.gte.${startIso})`);
      if (error) throw error;
      const earned = (data ?? []).reduce(
        (s, r) => s + toNum(r.total),
        0,
      );
      const jobs = new Set((data ?? []).map((r) => r.job_id)).size;
      return { earnedThisMonth: earned, jobsCount: jobs };
    },
  });
}

// "Sent" tile = total dispatched volume this month. Any invoice that ever
// reached the client counts — once it moves to 'paid' / 'viewed' / 'overdue'
// it's still "was sent", so the IN-list covers the full post-draft union
// minus 'rejected' / 'cancelled' (those were retracted, not dispatched).
const SENT_BUCKET = ['sent', 'viewed', 'approved', 'overdue', 'paid'];

export function useHomeStats(vendorId: string | null | undefined) {
  return useQuery<HomeStats>({
    queryKey: ['home', 'stats', vendorId, monthKey()],
    enabled: !!vendorId,
    queryFn: async () => {
      const startIso = firstOfCurrentMonthISO();

      if (USE_MOCKS) {
        const sent = mockInvoices
          .filter((i) => {
            if (!SENT_BUCKET.includes(i.status)) return false;
            const ts =
              (i as { sent_at?: string | null }).sent_at ??
              i.created_at ??
              '';
            return ts >= startIso;
          })
          .reduce((s, i) => s + (i.total ?? 0), 0);
        const paid = mockInvoices
          .filter((i) => {
            if (i.status !== 'paid') return false;
            const ts =
              (i as { paid_at?: string | null }).paid_at ??
              i.updated_at ??
              i.created_at ??
              '';
            return ts >= startIso;
          })
          .reduce((s, i) => s + (i.total ?? 0), 0);
        return { invoicesSent: sent, invoicesPaid: paid };
      }

      // Both tiles are now month-scoped (was lifetime). "Sent" uses sent_at
      // with a created_at fallback for rows that never had sent_at populated;
      // the migration backfilled sent_at on legacy 'sent'/'approved'/'paid'/
      // 'rejected' rows, so the fallback is mostly defensive. "Paid" uses
      // paid_at with updated_at fallback for the seed-data NULL case.
      const [sentR, paidR] = await Promise.all([
        supabase
          .from('invoices')
          .select('total')
          .eq('vendor_id', vendorId as string)
          .in('status', SENT_BUCKET)
          .or(`sent_at.gte.${startIso},and(sent_at.is.null,created_at.gte.${startIso})`),
        supabase
          .from('invoices')
          .select('total')
          .eq('vendor_id', vendorId as string)
          .eq('status', 'paid')
          .or(`paid_at.gte.${startIso},and(paid_at.is.null,updated_at.gte.${startIso})`),
      ]);
      if (sentR.error) throw sentR.error;
      if (paidR.error) throw paidR.error;
      const sent = (sentR.data ?? []).reduce(
        (s, r) => s + toNum(r.total),
        0,
      );
      const paid = (paidR.data ?? []).reduce(
        (s, r) => s + toNum(r.total),
        0,
      );
      return { invoicesSent: sent, invoicesPaid: paid };
    },
  });
}

// Query from jobs (not invoices) so each job appears at most once, even when
// it has both a quote and an invoice. Attach the latest invoice per job in JS.
export function useHomeRecentJobs(vendorId: string | null | undefined) {
  return useQuery<HomeRecentJob[]>({
    queryKey: ['home', 'recent', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      if (USE_MOCKS) {
        const recent = [...mockJobs]
          .sort((a, b) =>
            (b.updated_at ?? '').localeCompare(a.updated_at ?? ''),
          )
          .slice(0, 10);
        return recent.map((j) => {
          const latestInv = [...mockInvoices]
            .filter((i) => i.job_id === j.id)
            .sort((a, b) =>
              (b.created_at ?? '').localeCompare(a.created_at ?? ''),
            )[0];
          return {
            jobId: j.id,
            shortId: formatJobNumber(j.id),
            total: latestInv?.total ?? null,
            invoiceStatus: (latestInv?.status as InvoiceStatus | undefined) ?? null,
            jobStatus: j.status as JobStatus,
            updatedAt: j.updated_at ?? '',
            clientName: j.client_name ?? null,
          };
        });
      }

      const { data: jobs, error: jobsErr } = await supabase
        .from('jobs')
        .select('id, status, updated_at, client_name')
        .eq('assigned_vendor_id', vendorId as string)
        .order('updated_at', { ascending: false })
        .limit(10);
      if (jobsErr) throw jobsErr;
      if (!jobs || jobs.length === 0) return [];

      const jobIds = jobs.map((j) => j.id);
      const { data: invs, error: invsErr } = await supabase
        .from('invoices')
        .select('job_id, total, status, created_at')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false });
      if (invsErr) throw invsErr;

      const latestByJob = new Map<
        string,
        { total: number | null; status: string }
      >();
      for (const inv of invs ?? []) {
        if (!latestByJob.has(inv.job_id)) {
          latestByJob.set(inv.job_id, {
            total: toNumOrNull(inv.total),
            status: inv.status,
          });
        }
      }

      return jobs.map((j) => {
        const inv = latestByJob.get(j.id);
        return {
          jobId: j.id,
          shortId: formatJobNumber(j.id),
          total: inv?.total ?? null,
          invoiceStatus: (inv?.status as InvoiceStatus | undefined) ?? null,
          jobStatus: j.status as JobStatus,
          updatedAt: j.updated_at ?? '',
          clientName: j.client_name ?? null,
        };
      });
    },
  });
}

// Q2 (approved): 3 buckets, no false precision.
//   - new / dispatched / cancelled → 0% (grey track only)
//   - any in-progress status (accepted..invoiced) → 50%, purple #615EFC
//   - paid / closed → 100%, orange #FF981F
export type ProgressBucket = {
  pct: 0 | 50 | 100;
  // null = render only the grey track (no fill bar at all).
  fillColor: '#615EFC' | '#FF981F' | null;
};

export function progressBucket(
  jobStatus: JobStatus,
  invoiceStatus: InvoiceStatus | null,
): ProgressBucket {
  if (
    jobStatus === 'paid' ||
    jobStatus === 'closed' ||
    invoiceStatus === 'paid'
  ) {
    return { pct: 100, fillColor: '#FF981F' };
  }
  if (
    jobStatus === 'new' ||
    jobStatus === 'dispatched' ||
    jobStatus === 'cancelled'
  ) {
    return { pct: 0, fillColor: null };
  }
  return { pct: 50, fillColor: '#615EFC' };
}

export function statusLabel(
  jobStatus: JobStatus,
  invoiceStatus: InvoiceStatus | null,
): { label: string; emoji: string } {
  if (jobStatus === 'paid' || invoiceStatus === 'paid')
    return { label: 'Paid', emoji: '✅' };
  if (jobStatus === 'closed') return { label: 'Closed', emoji: '✅' };
  if (jobStatus === 'cancelled') return { label: 'Cancelled', emoji: '❌' };
  if (jobStatus === 'invoiced' || invoiceStatus === 'sent')
    return { label: 'Pending', emoji: '⏳' };
  if (jobStatus === 'complete') return { label: 'Complete', emoji: '⏳' };
  if (jobStatus === 'on_site') return { label: 'On Site', emoji: '🛠️' };
  if (jobStatus === 'en_route') return { label: 'En Route', emoji: '🚐' };
  if (jobStatus === 'accepted') return { label: 'Accepted', emoji: '👍' };
  if (jobStatus === 'dispatched') return { label: 'Dispatched', emoji: '📨' };
  return { label: 'New', emoji: '🆕' };
}
