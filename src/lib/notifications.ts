import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { parsePushPayload, type PushPayload } from '@/types/pushPayload';

// Foreground display configuration. Expo docs require setNotificationHandler
// to run before any component that depends on notification behavior mounts —
// so this lives at module level and the module is imported from app/_layout.tsx.
// shouldShowBanner / shouldShowList are iOS 14+ additions and replace the
// deprecated shouldShowAlert (removed here to silence the SDK 54 warning).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function routeForPayload(payload: PushPayload): void {
  switch (payload.type) {
    case 'new_job':
    case 'client_message':
      router.push(`/job/${payload.job_id}` as const);
      return;
    case 'invoice_approved':
    case 'payment_received':
      router.push(`/job/${payload.job_id}/invoice` as const);
      return;
    case 'account_approved':
      // No navigation — the in-app toast (useVendorStatusToast) handles the
      // surface when the app is in foreground; tap just brings app forward.
      return;
  }
}

function handleResponse(raw: unknown): void {
  const payload = parsePushPayload(raw);
  if (!payload) {
    console.warn('[push] invalid payload', raw);
    return;
  }
  routeForPayload(payload);
}

// Module-level subscription (chosen over useEffect-in-root-layout): the layout
// effect would re-subscribe on Fast Refresh and could miss the narrow window
// between cold boot and first component mount. globalThis flag survives Fast
// Refresh in dev, so we never double-register.
const G = globalThis as unknown as { __vxoPushWired?: boolean };
if (!G.__vxoPushWired) {
  G.__vxoPushWired = true;

  Notifications.addNotificationResponseReceivedListener((response) => {
    handleResponse(response.notification.request.content.data);
  });

  // Cold-start case: the app was launched *by* a notification tap. The listener
  // above subscribes too late to see it, so we drain the last-response queue
  // once at module load.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      handleResponse(response.notification.request.content.data);
    }
  });
}
