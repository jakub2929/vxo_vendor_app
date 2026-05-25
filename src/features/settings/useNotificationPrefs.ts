// Read + write the vendor's per-event push notification toggles.
//
// Reading goes through useVendor() — the vendor row is already cached and
// subscribed module-side via @/lib/vendorCache, so a separate React Query
// fetch would duplicate that cache. The mutation does use React Query for
// its lifecycle (isPending / onError), but the cache write is
// setCachedVendor(...) so every other useVendor() subscriber sees the
// optimistic update.
//
// Realtime: useVendorRealtime subscribes to UPDATE on vendors and calls
// refreshVendorCache() — so after the row hits the server, the same
// notification_prefs round-trips back and overwrites the optimistic value
// (no-op if they match).

import { useMutation } from '@tanstack/react-query';
import { useVendor } from '@/hooks/useVendor';
import { setCachedVendor } from '@/lib/vendorCache';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationEventType,
  type NotificationPrefs,
  readNotificationPrefs,
} from '@/types/notifications';

export function useNotificationPrefs() {
  const { vendor } = useVendor();

  const prefs: NotificationPrefs = vendor
    ? readNotificationPrefs(vendor.notification_prefs)
    : { ...DEFAULT_NOTIFICATION_PREFS };

  const togglePref = useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: NotificationEventType;
      value: boolean;
    }): Promise<NotificationPrefs> => {
      if (!vendor?.id) throw new Error('No vendor in session');
      const updated: NotificationPrefs = { ...prefs, [key]: value };

      // Optimistic cache write so the Switch lands snappily; if the server
      // call below rejects we restore the prior prefs in onError.
      setCachedVendor({ ...vendor, notification_prefs: updated });

      const { error } = await supabase
        .from('vendors')
        .update({ notification_prefs: updated })
        .eq('id', vendor.id);
      if (error) throw error;
      return updated;
    },
    onError: () => {
      // Rollback to the prefs we observed before the optimistic write. We
      // rebuild from the captured `vendor` rather than re-reading the cache
      // (which would already hold the optimistic value).
      if (vendor) {
        setCachedVendor({ ...vendor, notification_prefs: prefs });
      }
    },
  });

  return { prefs, togglePref };
}
