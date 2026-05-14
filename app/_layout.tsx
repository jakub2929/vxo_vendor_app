import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { appReadyPromise } from '@/lib/appReady';
// Side-effect import: registers the foreground notification handler + tap
// response listener at module load (must run before any component mount).
import '@/lib/notifications';
import {
  clearUnlockedSession,
  isBiometricOffered,
  isPinConfigured,
  isSetupCompleted,
  isUnlockedThisSession,
  markUnlocked,
  subscribeLockChange,
} from '@/lib/pinStore';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { clearVendorCache, getVendor } from '@/lib/vendorCache';

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  // Bumped by the pinStore lock-change subscriber. Lets the AppState listener
  // (in supabase.ts) flip `unlockedThisSession` and have this effect re-run
  // without depending on segments/session changes, which don't fire on
  // background→foreground transitions.
  const [lockTick, setLockTick] = useState(0);
  const segments = useSegments();
  const router = useRouter();

  // Hold the redirect until the splash has had its minimum visible duration.
  // Shared with app/index.tsx via the singleton in src/lib/appReady.ts.
  useEffect(() => {
    let cancelled = false;
    void appReadyPromise.then(() => {
      if (!cancelled) setIsAppReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoaded(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' || !nextSession) {
        clearVendorCache();
        clearUnlockedSession();
      }
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(
    () => subscribeLockChange(() => setLockTick((t) => t + 1)),
    [],
  );

  useEffect(() => {
    if (!isAppReady || !authLoaded) {
      return;
    }

    const inPublic = segments[0] === '(public)';
    const inDebug = segments[0] === '_debug';
    const onFillProfile =
      segments[0] === '(public)' && segments[1] === 'fill-profile';
    const onSetupPin =
      segments[0] === '(authed-no-tabs)' && segments[1] === 'setup-pin';
    const onUnlock =
      segments[0] === '(authed-no-tabs)' && segments[1] === 'unlock';
    const onSetupBiometric =
      segments[0] === '(authed-no-tabs)' && segments[1] === 'setup-biometric';

    if (!session && !inPublic && !inDebug) {
      router.replace('/(public)/welcome');
      return;
    }

    if (!session) {
      return;
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      router.replace('/(tabs)');
      return;
    }

    let cancelled = false;
    void (async () => {
      const vendor = await getVendor();
      if (cancelled) return;
      const status = vendor?.status ?? null;

      if (!status) {
        if (!onFillProfile) router.replace('/(public)/fill-profile');
        return;
      }

      if (status === 'active' || status === 'out_of_office') {
        const [pinConfigured, setupCompleted] = await Promise.all([
          isPinConfigured(),
          isSetupCompleted(),
        ]);
        if (cancelled) return;

        if (pinConfigured && !isUnlockedThisSession()) {
          // Don't yank a user out of the biometric opt-in step. They have a
          // PIN configured but are still finishing onboarding — if the
          // inactivity timer fires while they're on this screen we want them
          // to finish setup, not see an unlock challenge. (The setup-pin
          // screen doesn't need the same guard because pinConfigured is
          // false until the PIN is actually saved.)
          if (onSetupBiometric) return;
          if (!onUnlock) router.replace('/(authed-no-tabs)/unlock');
          return;
        }

        if (!setupCompleted) {
          if (!onSetupPin) router.replace('/(authed-no-tabs)/setup-pin');
          return;
        }

        // Biometric offer step. Only ask when the user has a PIN configured
        // (biometric requires PIN as prerequisite) and we haven't yet asked
        // them about biometric. The setup-biometric screen itself decides
        // whether the device can actually do biometric — if not, it self-
        // skips by writing `biometric.offered='1'` and routing to (tabs),
        // which is invisible to the user.
        if (pinConfigured) {
          const biometricOffered = await isBiometricOffered();
          if (cancelled) return;
          if (!biometricOffered) {
            if (!onSetupBiometric) router.replace('/(authed-no-tabs)/setup-biometric');
            return;
          }
        }

        // PIN configured + already unlocked this session, OR setup was skipped
        // (setup_completed='1', no hash). Treat as unlocked so subsequent
        // AuthGate runs don't re-prompt within the same JS session.
        markUnlocked();
        if (inPublic || segments[0] === undefined) router.replace('/(tabs)');
        return;
      }

      // TODO: separate cleanup — suspended ≠ submitted. Today both route to
      // the inline "Application Submitted" success state; suspended vendors
      // should get distinct messaging.
      if (!onFillProfile) router.replace('/(public)/fill-profile?submitted=1');
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoaded, isAppReady, lockTick, router, segments, session]);

  // Stack (not Slot) so top-level routes (settings, search, job, learn-more)
  // become push-stacked children — gives them iOS edge-swipe-back. Group
  // children ((tabs), (public), (authed-no-tabs)) also live in this stack;
  // AuthGate uses router.replace between groups, which clears history, so
  // there's nothing to swipe back to from the first screen of a fresh group.
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthGate />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
