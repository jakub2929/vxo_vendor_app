// Pending quotes for the Earnings tab. "Pending" here = sent to the client
// but not yet accepted or rejected: 'sent' | 'viewed'. 'accepted' is
// intentionally excluded — once a quote is accepted it converts to an
// invoice flow per Ryan's design (pending confirmation; agent flagged in
// the investigation report). Ordered by sent_at DESC.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EarningsRow } from './types';

const PENDING_QUOTE_STATUSES = ['sent', 'viewed'];

export function usePendingQuotes(vendorId: string | null | undefined) {
  return useQuery<EarningsRow[]>({
    queryKey: ['earnings', 'pending-quotes', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(
          `*, vendor_requests!inner(service_type, client:profiles!client_id(first_name, last_name))`,
        )
        .eq('vendor_id', vendorId as string)
        .eq('kind', 'quote')
        .in('status', PENDING_QUOTE_STATUSES)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EarningsRow[];
    },
  });
}
