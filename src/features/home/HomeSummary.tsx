import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

type Props = {
  earnedThisMonth: number;
  jobsCount: number;
  invoicesSent: number;
  invoicesPaid: number;
};

function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

// Figma node 4:9986 — the "This Month" header band + two stat tiles.
export function HomeSummary({
  earnedThisMonth,
  jobsCount,
  invoicesSent,
  invoicesPaid,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>
          This Month: {formatUsd(earnedThisMonth)} earned · {jobsCount}{' '}
          {jobsCount === 1 ? 'job' : 'jobs'}
        </Text>
        <View style={styles.headerLine} />
      </View>
      <View style={styles.tilesRow}>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{formatUsd(invoicesSent)}</Text>
          <Text style={styles.tileLabel}>Invoices Sent</Text>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{formatUsd(invoicesPaid)}</Text>
          <Text style={styles.tileLabel}>Completed</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerText: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.tertiary,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider.soft,
  },
  tilesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tileValue: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28,
    color: colors.text.primary,
    textAlign: 'center',
  },
  tileLabel: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 19.2,
    letterSpacing: 0.2,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  verticalDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.divider.soft,
  },
});
