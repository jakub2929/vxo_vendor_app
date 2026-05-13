import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VXOWordmark } from '@/components/VXOWordmark';
import { colors } from '@/theme';
import { formatJobTime, getRowMetadata, type RowAccentColor, workOrderLabel } from './jobStatusLabel';
import type { Job } from './useJobs';

type Props = {
  job: Job;
  onPress?: (job: Job) => void;
};

// "Active" status set — jobs whose right-circle should use the brand-blue dot
// when there is no unread count. Anything completed/paid uses the muted dot.
const ACTIVE_STATUSES = new Set([
  'dispatched',
  'assigned',
  'accepted',
  'en_route',
  'on_site',
  'in_progress',
]);

function accentToColor(accent: RowAccentColor): string {
  switch (accent) {
    case 'danger':
      return colors.status.danger;
    case 'success':
      return colors.status.success;
    case 'primary':
      return colors.brand.primary;
    case 'secondary':
    default:
      return colors.text.tertiary;
  }
}

function statusDotColor(status: string | null | undefined): string {
  if (!status) return colors.text.tertiary;
  if (ACTIVE_STATUSES.has(status)) return colors.brand.primary;
  return colors.text.tertiary;
}

export function JobRow({ job, onPress }: Props) {
  const meta = getRowMetadata(job);
  const tradeLabel = job.trade
    ? job.trade.charAt(0).toUpperCase() + job.trade.slice(1)
    : 'Job';
  const timestamp = formatJobTime(job.updated_at ?? job.created_at);
  const rightCircleBg = accentToColor(meta.rightCircleColor);

  return (
    <Pressable
      onPress={() => onPress?.(job)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Job ${workOrderLabel(job.id)} ${tradeLabel}`}
    >
      <View style={styles.avatarWrap}>
        {/* Avatar mirrors Figma node I4:10146;546:6184 — the wordmark sits
            directly on the row with no circle/border; the small status dot is
            positioned bottom-right (3/4 inset). */}
        <VXOWordmark width={36} />
        <View style={[styles.statusDot, { backgroundColor: statusDotColor(job.status) }]} />
      </View>

      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {`WO# ${workOrderLabel(job.id)} - ${tradeLabel}`}
        </Text>
        {meta.topLabel && (
          <Text
            style={[styles.topLabel, { color: accentToColor(meta.topLabelColor ?? 'secondary') }]}
            numberOfLines={1}
          >
            {meta.topLabel}
          </Text>
        )}
        <Text
          style={[styles.subtitle, { color: accentToColor(meta.subtitleColor) }]}
          numberOfLines={1}
        >
          {meta.subtitleText}
        </Text>
      </View>

      <View style={styles.right}>
        <View style={[styles.rightCircle, { backgroundColor: rightCircleBg }]}>
          {typeof meta.rightCircleNumber === 'number' && (
            <Text style={styles.rightCircleText}>
              {meta.rightCircleNumber > 99 ? '99+' : meta.rightCircleNumber}
            </Text>
          )}
        </View>
        {!!timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
      </View>
    </Pressable>
  );
}

const AVATAR_SIZE = 56;
const STATUS_DOT = 12;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
    backgroundColor: colors.surface.base,
  },
  rowPressed: {
    backgroundColor: colors.surface.muted,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: STATUS_DOT,
    height: STATUS_DOT,
    borderRadius: STATUS_DOT / 2,
    borderWidth: 2,
    borderColor: colors.surface.base,
  },
  middle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    color: colors.text.primary,
    lineHeight: 22,
  },
  topLabel: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
  },
  subtitle: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
  },
  right: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 56,
  },
  rightCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightCircleText: {
    color: '#fff',
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 12,
  },
  timestamp: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 13,
    color: colors.text.secondary,
  },
});
