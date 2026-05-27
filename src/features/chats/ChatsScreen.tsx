// Note: This screen is labeled "Jobs / Home" in the UI per Figma. Internal naming
// ("chats", "ChatsScreen") is legacy; rename in a future cleanup if it bothers anyone.
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/components/Toast';
import { HomeTab } from '@/features/home/HomeTab';
import { useVendor } from '@/hooks/useVendor';
import { colors, shadows } from '@/theme';
import type { Job } from '@/features/chat/types';
import { ChatsHeader } from './ChatsHeader';
import { ChatsTabStrip, type ChatsTab } from './ChatsTabStrip';
import { JobsListBody } from './JobsListBody';
import { MoreMenu } from './MoreMenu';
import { OOOBanner } from './OOOBanner';
import { OOOToggle } from './OOOToggle';
import { PendingStatusBanner } from './PendingStatusBanner';
import { useJobsList } from './useJobsList';

// "Jobs" tab body has two states:
//   - empty: the welcome copy from Figma node 4:10155 (JobsWelcome below)
//   - populated: list of active jobs (Figma node 4:10164, the colliding
//     "17_FIrst Time Login" twin — see src/features/chats/JobRow.tsx)
// JobsListBody handles loading + empty/populated branching.
// "Home" tab body is Figma frame 4:9982 — see src/features/home/.
export function ChatsScreen() {
  const { vendor } = useVendor();
  const [activeTab, setActiveTab] = useState<ChatsTab>('jobs');
  const [menuVisible, setMenuVisible] = useState(false);
  // Tab strip count badge — uses the same query result that powers the list,
  // so the cache is shared and the number updates with Realtime invalidations.
  const { data: jobsForCount } = useJobsList(vendor?.id);

  const handleContactVXO = () => {
    router.push('/(tabs)/support');
  };

  const handleProfile = () => {
    router.push('/(tabs)/profile');
  };

  const handleStripe = () => {
    // TODO: open Stripe Connect Express onboarding link in a WebView once the
    // backend endpoint to mint the account link is wired.
    console.log('[ChatsScreen] open Stripe');
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <ChatsHeader
          onSearchPress={() => router.push('/search')}
          onMorePress={() => setMenuVisible(true)}
          leadingAction={vendor ? <OOOToggle vendor={vendor} /> : undefined}
          tabs={
            <ChatsTabStrip
              active={activeTab}
              onChange={setActiveTab}
              jobsCount={jobsForCount?.length ?? 0}
            />
          }
        />
        {activeTab === 'jobs' ? (
          <>
            {vendor?.approval_status === 'pending' && <PendingStatusBanner />}
            {vendor?.availability_status === 'out_of_office' && (
              <OOOBanner vendor={vendor} />
            )}
            <JobsListBody
              vendorId={vendor?.id}
              emptyState={
                <JobsWelcome
                  pending={vendor?.approval_status === 'pending'}
                  vendorId={vendor?.id}
                />
              }
              onRowPress={(jobId) => {
                router.push(`/job/${jobId}`);
              }}
            />
          </>
        ) : (
          <HomeTab vendorId={vendor?.id} />
        )}
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

function JobsWelcome({
  pending = false,
  vendorId,
}: {
  pending?: boolean;
  vendorId?: string | null;
}) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const before = qc.getQueryData<Job[]>(['jobs', 'list', vendorId]) ?? [];
      const beforeCount = before.length;

      await qc.invalidateQueries({ queryKey: ['jobs'] });
      await qc.refetchQueries({ queryKey: ['jobs'] });

      const after = qc.getQueryData<Job[]>(['jobs', 'list', vendorId]) ?? [];
      const afterCount = after.length;
      const newJobsCount = afterCount - beforeCount;

      if (newJobsCount > 0) {
        showToast({
          title: `Found ${newJobsCount} new job${newJobsCount > 1 ? 's' : ''}`,
          body: 'Check your Jobs list',
        });
      } else {
        showToast({
          title: 'No new jobs yet',
          body: 'Make sure your availability is ON and try again later',
        });
      }
    } catch {
      showToast({
        title: 'Could not refresh',
        body: 'Check your connection and try again',
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.bodyContainer}>
      <View style={styles.bodyInner}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Welcome! 👋</Text>
          <Text style={styles.subtitle}>
            {pending
              ? "No jobs yet — they'll appear here once your account is approved."
              : 'VXO AI connects you with local companies and homeowners who need your help.'}
          </Text>
        </View>
        {!pending && (
          <View style={styles.ctaGroup}>
            <Pressable
              onPress={onRefresh}
              disabled={refreshing}
              style={({ pressed }) => [
                styles.cta,
                (pressed || refreshing) && styles.ctaPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Accept your first Work Order"
            >
              {refreshing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.ctaText}>Accept your first Work Order</Text>
              )}
            </Pressable>
            <Text style={styles.hint}>
              Make sure your availability is ON and your service area covers nearby work.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.base },
  container: { flex: 1, backgroundColor: colors.surface.base },
  bodyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  bodyInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 32,
  },
  titleBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 40,
    lineHeight: 48,
    color: colors.brand.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  cta: {
    width: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  ctaPressed: { opacity: 0.9 },
  ctaText: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: '#ffffff',
    textAlign: 'center',
  },
  ctaGroup: {
    width: '100%',
    gap: 12,
    alignItems: 'stretch',
  },
  hint: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
