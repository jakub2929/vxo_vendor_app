import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import type { Database } from '@/types/database';
import { useToggleOOO } from './useToggleOOO';

type Vendor = Database['public']['Tables']['vendors']['Row'];

type Props = {
  vendor: Vendor;
};

// Compact pill (~64-72px wide) in the ChatsHeader right cluster, ahead of
// Search/More. Active = green "ON" with confirmation Alert on tap; OOO = red
// "OFF" with instant resume on tap. Disabled (dimmed) during in-flight UPDATE
// to prevent double-taps. See useToggleOOO for the mutation + optimistic
// cache write.
//
// Renders null for non-toggleable statuses (pending/suspended/rejected/null) —
// a pending vendor can't pre-set themselves OOO before approval.
export function OOOToggle({ vendor }: Props) {
  const isOOO = vendor.status === 'out_of_office';
  const isActive = vendor.status === 'active';
  const { pending, requestOOO, resume } = useToggleOOO(vendor);

  if (!isOOO && !isActive) return null;

  const onPress = () => {
    if (isOOO) resume();
    else requestOOO();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: isActive, disabled: pending }}
      accessibilityLabel={
        isOOO
          ? 'Out of office. Tap to resume new jobs.'
          : 'Active. Tap to pause new jobs.'
      }
      style={({ pressed }) => [
        styles.pill,
        isOOO ? styles.pillOff : styles.pillOn,
        (pressed || pending) && styles.pillDim,
      ]}
    >
      <View style={styles.dot} />
      <Text style={styles.label}>{isOOO ? 'OFF' : 'ON'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  pillOn: {
    backgroundColor: colors.status.success,
  },
  pillOff: {
    backgroundColor: colors.status.danger,
  },
  pillDim: {
    opacity: 0.6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
});
