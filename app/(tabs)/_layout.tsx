import { Stack } from 'expo-router';
import { useNotificationToken } from '@/hooks/useNotificationToken';
import { useVendorLocation } from '@/hooks/useVendorLocation';

export default function TabLayout() {
  // Mount the location hook at the authed-tabs root so the OS permission
  // prompt fires on first entry to the Jobs/Home screen, even when the vendor
  // has zero assigned jobs (JobRow wouldn't render, so the hook wouldn't fire
  // from inside the list). TanStack Query's cache is keyed on ['vendor-location'],
  // so JobRow callers reuse this single fetch.
  useVendorLocation();
  // Push notification permission + token registration. Co-located here so both
  // OS permission prompts (location + push) fire from the same mount point on
  // first authed entry. Silent degradation on denial — see the hook.
  useNotificationToken();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="support" />
    </Stack>
  );
}
