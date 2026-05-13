import { Stack } from 'expo-router';

// /learn-more is intentionally OUTSIDE the (tabs) group so the bottom tab
// bar hides and we get a native push transition. Mirrors the /job/_layout
// pattern.
export default function LearnMoreLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
