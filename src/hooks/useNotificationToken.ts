import { useEffect } from 'react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useVendor } from '@/hooks/useVendor';

// Mounts at the authed-tabs root (alongside useVendorLocation). The OS push
// permission prompt fires the first time a vendor session is available; on
// denial, the hook degrades silently (no re-prompt, no alert).
//
// Also owns the token-rotation listener — Expo tokens can change at runtime
// (OS update, app reinstall, permission revoke+regrant), and a stale token
// means lost deliveries until the next cold start. Listener is scoped to the
// authed lifetime so we never UPDATE with `id=null` on a signed-out device.
//
// Phase 5: writes go to device_tokens keyed by auth.users.id + platform
// (no longer a column on vendor_profiles). Upsert with onConflict so token
// rotation overwrites in place.
export function useNotificationToken() {
  const { vendor } = useVendor();

  useEffect(() => {
    if (!vendor?.id) return;

    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId || cancelled) return;

      await registerForPushNotifications(userId);

      if (cancelled) return;
      subscription = Notifications.addPushTokenListener((event) => {
        void persistToken(userId, event.data);
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [vendor?.id]);
}

async function persistToken(userId: string, token: string): Promise<void> {
  try {
    const { error } = await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
      },
      { onConflict: 'user_id,platform' },
    );
    if (error) console.error('[push] Token upload failed:', error);
  } catch (e) {
    console.error('[push] Token upload threw:', e);
  }
}

async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) {
    // iOS Simulator / Android emulator can't receive push. Surface to dev
    // console only — no user-facing alert.
    console.warn('[push] Skipping registration — not a physical device.');
    return;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    // Silent degradation per spec — user declined, never nag.
    return;
  }

  // SDK 49+ requires an explicit EAS projectId — without it, getExpoPushTokenAsync
  // throws "No projectId found". Resolved from app.json's extra.eas.projectId
  // (populated by `eas init`) with easConfig as a fallback path.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] No EAS projectId. Run `eas init` first.');
    return;
  }

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    console.warn('[push] getExpoPushTokenAsync failed:', e);
    return;
  }
  console.log('[push:debug] Expo push token:', token); // TODO: remove before production

  await persistToken(userId, token);
}
