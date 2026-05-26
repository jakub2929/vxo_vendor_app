import { useQuery } from '@tanstack/react-query';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { mockJobs } from '@/lib/mockJobs';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/features/chat/types';

// "Active jobs" — anything the vendor still has business with. Cancelled
// jobs are filtered out. Completed jobs stay visible because the Figma row
// design has a "Completed" state with grey dot and "Payment received"
// subtitle.
//
// Phase 5: filter on the per-vendor request_vendors.job_status (NOT the
// request-wide vendor_requests.status). Cancelled rows belong to that
// per-vendor lifecycle and are the only thing to suppress here.
export function useJobsList(vendorId: string | null | undefined) {
  return useQuery<Job[]>({
    queryKey: ['jobs', 'list', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      if (USE_MOCKS) {
        return [...mockJobs]
          .filter((j) => j.job_status !== 'cancelled')
          .sort((a, b) =>
            (b.created_at ?? '').localeCompare(a.created_at ?? ''),
          );
      }

      const { data, error } = await supabase
        .from('vendor_requests')
        .select(
          `*,
           request_vendors!inner(job_status, vendor_id),
           client:profiles!client_id(first_name, last_name, phone, email)`,
        )
        .eq('request_vendors.vendor_id', vendorId as string)
        .not('request_vendors.job_status', 'eq', 'cancelled')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // PostgREST returns the embedded relations as either object or array
      // depending on cardinality. Normalize into the synthetic Job shape.
      return (data ?? []).map((row): Job => {
        const rvRaw = (row as { request_vendors: unknown }).request_vendors;
        const rv = Array.isArray(rvRaw) ? rvRaw[0] : rvRaw;
        const clientRaw = (row as { client: unknown }).client;
        const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
        // Strip the embedded keys so the rest of the row matches the
        // RequestRow shape exactly. (request_vendors and client are extras.)
        const { request_vendors: _rv, client: _client, ...rest } = row as Record<
          string,
          unknown
        > & { request_vendors: unknown; client: unknown };
        void _rv;
        void _client;
        return {
          ...(rest as unknown as Omit<Job, 'job_status' | 'client'>),
          job_status: (rv as { job_status: string | null } | null)?.job_status ?? null,
          client: (client as Job['client']) ?? null,
        };
      });
    },
  });
}
