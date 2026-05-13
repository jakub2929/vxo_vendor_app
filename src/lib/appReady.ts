import * as Font from 'expo-font';

const APP_READY_MIN_MS = 1500;

const fontsPromise = Font.loadAsync({
  'Urbanist-Regular': require('../../assets/fonts/Urbanist-Regular.ttf'),
  'Urbanist-Medium': require('../../assets/fonts/Urbanist-Medium.ttf'),
  'Urbanist-SemiBold': require('../../assets/fonts/Urbanist-SemiBold.ttf'),
  'Urbanist-Bold': require('../../assets/fonts/Urbanist-Bold.ttf'),
  'Urbanist-ExtraBold': require('../../assets/fonts/Urbanist-ExtraBold.ttf'),
});

const minDelayPromise = new Promise<void>((resolve) => {
  setTimeout(resolve, APP_READY_MIN_MS);
});

// Singleton: created once at module load. Awaited by both the splash route
// (app/index.tsx) and AuthGate (app/_layout.tsx) so they share one readiness
// timer instead of racing two parallel ones.
export const appReadyPromise: Promise<void> = Promise.all([
  fontsPromise,
  minDelayPromise,
]).then(() => undefined);
