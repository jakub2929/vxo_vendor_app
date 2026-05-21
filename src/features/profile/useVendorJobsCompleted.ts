// Count of jobs the vendor has finished — used by the rating row on the
// Profile screen ("4.2 / 5.0 (N jobs)"). Counts rows in the `paid` and
// `complete` states (the closest match to the user-facing notion of
// "completed work"; cancelled / closed are excluded — `closed` is a
// post-paid archive state, `cancelled` never executed).
//
// Returns 0 when vendorId is null/undefined so the consumer can render
// "(no jobs yet)" without juggling an extra loading branch.
import { useQuery } from '@tanstack/react-query';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { mockJobs } from '@/lib/mockJobs';
import { supabase } from '@/lib/supabase';

const COMPLETED_STATUSES = ['paid', 'complete'] as const;

export function useVendorJobsCompleted(vendorId: string | null | undefined) {
  return useQuery<number>({
    queryKey: ['vendor', 'jobs-completed', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      if (USE_MOCKS) {
        return mockJobs.filter(
          (j) =>
            j.assigned_vendor_id === vendorId &&
            (COMPLETED_STATUSES as readonly string[]).includes(j.status ?? ''),
        ).length;
      }
      // head:true + count:'exact' returns just the row count, no payload.
      const { count, error } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_vendor_id', vendorId as string)
        .in('status', COMPLETED_STATUSES as unknown as string[]);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
