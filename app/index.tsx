import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Splash } from '@/components/Splash';
import { appReadyPromise } from '@/lib/appReady';

// Hold the native splash on screen until JS has rendered the RN splash.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// TODO: route decision (signed-in → /(tabs), else → /(public)/welcome) is owned
// by AuthGate in app/_layout.tsx. This route is purely presentational — it
// renders the brand splash and waits on `appReadyPromise`. AuthGate's redirect
// fires after both `appReadyPromise` and `supabase.auth.getSession()` resolve.
export default function Index() {
  useFonts({
    'Urbanist-Regular': require('../assets/fonts/Urbanist-Regular.ttf'),
    'Urbanist-Medium': require('../assets/fonts/Urbanist-Medium.ttf'),
    'Urbanist-SemiBold': require('../assets/fonts/Urbanist-SemiBold.ttf'),
    'Urbanist-Bold': require('../assets/fonts/Urbanist-Bold.ttf'),
    'Urbanist-ExtraBold': require('../assets/fonts/Urbanist-ExtraBold.ttf'),
  });

  useEffect(() => {
    let cancelled = false;
    void appReadyPromise.then(() => {
      if (cancelled) return;
      SplashScreen.hideAsync().catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Splash />;
}
