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

// First-name extractor for the row subtitle. "Sarah M." → "Sarah",
// "Sarah Miller" → "Sarah". Trims whitespace defensively; returns null
// when the input is empty/all whitespace so the renderer can fall back to
// status-only.
function firstNameOf(full: string | null): string | null {
  if (!full) return null;
  const first = full.trim().split(/\s+/)[0] ?? '';
  return first.length > 0 ? first : null;
}

// Figma nodes 4:10012 / 4:10014 / 4:10015 — the job list row.
// Per Q5: same VXO avatar circle for every row. Trade-specific avatars are
// deferred — see TODO. shortId is the display-ready job number (formatJobNumber).
//
// 2-line layout: Job# on top (bold primary), status + first-name on a muted
// second line. Amount was previously in the title but is dropped now — the
// earnings sections above this list already show per-invoice amounts, and
// keeping it here overflowed standard mobile widths.
export function HomeJobRow({ job }: Props) {
  const { label, emoji } = statusLabel(job.jobStatus, job.invoiceStatus);
  const { pct, fillColor } = progressBucket(job.jobStatus, job.invoiceStatus);
  const firstName = firstNameOf(job.clientName);
  const subtitle = firstName ? `${label} · ${firstName}` : label;

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        {/* TODO: trade-specific avatars pending Ryan's call. */}
        <VXOMascot size={48} color={colors.brand.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {job.shortId}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
          {subtitle} {emoji}
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
    // Tight vertical rhythm: title → subtitle ~2pt, subtitle → progressbar
    // gets its own marginTop below so the bar visually separates from text.
    gap: 2,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 25.2,
    color: colors.text.primary,
    overflow: 'hidden',
  },
  subtitle: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    letterSpacing: 0.2,
    color: colors.text.bodyAlt,
  },
  progressTrack: {
    marginTop: 8,
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
