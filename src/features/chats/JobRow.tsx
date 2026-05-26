import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JobStatus } from '@/features/home/useHomeData';
import { colors } from '@/theme';
import { formatJobNumber } from '@/utils/formatters';
import type { Job } from '@/features/chat/types';
import { JobAvatar } from './JobAvatar';
import {
  formatRowTimestamp,
  jobStatusMeta,
} from './jobStatusMeta';

type Props = {
  job: Job;
  onPress?: () => void;
};

// Row layout (top → bottom in the content column):
//   1. Title (bold)   — formatJobNumber(jobId). Trade lives on the Job Chat
//                       header, not here, so the title stays scannable.
//   2. Status         — colored timing line. ETA / "On site" / "Completed".
//   3. Subtitle (gray)— "—" placeholder. Phase 5 dropped jobs.location_lat
//                       /location_lng so distance is unavailable until the
//                       backend exposes coordinates again.
//
// jobStatusMeta still carries an instruction subtitle ("Check in here when…")
// from the original Figma 4:10443 design — intentionally unused here now that
// the subtitle slot is reserved for distance.
export function JobRow({ job, onPress }: Props) {
  const meta = jobStatusMeta((job.job_status ?? 'pending') as JobStatus);
  const jobNumber = formatJobNumber(job.id);
  const timestamp = formatRowTimestamp(job.created_at ?? '');

  const status = composeStatus({
    literal: meta.literalHeadline,
    eta: job.eta_label,
  });
  // Distance was previously derived from jobs.location_lat/lng — both columns
  // were removed in the Phase 5 rename. Placeholder until Ryan re-exposes
  // coordinates (likely on vendor_requests directly).
  const distanceLabel = '—';

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
            on vendor_requests or job_messages today). Hidden until backend
            lands. */}
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
