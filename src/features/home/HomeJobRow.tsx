import { StyleSheet, Text, View } from 'react-native';
import { VXOMascot } from '@/components/VXOMascot';
import { colors } from '@/theme';
import {
  progressBucket,
  statusLabel,
  type HomeRecentJob,
} from './useHomeData';

type Props = {
  job: HomeRecentJob;
};

// Figma nodes 4:10012 / 4:10014 / 4:10015 — the job list row.
// Per Q5: same VXO avatar circle for every row. Trade-specific avatars are
// deferred — see TODO. shortId is the display-ready job number (formatJobNumber).
export function HomeJobRow({ job }: Props) {
  const { label, emoji } = statusLabel(job.jobStatus, job.invoiceStatus);
  const { pct, fillColor } = progressBucket(job.jobStatus, job.invoiceStatus);
  const amount = job.total != null ? `$${Math.round(job.total)}` : '—';

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        {/* TODO: trade-specific avatars pending Ryan's call. */}
        <VXOMascot size={48} color={colors.brand.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {job.shortId} · {amount} · {label} {emoji}
        </Text>
        <View style={styles.progressTrack}>
          {fillColor && (
            <View
              style={[
                styles.progressFill,
                { width: `${pct}%`, backgroundColor: fillColor },
              ]}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    // Figma: 48px content + 12px padding + 1.5px border on each side = 75px
    // outer. RN box model includes border in width/height, so:
    //   width(75) - 2*border(1.5) - 2*padding(12) = 48 inner ✓
    width: 75,
    height: 75,
    padding: 12,
    borderRadius: 1000,
    borderWidth: 1.5,
    borderColor: colors.divider.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 25.2,
    color: colors.text.primary,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 8,
    width: '100%',
    borderRadius: 1000,
    backgroundColor: colors.divider.soft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1000,
  },
});
