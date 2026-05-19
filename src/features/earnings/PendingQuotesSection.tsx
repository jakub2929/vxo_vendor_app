import { useMemo } from 'react';
import { EarningsCard } from './EarningsCard';
import { EarningsSection } from './EarningsSection';
import { toMoney } from './types';
import { usePendingQuotes } from './usePendingQuotes';

type Props = {
  vendorId: string | null | undefined;
  onPressCard: (jobId: string) => void;
};

export function PendingQuotesSection({ vendorId, onPressCard }: Props) {
  const q = usePendingQuotes(vendorId);
  const rows = q.data ?? [];
  const total = useMemo(
    () => rows.reduce((s, r) => s + toMoney(r.total), 0),
    [rows],
  );

  return (
    <EarningsSection
      title="Quotes Pending"
      total={total}
      count={rows.length}
      isLoading={q.isLoading}
      isError={q.isError}
      emptyLabel="No pending quotes"
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
