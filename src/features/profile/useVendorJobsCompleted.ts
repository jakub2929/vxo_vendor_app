// Count of jobs the vendor has finished — used by the rating row on the
// Profile screen ("4.2 / 5.0 (N jobs)").
//
// Phase 5: counts request_vendors rows where job_status='completed' for this
// vendor. The legacy ('paid' | 'complete') two-state filter is gone — Ryan's
// schema collapses settlement state into a single 'completed' job_status.
//
// Returns 0 when vendorId is null/undefined so the consumer can render
// "(no jobs yet)" without juggling an extra loading branch.
import { useQuery } from '@tanstack/react-query';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { mockJobs } from '@/lib/mockJobs';
import { supabase } from '@/lib/supabase';

export function useVendorJobsCompleted(vendorId: string | null | undefined) {
  return useQuery<number>({
    queryKey: ['vendor', 'jobs-completed', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      if (USE_MOCKS) {
        return mockJobs.filter(
          (j) =>
            j.assigned_vendor_id === vendorId && j.status === 'completed',
        ).length;
      }
      // head:true + count:'exact' returns just the row count, no payload.
      const { count, error } = await supabase
        .from('request_vendors')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId as string)
        .eq('job_status', 'completed');
      if (error) throw error;
      return count ?? 0;
    },
  });
}
