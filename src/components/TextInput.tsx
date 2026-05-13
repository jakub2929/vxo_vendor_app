import { ReactNode, useMemo, useState } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  leftAdornment?: ReactNode;
  rightAdornment?: ReactNode;
  keyboardType?: RNTextInputProps['keyboardType'];
  autoCapitalize?: RNTextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
};

// Default state mirrors Figma node 4:10319 — bg #fafafa, no border, 60h,
// radius 16, gap 12, px 20. Focused state from screens 5/8 (sign-in/up
// typing) — brand-primary border + surfaceTint bg.
export function TextInput({
  value,
  onChangeText,
  placeholder,
  leftAdornment,
  rightAdornment,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
}: Props) {
  const [focused, setFocused] = useState(false);

  const containerStyle = useMemo(
    () => [styles.container, focused && styles.containerFocused],
    [focused],
  );

  return (
    <View style={containerStyle}>
      {leftAdornment ? <View style={styles.leftAdornment}>{leftAdornment}</View> : null}

      <RNTextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />

      {rightAdornment ? <View style={styles.rightAdornment}>{rightAdornment}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surface.mutedAlt,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  containerFocused: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.surfaceTint,
  },
  leftAdornment: {
    marginRight: spacing.sm + spacing.xs,
  },
  input: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flex: 1,
    padding: 0,
  },
  rightAdornment: {
    marginLeft: spacing.sm + spacing.xs,
  },
});
