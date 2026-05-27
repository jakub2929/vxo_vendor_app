import { useEffect, useRef } from 'react';
import { showToast } from '@/components/Toast';
import { useVendor } from '@/hooks/useVendor';

// Watch for live transitions of the approval lifecycle (profiles.status,
// surfaced on the cached vendor as `approval_status`) and fire a positive
// toast on the pending → approved edge. Pairs with useVendorRealtime — that
// hook pushes fresh data into the cache; this one observes the cache.
//
// Phase 5 hotfix: this watches the approval column (profiles.status) — NOT
// vendor_profiles.availability_status. The legacy 'active' value used to
// signify approval; under the column split, the corresponding terminal
// approval state is 'approved'.
//
// Edge cases:
//   - Cold open with approval already 'approved' (no transition observed):
//     the ref initializes to the current value, the effect's condition
//     fails, no toast. Correct.
//   - Pending → approved → pending → approved (Alfred wobble): toast fires
//     on each rising edge. Correct.
//   - Approval to 'suspended' / 'rejected': no positive toast (intentional;
//     spec calls those out as out-of-scope). TODO: distinct negative-state
//     toasts.
//
// TODO (Alfred / Ryan handoff): for vendors who are NOT in the app when
// approval lands, send a push notification via Expo Push API
// (POST https://exp.host/--/api/v2/push/send) to the vendor's device_tokens
// row. Title: "Your VXO account is approved!" Tap deep-links into /(tabs).
// Requires Alfred backend work — out of scope for this iteration; the
// in-app toast covers the "vendor has app open" case.
export function useVendorStatusToast() {
  const { vendor } = useVendor();
  const prevStatusRef = useRef<string | null>(vendor?.approval_status ?? null);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const next = vendor?.approval_status ?? null;

    if (prev === 'pending' && next === 'approved') {
      showToast({
        title: 'Account approved!',
        body: 'You can now receive jobs. Welcome to VXO.',
      });
    }

    prevStatusRef.current = next;
  }, [vendor?.approval_status]);
}
