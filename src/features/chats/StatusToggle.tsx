import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { setCachedVendor } from '@/lib/vendorCache';
import { colors } from '@/theme';
import type { Database } from '@/types/database';

type Vendor = Database['public']['Tables']['vendors']['Row'];

type Props = {
  vendor: Vendor | null;
  onChange: (next: Vendor) => void;
};

export function StatusToggle({ vendor, onChange }: Props) {
  const [busy, setBusy] = useState(false);

  if (!vendor) return null;
  const status = vendor.status;
  const isActive = status === 'active';
  const isOOO = status === 'out_of_office';
  const enabled = isActive || isOOO;

  const handlePress = async () => {
    if (!enabled || busy) return;
    const next = isActive ? 'out_of_office' : 'active';
    setBusy(true);
    // Optimistic
    const optimistic = { ...vendor, status: next };
    setCachedVendor(optimistic);
    onChange(optimistic);
    const { error } = await supabase
      .from('vendors')
      .update({ status: next })
      .eq('id', vendor.id);
    if (error) {
      console.warn('[StatusToggle] update failed', error);
      setCachedVendor(vendor);
      onChange(vendor);
    }
    setBusy(false);
  };

  const bg = !enabled
    ? 'rgba(255,255,255,0.25)'
    : isActive
      ? colors.status.success
      : colors.status.danger;
  const label = !enabled ? 'Pending' : isActive ? 'Active' : 'Out';

  return (
    <Pressable
      onPress={handlePress}
      disabled={!enabled || busy}
      style={[styles.pill, { backgroundColor: bg }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: isActive, disabled: !enabled }}
      accessibilityLabel={`Status ${label}`}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 72,
    height: 28,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#fff',
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
