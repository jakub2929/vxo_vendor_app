import { Platform } from 'react-native';
import { clearAllAuth, clearUnlockedSession } from './pinStore';
import { supabase } from './supabase';
import { clearVendorCache } from './vendorCache';

export async function signOut() {
  // Drop this device's push token row BEFORE the session is cleared —
  // otherwise the next vendor to sign in on the same device inherits push
  // routing for the previous user. Best-effort: any failure here (network,
  // RLS, missing row) must NOT block the supabase.auth.signOut() that
  // follows.
  //
  // Phase 5: writes go to device_tokens (user_id + platform composite key)
  // rather than the old vendors.expo_push_token column.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      console.warn(
        '[auth/signout] no authed user — skipping push token clear',
      );
    } else {
      const { data, error } = await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('platform', Platform.OS)
        .select('id');

      if (error) {
        console.error(
          '[auth/signout] failed to clear device token:',
          error.message,
        );
      } else if (!data || data.length === 0) {
        console.warn(
          '[auth/signout] device token clear matched 0 rows for',
          userId,
          Platform.OS,
          '— first sign-in on this device, or RLS DELETE policy missing',
        );
      } else {
        console.log(
          '[auth/signout] device token cleared',
          `(${data.length} row${data.length === 1 ? '' : 's'})`,
        );
      }
    }
  } catch (e) {
    console.error('[auth/signout] device token clear threw', e);
  }

  const result = await supabase.auth.signOut();
  clearVendorCache();
  await clearAllAuth();
  clearUnlockedSession();
  return result;
}
