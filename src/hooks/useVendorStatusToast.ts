import { useEffect, useRef } from 'react';
import { showToast } from '@/components/Toast';
import { useVendor } from '@/hooks/useVendor';

// Watch for live transitions of `vendors.status` during the session and surface
// positive feedback via the global ToastHost. Pairs with useVendorRealtime —
// that hook pushes fresh data into the cache; this one observes the cache and
// fires the toast on the pending → active edge.
//
// Edge cases:
//   - Cold open with status already 'active' (no transition observed): the
//     ref initializes to the current status, the effect's condition fails,
//     no toast. Correct.
//   - Pending → active → pending → active (Alfred wobble): toast fires on
//     each rising edge. Correct.
//   - Status to 'suspended' / 'rejected': no positive toast (intentional;
//     spec calls those out as out-of-scope). The vendor still sees state
//     change via other surfaces. TODO: add distinct negative-state toasts.
//
// TODO (Alfred / Ryan handoff): for vendors who are NOT in the app when
// approval lands, send a push notification via Expo Push API
// (POST https://exp.host/--/api/v2/push/send) to the vendor's
// expo_push_token. Title: "Your VXO account is approved!" Tap deep-links
// into /(tabs). Requires Alfred backend work — out of scope for this
// iteration; the in-app toast covers the "vendor has app open" case.
export function useVendorStatusToast() {
  const { vendor } = useVendor();
  const prevStatusRef = useRef<string | null>(vendor?.status ?? null);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const next = vendor?.status ?? null;

    if (prev === 'pending' && next === 'active') {
      showToast({
        title: 'Account approved!',
        body: 'You can now receive jobs. Welcome to VXO.',
      });
    }

    prevStatusRef.current = next;
  }, [vendor?.status]);
}
