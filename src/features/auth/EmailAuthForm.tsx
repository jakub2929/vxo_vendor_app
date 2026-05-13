import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Checkbox, Header, TextInput, VXOWordmark } from '@/components';
import { colors, spacing, typography } from '@/theme';

type Props = {
  title: string;
  buttonLabel: string;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
  onSubmit: (email: string) => Promise<void>;
};

// Mirrors Figma node 4:10313 (blank sign-in form) / 4:10312 (sign-up). Outer
// column uses justify-between to distribute equal vertical space between
// navbar → wordmark → title → input-stack → footer, matching Figma's auto-
// layout spacing math.
export function EmailAuthForm({
  title,
  buttonLabel,
  footerText,
  footerLinkText,
  footerLinkHref,
  onSubmit,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

    if (!isEmailValid) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      await onSubmit(normalizedEmail);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={spacing.md}
    >
      <View style={styles.contentContainer}>
        <Header />

        <VXOWordmark width={290} />

        <Text style={styles.title}>{title}</Text>

        <View style={styles.inputStack}>
          <TextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            placeholder="fistlast@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.rememberRow}>
            <Checkbox value={rememberMe} onValueChange={setRememberMe} label="Remember me" />
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Button onPress={handleSubmit} loading={isLoading} disabled={isLoading}>
            {buttonLabel}
          </Button>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{footerText}</Text>
          <Pressable
            onPress={() => router.replace(footerLinkHref as any)}
            hitSlop={8}
          >
            <Text style={styles.footerLink}>{footerLinkText}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    width: '100%',
  },
  inputStack: {
    width: '100%',
    gap: spacing.xl,
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.danger,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
  footerLink: {
    ...typography.bodySmall,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    color: colors.brand.primary,
  },
});
