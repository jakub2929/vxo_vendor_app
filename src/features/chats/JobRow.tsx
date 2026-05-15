import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JobStatus } from '@/features/home/useHomeData';
import { useVendorLocation } from '@/hooks/useVendorLocation';
import { formatMiles, haversineMiles } from '@/lib/geo';
import { colors } from '@/theme';
import { formatJobNumber } from '@/utils/formatters';
import type { Database } from '@/types/database';
import { JobAvatar } from './JobAvatar';
import {
  formatRowTimestamp,
  jobStatusMeta,
} from './jobStatusMeta';

type Job = Database['public']['Tables']['jobs']['Row'];

type Props = {
  job: Job;
  onPress?: () => void;
};

// Row layout (top → bottom in the content column):
//   1. Title (bold)   — formatJobNumber(jobId). Trade lives on the Job Chat header,
//                       not here, so the title stays scannable.
//   2. Status         — colored timing line. ETA / "Today, 4:00 PM" /
//                       "Completed" / etc. No distance suffix.
//   3. Subtitle (gray)— straight-line distance from vendor GPS. "5.7 mi away"
//                       when known, "—" when GPS or coords are unavailable.
//
// jobStatusMeta still carries an instruction subtitle ("Check in here when…")
// from the original Figma 4:10443 design — intentionally unused here now that
// the subtitle slot is the distance line. Left in the meta module untouched
// so any other consumer keeps working.
export function JobRow({ job, onPress }: Props) {
  const meta = jobStatusMeta(job.status as JobStatus);
  const jobNumber = formatJobNumber(job.id);
  const timestamp = formatRowTimestamp(job.updated_at ?? job.created_at ?? '');

  const { data: vendorCoords } = useVendorLocation();
  const jobCoords =
    job.location_lat != null && job.location_lng != null
      ? { lat: Number(job.location_lat), lng: Number(job.location_lng) }
      : null;
  const distanceMi =
    vendorCoords && jobCoords ? haversineMiles(vendorCoords, jobCoords) : null;

  const status = composeStatus({
    literal: meta.literalHeadline,
    eta: job.eta_label,
  });
  const distanceLabel =
    distanceMi != null ? `${formatMiles(distanceMi)} mi away` : '—';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Job ${jobNumber}, ${status ?? 'no status'}, ${distanceLabel}`}
    >
      <JobAvatar dotVariant={meta.dotVariant} />

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {jobNumber}
        </Text>
        {status && (
          <Text
            style={[styles.status, { color: meta.headlineColor }]}
            numberOfLines={1}
          >
            {status}
          </Text>
        )}
        <Text style={styles.subtitle} numberOfLines={1}>
          {distanceLabel}
        </Text>
      </View>

      <View style={styles.rightColumn}>
        {/* TODO: unread badge — depends on schema (no read_at / unread_count
            on jobs or job_messages today). Hidden until backend lands. */}
        <Text style={styles.timestamp}>{timestamp}</Text>
      </View>
    </Pressable>
  );
}

function composeStatus(opts: {
  literal: string | null;
  eta: string | null;
}): string | null {
  if (opts.literal) return opts.literal;
  return opts.eta ?? null;
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
    fontSize: 17,
    lineHeight: 22,
    color: colors.text.primary,
  },
  status: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 18.2,
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
