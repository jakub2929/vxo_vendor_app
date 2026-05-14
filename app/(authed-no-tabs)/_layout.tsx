import { Stack } from 'expo-router';

// Authenticated screens that should not show the bottom tab bar — PIN setup,
// PIN unlock, biometric setup. AuthGate routes signed-in vendors here while
// they're between the "approved" state and the "ready for Jobs" state.
//
// Distinct from (public) — these screens require a Supabase session. If the
// session disappears, AuthGate's `!session && !inPublic && !inDebug` rule
// redirects to /(public)/welcome, which is exactly what we want.
export default function AuthedNoTabsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
