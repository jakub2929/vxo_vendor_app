import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { appReadyPromise } from '@/lib/appReady';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { clearVendorCache, getVendor } from '@/lib/vendorCache';

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
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
      if (event === 'SIGNED_OUT' || !nextSession) clearVendorCache();
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAppReady || !authLoaded) {
      return;
    }

    const inPublic = segments[0] === '(public)';
    const inDebug = segments[0] === '_debug';
    const onFillProfile =
      segments[0] === '(public)' && segments[1] === 'fill-profile';

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
    void getVendor().then((vendor) => {
      if (cancelled) return;
      const status = vendor?.status ?? null;
      if (!status) {
        if (!onFillProfile) router.replace('/(public)/fill-profile');
      } else if (status === 'active' || status === 'out_of_office') {
        if (inPublic || segments[0] === undefined) router.replace('/(tabs)');
      } else {
        // pending or suspended → show success state
        if (!onFillProfile) router.replace('/(public)/fill-profile?submitted=1');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authLoaded, isAppReady, router, segments, session]);

  return <Slot />;
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
