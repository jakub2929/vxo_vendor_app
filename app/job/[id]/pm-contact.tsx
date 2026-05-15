// PM (project manager) contact card. Opened from the Job Chat header's call
// button — Figma 29_Light_personal contact details (node 4:10041). The job
// owns a pm_id FK; we look the PM up in mockPMs for now. When Ryan's real
// project_managers table ships, swap the lookup for a Supabase join.
import { LinearGradient } from 'expo-linear-gradient';
import {
  Redirect,
  router,
  useLocalSearchParams,
} from 'expo-router';
import { ArrowLeft, ChevronRight, MessageSquare, Phone, Users } from 'lucide-react-native';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '@/theme';
import { getMockJob } from '@/lib/mockChatState';
import { mockPMs } from '@/lib/mockJobs';

const GRADIENT_START = { x: 0.913, y: 0.783 };
const GRADIENT_END = { x: 0.087, y: 0.217 };

export default function PmContactRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  if (!id) return <Redirect href="/(tabs)" />;
  const job = getMockJob(id);
  const pm = job?.pm_id ? mockPMs[job.pm_id] : null;

  // Empty state when PM data is unavailable.
  //
  // Previously this branch returned <Redirect href={`/job/${id}`} />, which
  // expo-router resolves as router.replace. That replaces the TOP of the
  // stack — but the original JobChatScreen at the bottom of the stack stays
  // mounted, so the post-redirect stack contains two JobChatScreen instances
  // with the same jobId, which causes useJobChatRealtime to attempt two
  // identically-named subscribes and supabase-js to throw "cannot add
  // postgres_changes callbacks for realtime:chat:{id} after subscribe()".
  //
  // Rendering an empty state instead of redirecting prevents the duplicate
  // mount. router.back() (via the header arrow) returns to the existing
  // JobChatScreen on the stack.
  //
  // TODO: real-mode PM lookup. getMockJob() only reads the in-memory mock
  // store; for real-DB jobs we need either a project_managers table + join
  // on jobs.pm_id, or a useQuery hook that hits Supabase. Seed jobs also
  // don't populate pm_id today, so this empty state will show for every
  // real-data job until both gaps are filled.
  if (!job || !pm) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={colors.brand.headerGradient}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.headerRow}>
            <Pressable
              hitSlop={12}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft color="#FFFFFF" size={28} />
            </Pressable>
          </View>
        </LinearGradient>
        <View style={[styles.body, styles.emptyBody]}>
          <Text style={styles.emptyTitle}>PM info not available</Text>
          <Text style={styles.emptyBodyText}>
            Project manager contact details aren&apos;t set up for this job
            yet. Use the chat thread to reach the dispatcher.
          </Text>
        </View>
      </View>
    );
  }

  const dialPm = () => {
    const tel = `tel:${pm.phone.replace(/[^+\d]/g, '')}`;
    void Linking.openURL(tel);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.brand.headerGradient}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#FFFFFF" size={28} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={dialPm}
            accessibilityRole="button"
            accessibilityLabel={`Call ${pm.name}`}
          >
            <Phone color="#FFFFFF" size={28} fill="#FFFFFF" />
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.identity}>
          <PmAvatar name={pm.name} url={pm.avatar_url} />
          <Text style={styles.name}>{pm.name}</Text>
          <Pressable
            onPress={dialPm}
            accessibilityRole="link"
            accessibilityLabel={`Call ${pm.phone}`}
          >
            <Text style={styles.phone}>{pm.phone}</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.subtitleBlock}>
          <Text style={styles.subtitle}>{pm.contact_subtitle}</Text>
          <Text style={styles.memberSince}>{pm.member_since}</Text>
        </View>

        <View style={styles.statRows}>
          <StatRow
            icon={<MessageSquare color={colors.text.primary} size={24} />}
            label="Jobs Completed"
            count={pm.jobs_completed}
          />
          <StatRow
            icon={<Users color={colors.text.primary} size={24} />}
            label={pm.email}
            count={pm.email_secondary_count}
          />
        </View>
      </View>
    </View>
  );
}

function PmAvatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // Real PM photo path — wire <Image source={{ uri: url }} /> when the
    // project_managers table ships and uploads exist.
    return <View style={[styles.avatar, styles.avatarFallback]} />;
  }
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitials}>{initials}</Text>
    </View>
  );
}

function StatRow({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <View style={styles.statRow} accessibilityRole="text">
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statCount}>{count}</Text>
      <ChevronRight color={colors.text.primary} size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  header: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
  },
  emptyBody: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyBodyText: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  identity: {
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
  },
  avatarFallback: {
    backgroundColor: colors.brand.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 48,
    color: colors.brand.dark,
  },
  name: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  phone: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.brand.dark,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider.soft,
    marginVertical: 24,
  },
  subtitleBlock: {
    gap: 8,
  },
  subtitle: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    color: colors.text.primary,
  },
  memberSince: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    letterSpacing: 0.2,
    color: '#424242',
  },
  statRows: {
    marginTop: 24,
    gap: 20,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    // Keep the row tall enough to be a comfortable touch target even though
    // taps are not wired per Figma — matches the 28px icon column.
    minHeight: 28,
    ...(Platform.OS === 'web' ? { cursor: 'default' as never } : null),
  },
  statIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    flex: 1,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: colors.text.primary,
  },
  statCount: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: colors.text.primary,
    textAlign: 'right',
  },
});
