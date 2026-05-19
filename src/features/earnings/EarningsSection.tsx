// Shared section shell for the Earnings tab: header row (title + aggregate
// total + count), a vertical stack of EarningsCards, and a skeleton / empty
// state per section. Kept separate from the three thin per-section files so
// section-level layout is in one place.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { formatMoney } from '@/utils/formatters';

type Props = {
  title: string;
  // Total displayed in the section header. Pre-summed by the parent so the
  // section doesn't need to know how to extract amounts.
  total: number;
  count: number;
  isLoading: boolean;
  isError: boolean;
  emptyLabel: string;
  children?: ReactNode;
};

export function EarningsSection({
  title,
  total,
  count,
  isLoading,
  isError,
  emptyLabel,
  children,
}: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          {!isLoading && !isError && count > 0 && (
            <Text style={styles.count}>{count}</Text>
          )}
        </View>
        {!isLoading && !isError && (
          <Text style={styles.total}>{formatMoney(total)}</Text>
        )}
      </View>
      {isLoading ? (
        <SectionSkeleton />
      ) : isError ? (
        <Text style={styles.errorText}>Couldn't load — pull to refresh.</Text>
      ) : count === 0 ? (
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      ) : (
        <View style={styles.cardStack}>{children}</View>
      )}
    </View>
  );
}

function SectionSkeleton() {
  return (
    <View style={styles.cardStack}>
      <View style={skel.card} />
      <View style={skel.card} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 28,
    color: colors.text.primary,
  },
  count: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.tertiary,
  },
  total: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
    color: colors.text.primary,
  },
  cardStack: {
    gap: 12,
  },
  emptyText: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    color: colors.text.tertiary,
    paddingVertical: 16,
  },
  errorText: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    color: colors.status.danger,
    paddingVertical: 16,
  },
});

const skel = StyleSheet.create({
  card: {
    height: 78,
    borderRadius: 12,
    backgroundColor: colors.divider.soft,
  },
});
