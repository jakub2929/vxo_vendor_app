// Shared card for the three Earnings tab sections. Renders amount (right-
// aligned), job # + client/trade subtitle (left), date row, and a status pill.
// Tap → drill into the existing job chat where the invoice/quote bubble lives
// in the timeline (no dedicated view-existing screen yet).
//
// Status pill palette mirrors INVOICE_STATUS_BADGE / QUOTE_STATUS_BADGE from
// src/features/chat/JobChatTimelineItems.tsx so the same status reads the
// same color whether you see it on the chat timeline or here. Kept as a
// local table (rather than importing) because that file's tables are
// internal to the bubble renderer and exporting them would pull the badge
// into the public surface of JobChatTimelineItems.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { formatJobNumber, formatMoney } from '@/utils/formatters';
import type { EarningsRow } from './types';
import { toMoney } from './types';

type BadgeStyle = { label: string; bg: string; fg: string };

const INVOICE_STATUS_BADGE: Record<string, BadgeStyle> = {
  draft: { label: 'Draft', bg: '#E0E0E0', fg: '#424242' },
  sent: { label: 'Sent', bg: '#E3F2FD', fg: '#1565C0' },
  viewed: { label: 'Viewed', bg: '#E3F2FD', fg: '#1565C0' },
  approved: { label: 'Approved', bg: '#E8F5E9', fg: '#2E7D32' },
  paid: { label: 'Paid ✓', bg: '#E8F5E9', fg: '#2E7D32' },
  overdue: { label: 'Overdue', bg: '#FFEBEE', fg: '#C62828' },
  rejected: { label: 'Declined', bg: '#FFEBEE', fg: '#C62828' },
  cancelled: { label: 'Cancelled', bg: '#E0E0E0', fg: '#424242' },
};

const QUOTE_STATUS_BADGE: Record<string, BadgeStyle> = {
  draft: { label: 'Draft', bg: '#E0E0E0', fg: '#424242' },
  sent: { label: 'Pending', bg: '#FFF3E0', fg: '#E65100' },
  viewed: { label: 'Pending', bg: '#FFF3E0', fg: '#E65100' },
  accepted: { label: 'Accepted ✓', bg: '#E8F5E9', fg: '#2E7D32' },
  approved: { label: 'Accepted ✓', bg: '#E8F5E9', fg: '#2E7D32' },
  rejected: { label: 'Declined', bg: '#FFEBEE', fg: '#C62828' },
  expired: { label: 'Expired', bg: '#E0E0E0', fg: '#424242' },
  cancelled: { label: 'Cancelled', bg: '#E0E0E0', fg: '#424242' },
};

// Which timestamp to display per section. For pending: when it was sent.
// For paid: when it was paid. The pending-quotes section also uses sent_at.
type DateField = 'sent_at' | 'paid_at';

type Props = {
  invoice: EarningsRow;
  // Which row timestamp to show. Default 'sent_at'.
  dateField?: DateField;
  onPress?: () => void;
};

export function EarningsCard({ invoice, dateField = 'sent_at', onPress }: Props) {
  const isQuote = invoice.kind === 'quote';
  const badgeTable = isQuote ? QUOTE_STATUS_BADGE : INVOICE_STATUS_BADGE;
  const badge =
    badgeTable[invoice.status] ?? badgeTable.sent ?? INVOICE_STATUS_BADGE.sent;

  const total = toMoney(invoice.total);
  const jobNumber = formatJobNumber(invoice.job_id);
  const clientName = invoice.jobs?.client_name?.trim() || null;
  const trade = invoice.jobs?.trade ?? null;
  // Subtitle prefers client name; falls back to trade if missing (older mock
  // rows often have no client_name).
  const subtitle = clientName ?? trade ?? '—';
  const dateLabel = formatCardDate(invoice[dateField] ?? invoice.created_at);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${jobNumber}, ${formatMoney(total)}, ${badge.label}`}
    >
      <View style={styles.leftCol}>
        <Text style={styles.jobNumber} numberOfLines={1}>
          {jobNumber}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {dateLabel && <Text style={styles.date}>{dateLabel}</Text>}
      </View>
      <View style={styles.rightCol}>
        <Text style={styles.amount}>{formatMoney(total)}</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>
            {badge.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// "May 12" for the current year, "May 12, 2024" otherwise. Locale-aware via
// Intl. Returns '' on bad input rather than throwing so a malformed timestamp
// doesn't crash the list.
function formatCardDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.divider.soft,
  },
  cardPressed: {
    backgroundColor: colors.surface.muted,
  },
  leftCol: {
    flex: 1,
    gap: 4,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  jobNumber: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
    color: colors.text.primary,
  },
  subtitle: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    color: colors.text.bodyAlt,
  },
  date: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.tertiary,
  },
  amount: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
    color: colors.text.primary,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 1000,
  },
  badgeText: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
});
