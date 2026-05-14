import { Stack } from 'expo-router';

// Authenticated screens that should not show the bottom tab bar — PIN setup,
// PIN unlock, biometric setup. AuthGate routes signed-in vendors here while
// they're between the "approved" state and the "ready for Jobs" state.
//
// Distinct from (public) — these screens require a Supabase session. If the
// session disappears, AuthGate's `!session && !inPublic && !inDebug` rule
// redirects to /(public)/welcome, which is exactly what we want.
export default function AuthedNoTabsLayout() {
  // Security screens: swipe-back must not let users escape the PIN/biometric
  // flow. AuthGate enters them via router.replace (empty back stack), so
  // gesture has nowhere to go anyway — this is defense in depth in case a
  // future code path ever pushes onto these screens.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="unlock" options={{ gestureEnabled: false }} />
      <Stack.Screen name="setup-pin" options={{ gestureEnabled: false }} />
      <Stack.Screen name="setup-biometric" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
