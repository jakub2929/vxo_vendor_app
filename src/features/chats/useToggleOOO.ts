import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { setCachedVendor } from '@/lib/vendorCache';
import type { Database } from '@/types/database';

type Vendor = Database['public']['Tables']['vendor_profiles']['Row'];
type ToggleStatus = 'active' | 'out_of_office';

// Flip vendor_profiles.status between 'active' and 'out_of_office'.
// Optimistic local cache update on success; useVendorRealtime echoes the
// UPDATE to other devices once the vendor_profiles table is in the
// supabase_realtime publication.
//
// RLS caveat: vendor_own (003_rls_policies.sql) is FOR ALL with no WITH CHECK
// and no column restriction, so this UPDATE could in principle touch any
// column on the vendor's own row. Tighter column-level controls are bundled
// with other RLS hardening for Ryan; not blocking this toggle.
export function useToggleOOO(vendor: Vendor | null) {
  const [pending, setPending] = useState(false);

  const toggle = useCallback(
    async (target: ToggleStatus) => {
      if (!vendor || pending) return;
      if (vendor.status === target) return;

      setPending(true);
      try {
        const { error } = await supabase
          .from('vendor_profiles')
          .update({ status: target })
          .eq('id', vendor.id);
        if (error) {
          console.warn('[useToggleOOO] update failed', error.message);
          Alert.alert("Couldn't update status", error.message);
          return;
        }
        setCachedVendor({ ...vendor, status: target });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.warn('[useToggleOOO] threw', msg);
        Alert.alert("Couldn't update status", msg);
      } finally {
        setPending(false);
      }
    },
    [vendor, pending],
  );

  const requestOOO = useCallback(() => {
    if (!vendor || pending) return;
    Alert.alert(
      'Pause new dispatches?',
      'Active jobs will stay active. You can resume anytime by tapping the toggle.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause dispatches',
          style: 'destructive',
          onPress: () => {
            void toggle('out_of_office');
          },
        },
      ],
    );
  }, [vendor, pending, toggle]);

  const resume = useCallback(() => {
    void toggle('active');
  }, [toggle]);

  return { pending, requestOOO, resume };
}
