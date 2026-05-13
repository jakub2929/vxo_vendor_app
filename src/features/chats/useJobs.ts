import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Job = Database['public']['Tables']['jobs']['Row'];

const TERMINAL_STATUSES = ['closed', 'cancelled'];

// TODO: Real last-message preview requires:
//   SELECT * FROM job_messages WHERE job_id = X ORDER BY created_at DESC LIMIT 1
// per visible job (a view, or a separate subscription per job). For v1 we show
// job.description as the subtitle — see JobRow.tsx.

export function useJobs(vendorId: string | undefined) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendorId) {
      setJobs([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchJobs = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('assigned_vendor_id', vendorId)
        .not('status', 'in', `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.warn('[useJobs] fetch', error);
      setJobs(data ?? []);
      setLoading(false);
    };

    void fetchJobs();

    // Realtime subscription
    const channel = supabase
      .channel(`vendor-jobs-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const next = payload.new as Job;
            if (TERMINAL_STATUSES.includes(next.status)) return;
            setJobs((prev) =>
              prev.some((j) => j.id === next.id) ? prev : [next, ...prev],
            );
          } else if (payload.eventType === 'UPDATE') {
            const next = payload.new as Job;
            setJobs((prev) => {
              if (TERMINAL_STATUSES.includes(next.status)) {
                return prev.filter((j) => j.id !== next.id);
              }
              return prev.map((j) => (j.id === next.id ? next : j));
            });
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<Job>;
            setJobs((prev) => prev.filter((j) => j.id !== old.id));
          }
        },
      )
      .subscribe();

    // Per Ryan's API reference: poll every 30s as a safety net for missed
    // Realtime events.
    const pollId = setInterval(() => {
      void fetchJobs();
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
  }, [vendorId]);

  return { jobs, loading };
}
