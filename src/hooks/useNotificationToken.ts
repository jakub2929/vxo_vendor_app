import { useEffect } from 'react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
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
export function useNotificationToken() {
  const { vendor } = useVendor();

  useEffect(() => {
    if (!vendor?.id) return;

    const vendorId = vendor.id;
    void registerForPushNotifications(vendorId);

    const subscription = Notifications.addPushTokenListener((event) => {
      void persistToken(vendorId, event.data);
    });

    return () => {
      subscription.remove();
    };
  }, [vendor?.id]);
}

async function persistToken(vendorId: string, token: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('vendors')
      .update({ expo_push_token: token })
      .eq('id', vendorId);
    if (error) console.error('[push] Token upload failed:', error);
  } catch (e) {
    console.error('[push] Token upload threw:', e);
  }
}

async function registerForPushNotifications(vendorId: string) {
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

  await persistToken(vendorId, token);
}
