import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JobStatus } from '@/features/home/useHomeData';
import { useVendorLocation } from '@/hooks/useVendorLocation';
import { formatMiles, haversineMiles } from '@/lib/geo';
import { colors } from '@/theme';
import type { Database } from '@/types/database';
import { JobAvatar } from './JobAvatar';
import {
  formatRowTimestamp,
  jobStatusMeta,
  tradeLabel,
} from './jobStatusMeta';

type Job = Database['public']['Tables']['jobs']['Row'];

type Props = {
  job: Job;
  onPress?: () => void;
};

// 1:1 port of Figma "Account List, Type=Messenger List" (instances 4:10448–
// 4:10452 inside frame 4:10443 "Home Page Open Work Orders"). Layout:
//   [60×60 avatar + status dot] [title / headline / subtitle] [timestamp]
// Headline composition:
//   - eta_label + distance → "4 Hour - 2.5 Miles Away"  (red)
//   - eta_label only       → "This Week"                (red)
//   - distance only        → "2.5 Miles Away"           (red)
//   - literal (terminal)   → "Completed"                (green)
// Distance comes from useVendorLocation (GPS) + the job's stored coords.
// Permission-denied / coords-missing simply omits the distance suffix —
// never blocks the row.
//
// Badge (the "5" / "2" pill in Figma) is intentionally hidden: jobs and
// job_messages have no read_at / unread_count column, so any number would
// be invented. See TODO below.
export function JobRow({ job, onPress }: Props) {
  const meta = jobStatusMeta(job.status as JobStatus);
  const shortId = job.id.slice(0, 8);
  const trade = tradeLabel(job.trade);
  const timestamp = formatRowTimestamp(job.updated_at ?? job.created_at ?? '');

  const { data: vendorCoords } = useVendorLocation();
  const jobCoords =
    job.location_lat != null && job.location_lng != null
      ? { lat: Number(job.location_lat), lng: Number(job.location_lng) }
      : null;
  const distanceMi =
    vendorCoords && jobCoords ? haversineMiles(vendorCoords, jobCoords) : null;

  const headline = composeHeadline({
    literal: meta.literalHeadline,
    eta: job.eta_label,
    distanceMi,
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Work order ${shortId} ${trade}, ${headline ?? 'no status'}`}
    >
      <JobAvatar dotVariant={meta.dotVariant} />

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {/* TODO: human-readable short job ID — pending Ryan comment */}
          WO# {shortId} - {trade}
        </Text>
        {headline && (
          <Text
            style={[styles.headline, { color: meta.headlineColor }]}
            numberOfLines={1}
          >
            {headline}
          </Text>
        )}
        {meta.subtitle.length > 0 && (
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {meta.subtitle}
          </Text>
        )}
      </View>

      <View style={styles.rightColumn}>
        {/* TODO: unread badge — depends on schema (no read_at / unread_count
            on jobs or job_messages today). Hidden until backend lands. */}
        <Text style={styles.timestamp}>{timestamp}</Text>
      </View>
    </Pressable>
  );
}

function composeHeadline(opts: {
  literal: string | null;
  eta: string | null;
  distanceMi: number | null;
}): string | null {
  if (opts.literal) return opts.literal;
  const parts: string[] = [];
  if (opts.eta) parts.push(opts.eta);
  if (opts.distanceMi != null) {
    parts.push(`${formatMiles(opts.distanceMi)} Miles Away`);
  }
  return parts.length > 0 ? parts.join(' - ') : null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: colors.surface.base,
  },
  rowPressed: {
    backgroundColor: colors.surface.muted,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 21.6,
    color: colors.text.primary,
  },
  headline: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    letterSpacing: 0.2,
    color: '#616161',
  },
  rightColumn: {
    width: 90,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    paddingBottom: 6,
  },
  timestamp: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    letterSpacing: 0.2,
    color: '#616161',
    textAlign: 'right',
  },
});
