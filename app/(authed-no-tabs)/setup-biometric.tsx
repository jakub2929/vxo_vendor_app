import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScanFace } from 'lucide-react-native';
import { Button, Header, Screen } from '@/components';
import { FingerprintHero } from '@/features/auth/FingerprintHero';
import {
  type BiometricCapability,
  getBiometricCapability,
  promptBiometric,
} from '@/lib/biometric';
import {
  isPinConfigured,
  markBiometricEnabled,
  markBiometricOffered,
  markUnlocked,
} from '@/lib/pinStore';
import { colors, spacing, typography } from '@/theme';

// Biometric opt-in step. AuthGate routes here when:
//   PIN configured + setup_completed + biometric.offered != '1'
//
// CAPABILITY SHORT-CIRCUIT:
// If the device has no biometric hardware, no enrolled biometrics, or we're
// running in an environment where the probe throws (Expo Go iOS Face ID,
// simulator without configured biometric, web), we write biometric.offered='1'
// and route straight to /(tabs). The user never sees a flash of this screen
// because we render a blank container until capability resolves.
//
// PIN PREREQUISITE:
// Spec: biometric requires PIN. If somehow we land here without a PIN
// configured (skipped + manual nav, or AuthGate bug), bail out the same way
// as no-hardware. We don't want a "configure biometric" prompt sitting on
// top of a passwordless account — that'd give the user a false sense of
// security.

export default function SetupBiometricScreen() {
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(async (enable: boolean) => {
    if (enable) await markBiometricEnabled();
    await markBiometricOffered();
    markUnlocked();
    router.replace('/(tabs)');
  }, []);

  // Capability probe on mount. Short-circuit if device can't do biometric or
  // if PIN isn't configured. The two checks intentionally run in parallel —
  // either failing flips us to the auto-skip path.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cap, pinConfigured] = await Promise.all([
        getBiometricCapability(),
        isPinConfigured(),
      ]);
      if (cancelled) return;
      if (!cap.supported || !pinConfigured) {
        await finish(false);
        return;
      }
      setCapability(cap);
    })();
    return () => {
      cancelled = true;
    };
  }, [finish]);

  const handleEnable = useCallback(async () => {
    if (!capability?.supported || busy) return;
    setBusy(true);
    setError(null);
    const result = await promptBiometric(`Enable ${capability.humanName} for VXO`);
    if (result.success) {
      await finish(true);
      return;
    }
    // Either the user cancelled, the OS denied, or biometric is suddenly
    // unavailable between the capability probe and the prompt (rare race).
    // Don't auto-skip — let the user decide. They can tap Skip if they
    // really don't want this, or retry by tapping Enable again.
    setBusy(false);
    if (result.reason === 'lockout') {
      setError(
        `${capability.humanName} is temporarily locked. Try again later or skip for now.`,
      );
    } else if (result.reason === 'unavailable' || result.reason === 'error') {
      setError(`${capability.humanName} isn't available right now. Skip and use PIN instead.`);
    }
    // 'cancelled' → no message; user knows they cancelled.
  }, [busy, capability, finish]);

  const handleSkip = useCallback(() => {
    if (busy) return;
    void finish(false);
  }, [busy, finish]);

  // Render nothing while capability resolves. The screen lives for at most
  // a few hundred ms before either rendering content or auto-skipping;
  // showing a spinner here would be more disruptive than the blank flash.
  if (!capability?.supported) {
    return <Screen noPadding>{null}</Screen>;
  }

  const isFaceId = capability.type === 'faceId';

  return (
    <Screen noPadding>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Header title={`Enable ${capability.humanName}?`} showBackButton={false} />

          <View style={styles.middle}>
            <Text style={styles.subtitle}>
              Unlock VXO with {capability.humanName} instead of typing your PIN. You can still
              use your PIN any time.
            </Text>

            <View style={styles.hero}>
              {isFaceId ? (
                <ScanFace size={200} color={colors.brand.primary} strokeWidth={1.5} />
              ) : (
                <FingerprintHero size={200} />
              )}
            </View>
          </View>

          <View style={styles.buttonRow}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.buttons}>
              <Button variant="secondary" onPress={handleSkip} disabled={busy} style={styles.btn}>
                Skip
              </Button>
              <Button onPress={handleEnable} loading={busy} style={styles.btn}>
                Enable
              </Button>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  middle: {
    flex: 1,
    marginTop: spacing.xxl,
    gap: spacing.xl,
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
  hero: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    marginTop: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.danger,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
