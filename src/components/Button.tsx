import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { colors, typography, spacing, radius, shadows } from '@/theme';

type ButtonVariant = 'primary' | 'secondary';

type Props = {
  onPress: () => void;
  children: ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export function Button({
  onPress,
  children,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && styles.disabled,
        style,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.surface.base : colors.brand.primary}
          size="small"
        />
      ) : (
        <Text
          style={
            variant === 'primary'
              ? styles.primaryText
              : styles.secondaryText
          }
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const buttonText = {
  ...typography.body,
  fontFamily: 'Urbanist-Bold',
  fontWeight: '700' as const,
};

const styles = StyleSheet.create({
  primary: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...shadows.glow,
  },
  secondary: {
    backgroundColor: colors.surface.base,
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryText: {
    ...buttonText,
    color: colors.surface.base,
  },
  secondaryText: {
    ...buttonText,
    color: colors.brand.primary,
  },
  disabled: {
    opacity: 0.5,
  },
});
