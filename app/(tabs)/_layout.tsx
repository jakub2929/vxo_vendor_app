import { Stack } from 'expo-router';
import { useNotificationToken } from '@/hooks/useNotificationToken';
import { useVendor } from '@/hooks/useVendor';
import { useVendorLocation } from '@/hooks/useVendorLocation';
import { useVendorRealtime } from '@/hooks/useVendorRealtime';
import { useVendorStatusToast } from '@/hooks/useVendorStatusToast';

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
  // Realtime subscription on the vendor's own row. Keeps the
  // PendingStatusBanner (and any other status-driven UI) in sync without a
  // force-quit when Alfred / admin flips `vendors.status` in Studio. Scoped
  // to the (tabs) tree so the channel is torn down on sign-out / pin lock.
  const { vendor } = useVendor();
  useVendorRealtime(vendor?.id);
  // Surface the pending → active transition as a one-time toast. Co-located
  // here so the listener is alive whenever the realtime channel is — both
  // tear down together on sign-out / route group change.
  useVendorStatusToast();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="support" />
    </Stack>
  );
}
