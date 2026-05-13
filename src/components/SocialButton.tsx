import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { AppleIcon, FacebookIcon, GoogleIcon } from './brand-icons';

export type SocialVariant = 'facebook' | 'google' | 'apple';

type Props = {
  variant: SocialVariant;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

const ICONS: Record<SocialVariant, () => React.JSX.Element> = {
  facebook: () => <FacebookIcon size={24} />,
  google: () => <GoogleIcon size={24} />,
  apple: () => <AppleIcon size={24} />,
};

// Mirrors Figma node 4:10390/10391/10392 — white bg, 1px border #eee,
// rounded 16, padding 32/18, icon (24px) + label (Urbanist SemiBold 16/22.4
// color #212121) centered as a row with 12px gap.
export function SocialButton({ variant, label, onPress, disabled = true }: Props) {
  // Visual placeholders per spec — OAuth providers are not wired.
  const Icon = ICONS[variant];
  return (
    <Pressable
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      accessibilityState={{ disabled }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.row}>
        <Icon />
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider.soft,
    backgroundColor: colors.surface.base,
    paddingHorizontal: spacing.xl,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  label: {
    ...typography.body,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    color: colors.text.primary,
  },
});
