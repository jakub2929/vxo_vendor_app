// Pending invoices for the Earnings tab. "Pending" = sent to the client but
// not yet paid: 'sent' | 'viewed' | 'approved' | 'overdue'. Ryan to confirm
// — easy to adjust by editing the status array.
//
// kind = 'invoice' (excludes quotes). Joins jobs!inner so each card can show
// client_name + trade without a second fetch. Orders by sent_at DESC so the
// most recently dispatched invoice is at the top.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EarningsRow } from './types';

const PENDING_INVOICE_STATUSES = ['sent', 'viewed', 'approved', 'overdue'];

export function usePendingInvoices(vendorId: string | null | undefined) {
  return useQuery<EarningsRow[]>({
    queryKey: ['earnings', 'pending-invoices', vendorId],
    enabled: !!vendorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, jobs!inner(client_name, trade)')
        .eq('vendor_id', vendorId as string)
        .eq('kind', 'invoice')
        .in('status', PENDING_INVOICE_STATUSES)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EarningsRow[];
    },
  });
}
