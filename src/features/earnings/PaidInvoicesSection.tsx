import { useMemo } from 'react';
import { EarningsCard } from './EarningsCard';
import { EarningsSection } from './EarningsSection';
import { toMoney } from './types';
import { usePaidInvoices } from './usePaidInvoices';

type Props = {
  vendorId: string | null | undefined;
  onPressCard: (jobId: string) => void;
};

export function PaidInvoicesSection({ vendorId, onPressCard }: Props) {
  const q = usePaidInvoices(vendorId);
  const rows = q.data ?? [];
  const total = useMemo(
    () => rows.reduce((s, r) => s + toMoney(r.total), 0),
    [rows],
  );

  return (
    <EarningsSection
      title="Paid"
      total={total}
      count={rows.length}
      isLoading={q.isLoading}
      isError={q.isError}
      emptyLabel="No paid invoices yet"
    >
      {rows.map((inv) => (
        <EarningsCard
          key={inv.id}
          invoice={inv}
          dateField="paid_at"
          onPress={() => onPressCard(inv.job_id)}
        />
      ))}
    </EarningsSection>
  );
}
