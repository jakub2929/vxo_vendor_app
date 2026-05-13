import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Header, Screen } from '@/components';
import { OTPInput } from '@/features/auth/OTPInput';
import { useCountdown } from '@/hooks/useCountdown';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme';

const OTP_LENGTH = 6;
const SECTION_GAP = 60; // gap between subtitle / boxes / countdown — per Figma 4:10249
const BUTTON_GAP = 48; // gap from countdown to Verify button

export default function OtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { seconds, restart } = useCountdown(60);

  const resolvedEmail = useMemo(() => {
    const rawEmail = Array.isArray(email) ? email[0] : email;
    return (rawEmail ?? '').trim().toLowerCase();
  }, [email]);

  const canVerify = code.length === OTP_LENGTH && !isSubmitting;

  const handleResend = async () => {
    if (!resolvedEmail || seconds > 0 || isResending) {
      return;
    }

    setErrorMessage(null);
    setIsResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: resolvedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      restart();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to resend code right now.');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    if (!canVerify || !resolvedEmail) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: resolvedEmail,
        token: code,
        type: 'email',
      });

      if (error) {
        throw new Error(error.message);
      }

      router.replace('/(tabs)');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Invalid code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preserve Figma's "send" typo when no email is available; substitute the
  // address otherwise.
  const subtitle = resolvedEmail
    ? `Code has been send to ${resolvedEmail}`
    : 'Code has been send to + Email';

  return (
    <Screen noPadding>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Header title="OTP Code Verification" />

          <View style={styles.middle}>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <OTPInput value={code} onChange={setCode} length={OTP_LENGTH} />

            {seconds > 0 ? (
              <Text style={styles.countdownText}>
                Resend code in <Text style={styles.countdownAccent}>{seconds}</Text> s
              </Text>
            ) : (
              <Pressable onPress={handleResend} disabled={isResending} hitSlop={8}>
                <Text style={styles.resendLink}>
                  {isResending ? 'Resending…' : 'Resend code'}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={styles.buttonWrap}>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Button onPress={handleVerify} disabled={!canVerify} loading={isSubmitting}>
              Verify
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  middle: {
    marginTop: spacing.xxl + spacing.md, // ~64px from navbar — matches Figma's 97px gap minus the navbar's internal padding
    gap: SECTION_GAP,
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: colors.text.primary,
    textAlign: 'center',
    width: '100%',
  },
  countdownText: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  countdownAccent: {
    color: colors.brand.primary,
  },
  resendLink: {
    ...typography.body,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    color: colors.brand.primary,
    textAlign: 'center',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.danger,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  buttonWrap: {
    marginTop: BUTTON_GAP,
  },
});
