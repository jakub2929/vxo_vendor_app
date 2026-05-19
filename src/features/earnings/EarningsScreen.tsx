// Earnings tab body. Renders inside ChatsScreen as the third sub-tab (Jobs /
// Home / Earnings) — there's no app-level Tabs navigator. Three sections,
// per-section totals, drill-down on tap → existing job chat (invoice/quote
// bubbles live in that timeline; no dedicated view-existing screen yet).
//
// React Query handles caching + refetching. Pull-to-refresh invalidates the
// whole 'earnings' key group so all three sections reload together.
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useVendor } from '@/hooks/useVendor';
import { colors } from '@/theme';
import { PaidInvoicesSection } from './PaidInvoicesSection';
import { PendingInvoicesSection } from './PendingInvoicesSection';
import { PendingQuotesSection } from './PendingQuotesSection';

export function EarningsScreen() {
  const { vendor } = useVendor();
  const vendorId = vendor?.id;
  const qc = useQueryClient();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: ['earnings'] });
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const onPressCard = useCallback(
    (jobId: string) => {
      // No dedicated /invoice/[id] view screen yet — the invoice/quote bubble
      // already renders in the job chat timeline, so we drill into that.
      router.push(`/job/${jobId}`);
    },
    [router],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <PendingInvoicesSection vendorId={vendorId} onPressCard={onPressCard} />
      <PaidInvoicesSection vendorId={vendorId} onPressCard={onPressCard} />
      <PendingQuotesSection vendorId={vendorId} onPressCard={onPressCard} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    gap: 32,
  },
});
