import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme';
import type { Database } from '@/types/database';
import { useToggleOOO } from './useToggleOOO';

type Vendor = Database['public']['Tables']['vendor_profiles']['Row'];

type Props = {
  vendor: Vendor;
};

// Indigo/slate gradient — distinct from PendingStatusBanner's orange so the
// two states read as different "moods" (admin-controlled limbo vs. vendor-
// controlled pause). Visual family is still warm-but-muted to avoid an
// alarm-red feel for a self-imposed state.
const GRADIENT_COLORS = ['#E8E9FF', '#DCDFFF'] as const;

// Persistent banner shown above the Jobs list whenever the vendor's status
// is 'out_of_office'. Tap anywhere on the banner resumes (no confirmation —
// turning OOO off is low-stakes; turning it on is the protected direction).
// Mutually exclusive with PendingStatusBanner by status, so no precedence
// check is needed here — the call site decides which (if any) to render.
export function OOOBanner({ vendor }: Props) {
  const { pending, resume } = useToggleOOO(vendor);

  if (vendor.status !== 'out_of_office') return null;

  return (
    <Pressable
      onPress={resume}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel="You're out of office. Tap to resume new jobs."
      style={({ pressed }) => (pressed || pending ? styles.dim : null)}
    >
      <LinearGradient
        colors={GRADIENT_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.container}
      >
        <Text style={styles.moon}>🌙</Text>
        <Text style={styles.text} numberOfLines={2}>
          <Text style={styles.lead}>You&apos;re out of office.</Text> New jobs
          won&apos;t be dispatched. Tap to resume.
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider.base,
  },
  moon: {
    fontSize: 18,
  },
  text: {
    flex: 1,
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.primary,
  },
  lead: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    color: colors.accent.indigo,
  },
  dim: {
    opacity: 0.6,
  },
});
