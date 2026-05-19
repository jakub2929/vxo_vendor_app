import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PaidInvoicesSection } from '@/features/earnings/PaidInvoicesSection';
import { PendingInvoicesSection } from '@/features/earnings/PendingInvoicesSection';
import { PendingQuotesSection } from '@/features/earnings/PendingQuotesSection';
import { colors } from '@/theme';
import { HomeJobRow } from './HomeJobRow';
import { HomePromoCard } from './HomePromoCard';
import { HomeSummary } from './HomeSummary';
import {
  useHomeRecentJobs,
  useHomeStats,
  useHomeSummary,
} from './useHomeData';
import { useHomeRealtime } from './useHomeRealtime';

type Props = {
  vendorId: string | null | undefined;
};

export function HomeTab({ vendorId }: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const summary = useHomeSummary(vendorId);
  const stats = useHomeStats(vendorId);
  const recent = useHomeRecentJobs(vendorId);
  useHomeRealtime(vendorId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh both the home summary/stats/recent jobs and the three Earnings
      // section queries in one pull. Promise.all keeps the spinner up until
      // both invalidations resolve so the user doesn't release mid-refetch.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['home'] }),
        qc.invalidateQueries({ queryKey: ['earnings'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  const onPressEarningsCard = useCallback(
    (jobId: string) => {
      router.push(`/job/${jobId}`);
    },
    [router],
  );

  const isLoading =
    summary.isLoading || stats.isLoading || recent.isLoading;
  // Empty iff there are no recent jobs. A vendor with sent-but-unpaid invoices
  // necessarily has jobs (FK), so they'll show up in `recent` and won't trip
  // this — gating on `earnedThisMonth === 0` would have falsely flagged them.
  const isEmpty = !isLoading && (recent.data?.length ?? 0) === 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.summaryWrap}>
        <HomeSummary
          earnedThisMonth={summary.data?.earnedThisMonth ?? 0}
          jobsCount={summary.data?.jobsCount ?? 0}
          invoicesSent={stats.data?.invoicesSent ?? 0}
          invoicesPaid={stats.data?.invoicesPaid ?? 0}
        />
      </View>

      <View style={styles.earningsWrap}>
        <PendingInvoicesSection
          vendorId={vendorId}
          onPressCard={onPressEarningsCard}
        />
        <PaidInvoicesSection
          vendorId={vendorId}
          onPressCard={onPressEarningsCard}
        />
        <PendingQuotesSection
          vendorId={vendorId}
          onPressCard={onPressEarningsCard}
        />
      </View>

      <View style={styles.list}>
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : isEmpty ? (
          <EmptyHome />
        ) : (
          recent.data?.map((job) => (
            <HomeJobRow key={job.jobId} job={job} />
          ))
        )}
      </View>

      <View style={styles.promoWrap}>
        <HomePromoCard onPress={() => router.push('/learn-more')} />
      </View>
    </ScrollView>
  );
}

function SkeletonRow() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.avatar} />
      <View style={skeletonStyles.content}>
        <View style={skeletonStyles.titleBar} />
        <View style={skeletonStyles.progressBar} />
      </View>
    </View>
  );
}

function EmptyHome() {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.title}>No jobs yet 👋</Text>
      <Text style={emptyStyles.body}>
        Your earnings and recent jobs will show up here once your first
        dispatch comes in.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 24,
    gap: 24,
  },
  summaryWrap: {
    width: '100%',
  },
  earningsWrap: {
    width: '100%',
    // Section-to-section gap matches the parent ScrollView's gap (24) between
    // summary → earnings → list, so all three large blocks read as evenly
    // spaced. Inner section headers + card stacks use their own 12pt gaps.
    gap: 24,
  },
  list: {
    width: '100%',
    gap: 16,
  },
  promoWrap: {
    marginTop: 8,
  },
});

const skeletonStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: colors.surface.base,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.base,
  },
  avatar: {
    // Match real avatar outer size (HomeJobRow) so skeleton → data doesn't snap.
    width: 75,
    height: 75,
    borderRadius: 1000,
    backgroundColor: colors.divider.soft,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  titleBar: {
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.divider.soft,
  },
  progressBar: {
    height: 8,
    borderRadius: 1000,
    backgroundColor: colors.divider.soft,
  },
});

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 20,
    color: colors.text.primary,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22.4,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
