import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Button, Header, Screen } from '@/components';
import { CongratsModal } from '@/features/auth/CongratsModal';
import { OTPInput } from '@/features/auth/OTPInput';
import { markSetupCompleted, markUnlocked, setPin } from '@/lib/pinStore';
import { colors, spacing, typography } from '@/theme';

const PIN_LENGTH = 4;

type Step = 'enter' | 'confirm';

export default function SetupPinScreen() {
  // Modal shows once per arrival at this screen — AuthGate only routes here
  // when setup_completed is absent or '0', so this is effectively "first time
  // we've offered PIN setup".
  const [showWelcome, setShowWelcome] = useState(true);

  const [step, setStep] = useState<Step>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const value = step === 'enter' ? firstPin : confirmPin;
  const setValue = step === 'enter' ? setFirstPin : setConfirmPin;
  const canContinue = value.length === PIN_LENGTH && !busy;

  const handleSubmit = useCallback(async () => {
    if (!canContinue) return;
    setError(null);
    if (step === 'enter') {
      setStep('confirm');
      return;
    }
    if (confirmPin !== firstPin) {
      setError("PINs don't match. Try again.");
      setConfirmPin('');
      setStep('enter');
      setFirstPin('');
      return;
    }
    setBusy(true);
    try {
      await setPin(firstPin);
      markUnlocked();
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your PIN. Try again.');
      setBusy(false);
    }
  }, [canContinue, confirmPin, firstPin, step]);

  // OTPInput fires onComplete when the row fills; advance the step automatically
  // for the enter→confirm transition so the user doesn't need to tap Continue.
  // Confirm step requires an explicit Continue tap to give the user a chance to
  // double-check the second entry before submitting.
  const handleEnterComplete = useCallback((next: string) => {
    if (step !== 'enter') return;
    setFirstPin(next);
    setStep('confirm');
    setError(null);
  }, [step]);

  const handleSkip = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await markSetupCompleted();
      markUnlocked();
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save preference. Try again.');
      setBusy(false);
    }
  }, [busy]);

  useEffect(() => {
    if (step === 'enter') setConfirmPin('');
  }, [step]);

  const subtitle =
    step === 'enter'
      ? 'Set a 4-digit PIN to lock VXO when you switch away from the app.'
      : 'Re-enter your PIN to confirm.';

  return (
    <Screen noPadding>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Header title="Set Your PIN" showBackButton={false} />

          <View style={styles.middle}>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <View style={styles.pinRow}>
              <OTPInput
                key={step}
                value={value}
                onChange={setValue}
                length={PIN_LENGTH}
                boxWidth={83}
                boxGap={16}
                mask
                onComplete={handleEnterComplete}
              />
            </View>

            <Pressable onPress={handleSkip} hitSlop={8} disabled={busy}>
              <Text style={styles.skipLink}>Skip for now</Text>
            </Pressable>
          </View>

          <View style={styles.buttonWrap}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button onPress={handleSubmit} disabled={!canContinue} loading={busy}>
              {step === 'enter' ? 'Continue' : 'Confirm PIN'}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CongratsModal visible={showWelcome} onDismiss={() => setShowWelcome(false)} />
    </Screen>
  );
}

const SECTION_GAP = 48;
const BUTTON_GAP = 48;

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  middle: {
    marginTop: spacing.xxl + spacing.md,
    gap: SECTION_GAP,
    alignItems: 'center',
  },
  pinRow: {
    alignSelf: 'stretch',
    marginHorizontal: -spacing.screen,
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
  skipLink: {
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
