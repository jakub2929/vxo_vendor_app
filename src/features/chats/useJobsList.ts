import { useQuery } from '@tanstack/react-query';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { mockJobs } from '@/lib/mockJobs';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Job = Database['public']['Tables']['jobs']['Row'];

// "Active jobs" — anything the vendor still has business with. Closed and
// cancelled jobs are filtered out (per the platform API reference's
// "Get vendor's active jobs" example). Paid jobs stay visible because the
// Figma row design has a "Completed" state with grey dot and "Payment
// received" subtitle.
export function useJobsList(vendorId: string | null | undefined) {
  return useQuery<Job[]>({
    queryKey: ['jobs', 'list', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      if (USE_MOCKS) {
        return [...mockJobs]
          .filter((j) => j.status !== 'closed' && j.status !== 'cancelled')
          .sort((a, b) =>
            (b.updated_at ?? '').localeCompare(a.updated_at ?? ''),
          );
      }

      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('assigned_vendor_id', vendorId as string)
        .not('status', 'in', '("closed","cancelled")')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
