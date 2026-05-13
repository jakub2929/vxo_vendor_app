import { router } from 'expo-router';
import { Inbox } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVendor } from '@/hooks/useVendor';
import { colors } from '@/theme';
import { ChatFAB } from './ChatFAB';
import { ChatsHeader } from './ChatsHeader';
import { ChatsTabStrip, type ChatsTab } from './ChatsTabStrip';
import { JobRow } from './JobRow';
import { MoreMenu } from './MoreMenu';
import { useJobs, type Job } from './useJobs';

// TODO: remove DEV_MOCK_JOBS before production — used only for visual checks
// against Figma node 4:10139 while the backend doesn't yet seed dev vendors
// with real jobs.
const DEV_MOCK_JOBS: Job[] = [
  buildMockJob('11111111-aaaa', 'hvac', 'dispatched', 5),
  buildMockJob('22222222-bbbb', 'plumbing', 'accepted', 120),
  buildMockJob('33333333-cccc', 'plumbing', 'on_site', 60 * 24),
  buildMockJob('44444444-dddd', 'plumbing', 'completed', 60 * 48),
  buildMockJob('55555555-eeee', 'plumbing', 'paid', 60 * 72),
];

function buildMockJob(id: string, trade: string, status: string, minutesAgo: number): Job {
  const t = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return {
    id,
    address: '123 Main St',
    assigned_vendor_id: 'dev',
    checkin_time: null,
    checkout_time: null,
    client_email: null,
    client_name: null,
    completion_photo_ids: null,
    created_at: t,
    description: null,
    dispatch_fee: 25,
    eta_datetime: null,
    eta_label: null,
    location_lat: null,
    location_lng: null,
    pm_id: null,
    status,
    trade,
    updated_at: t,
    urgency: 'normal',
    zip_code: '90210',
  };
}

export function ChatsScreen() {
  const { vendor, refresh } = useVendor();
  const { jobs: realJobs, loading } = useJobs(vendor?.id);
  const jobs = realJobs.length === 0 && __DEV__ ? DEV_MOCK_JOBS : realJobs;
  const [activeTab, setActiveTab] = useState<ChatsTab>('chats');
  const [menuVisible, setMenuVisible] = useState(false);

  const handleJobPress = (job: Job) => {
    // TODO: navigate to chat detail (#20) when implemented.
    console.log('[ChatsScreen] open job', job.id);
  };

  const handleVendorChange = () => {
    void refresh();
  };

  const handleContactVXO = () => {
    // TODO: route to VXO Support screen (#17) once that route exists.
    console.log('[ChatsScreen] contact VXO');
    Alert.alert('Contact VXO', 'Support chat — coming soon');
  };

  const handleProfile = () => {
    router.push('/(tabs)/profile');
  };

  const handleStripe = () => {
    // TODO: open Stripe Connect Express onboarding link in a WebView once the
    // backend endpoint to mint the account link is wired.
    console.log('[ChatsScreen] open Stripe');
    Alert.alert('Stripe Connect', 'Stripe onboarding — coming in next phase');
  };

  const handleSettings = () => {
    console.log('[ChatsScreen] open settings');
    Alert.alert('Settings', 'Settings — coming soon');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <ChatsHeader
          vendor={vendor}
          onVendorChange={handleVendorChange}
          onSearchPress={() => console.log('[ChatsScreen] search pressed')}
          onMorePress={() => setMenuVisible(true)}
          tabs={
            <ChatsTabStrip
              active={activeTab}
              chatsCount={jobs.length}
              onChange={setActiveTab}
            />
          }
        />
        {activeTab === 'chats' ? (
          <JobList jobs={jobs} loading={loading} onJobPress={handleJobPress} />
        ) : (
          <StatusPlaceholder />
        )}
        {activeTab === 'chats' && <ChatFAB onPress={handleContactVXO} />}
        <MoreMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onSelectContactVXO={handleContactVXO}
          onSelectProfile={handleProfile}
          onSelectStripe={handleStripe}
          onSelectSettings={handleSettings}
        />
      </View>
    </SafeAreaView>
  );
}

function JobList({
  jobs,
  loading,
  onJobPress,
}: {
  jobs: Job[];
  loading: boolean;
  onJobPress: (job: Job) => void;
}) {
  if (loading) {
    return (
      <View style={styles.skeletonContainer}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }
  if (jobs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Inbox color={colors.brand.primary} size={36} />
        </View>
        <Text style={styles.emptyTitle}>No jobs yet</Text>
        <Text style={styles.emptyBody}>
          When Alfred dispatches you a job, it&apos;ll appear here.
        </Text>
      </View>
    );
  }
  return (
    <FlatList
      data={jobs}
      keyExtractor={(j) => j.id}
      renderItem={({ item }) => <JobRow job={item} onPress={onJobPress} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.listContent}
    />
  );
}

function StatusPlaceholder() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>Status updates coming soon</Text>
      <Text style={styles.emptyBody}>
        Share check-ins with your dispatcher and PM right from here.
      </Text>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={styles.skeletonRow}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonText}>
        <View style={[styles.skeletonBar, { width: '60%' }]} />
        <View style={[styles.skeletonBar, { width: '40%', marginTop: 8 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.base },
  container: { flex: 1, backgroundColor: colors.surface.base },
  listContent: { paddingVertical: 8 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider.soft,
    marginLeft: 20 + 56 + 14, // align under text, past avatar
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brand.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 20,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  skeletonContainer: {
    paddingTop: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  skeletonAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface.muted,
  },
  skeletonText: { flex: 1 },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface.muted,
  },
});
