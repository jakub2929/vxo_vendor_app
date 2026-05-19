import { useMemo } from 'react';
import { EarningsCard } from './EarningsCard';
import { EarningsSection } from './EarningsSection';
import { toMoney } from './types';
import { usePendingInvoices } from './usePendingInvoices';

type Props = {
  vendorId: string | null | undefined;
  onPressCard: (jobId: string) => void;
};

export function PendingInvoicesSection({ vendorId, onPressCard }: Props) {
  const q = usePendingInvoices(vendorId);
  const rows = q.data ?? [];
  const total = useMemo(
    () => rows.reduce((s, r) => s + toMoney(r.total), 0),
    [rows],
  );

  return (
    <EarningsSection
      title="Pending"
      total={total}
      count={rows.length}
      isLoading={q.isLoading}
      isError={q.isError}
      emptyLabel="No pending invoices"
    >
      {rows.map((inv) => (
        <EarningsCard
          key={inv.id}
          invoice={inv}
          dateField="sent_at"
          onPress={() => onPressCard(inv.job_id)}
        />
      ))}
    </EarningsSection>
  );
}
