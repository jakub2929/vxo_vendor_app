import { Stack } from 'expo-router';

// /job/[id] is intentionally OUTSIDE the (tabs) group so the bottom tab bar
// hides on the chat detail. Mirrors the support `_layout` pattern.
export default function JobLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
