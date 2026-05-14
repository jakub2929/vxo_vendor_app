import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

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

type NotificationData = {
  type?: string;
  jobId?: string;
};

function handleResponse(data: NotificationData | null | undefined) {
  if (!data) return;
  if (data.type === 'job' && data.jobId) {
    router.push(`/job/${data.jobId}` as const);
  }
  // data.type === 'test' (and any unknown types) fall through — the OS already
  // foregrounded the app on tap, that's all the dev test button needs.
}

// Module-level subscription (chosen over useEffect-in-root-layout): the layout
// effect would re-subscribe on Fast Refresh and could miss the narrow window
// between cold boot and first component mount. globalThis flag survives Fast
// Refresh in dev, so we never double-register.
const G = globalThis as unknown as { __vxoPushWired?: boolean };
if (!G.__vxoPushWired) {
  G.__vxoPushWired = true;

  Notifications.addNotificationResponseReceivedListener((response) => {
    handleResponse(
      response.notification.request.content.data as NotificationData,
    );
  });

  // Cold-start case: the app was launched *by* a notification tap. The listener
  // above subscribes too late to see it, so we drain the last-response queue
  // once at module load.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      handleResponse(
        response.notification.request.content.data as NotificationData,
      );
    }
  });
}
