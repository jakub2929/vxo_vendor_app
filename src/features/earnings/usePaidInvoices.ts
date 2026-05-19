// Paid invoices for the Earnings tab. status='paid', ordered by paid_at DESC
// so the most recently paid invoice is at the top. kind='invoice' excludes
// quotes (a quote shouldn't ever land in status='paid' under current flows,
// but the filter keeps the guarantee explicit).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EarningsRow } from './types';

export function usePaidInvoices(vendorId: string | null | undefined) {
  return useQuery<EarningsRow[]>({
    queryKey: ['earnings', 'paid-invoices', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, jobs!inner(client_name, trade)')
        .eq('vendor_id', vendorId as string)
        .eq('kind', 'invoice')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EarningsRow[];
    },
  });
}
