// Capability wrappers around expo-local-authentication.
//
// All call sites must go through `getBiometricCapability()` rather than
// touching LocalAuthentication directly, so the "device has biometric"
// concept stays in one place. The screen-level callers (setup-biometric,
// unlock, Settings) cache the result on mount — never re-query mid-prompt.
//
// DEFENSIVE CODING NOTES (for the Phase 2 dev-build verification pass):
//
// - hasHardwareAsync() returns false on the simulator, on Expo Go for some
//   APIs, and on devices the OS has restricted (e.g. corporate MDM).
// - isEnrolledAsync() returns false when hardware exists but the user hasn't
//   set up Face ID / Touch ID / fingerprint at the OS level. We treat this
//   as "unsupported" for our purposes — we cannot prompt without enrollment.
// - supportedAuthenticationTypesAsync() can return an empty array even when
//   hasHardware/isEnrolled both pass (rare — usually a permission issue).
//   Treated as unsupported.
// - On web (which we don't actually ship to, but the bundler resolves), the
//   module exists but every call throws. The `isNative` guard short-circuits.
// - In Expo Go on iOS, FaceID-specific calls fail with a Face ID-not-supported
//   error rather than returning false. We catch any thrown error from the
//   capability probe and treat it as unsupported. Same defensive behavior.

import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricType = 'faceId' | 'touchId' | 'fingerprint' | 'iris';

export type BiometricCapability =
  | { supported: false }
  | { supported: true; type: BiometricType; humanName: string };

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// Map a LocalAuthentication.AuthenticationType (returned in the array from
// supportedAuthenticationTypesAsync) to our internal classification + a label
// suitable for button text and headings. Falls back to "Biometric" so we never
// render an empty string even if the platform reports a type we don't model.
function resolveType(types: LocalAuthentication.AuthenticationType[]): BiometricCapability {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { supported: true, type: 'faceId', humanName: 'Face ID' };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return {
      supported: true,
      type: Platform.OS === 'ios' ? 'touchId' : 'fingerprint',
      humanName: Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint',
    };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return { supported: true, type: 'iris', humanName: 'Iris' };
  }
  return { supported: false };
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (!isNative) return { supported: false };
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hasHardware || !isEnrolled || types.length === 0) {
      return { supported: false };
    }
    return resolveType(types);
  } catch {
    // Expo Go on iOS throws on Face ID-specific probes. Any error here means
    // we can't reliably prompt — fall through to PIN-only.
    return { supported: false };
  }
}

type AuthResult =
  | { success: true }
  | { success: false; reason: 'cancelled' | 'lockout' | 'unavailable' | 'error' };

// Wraps authenticateAsync with a normalized result. Callers (unlock screen,
// Settings toggle) react only to `success`; the reason is logged via
// console.warn for debugging but never surfaced to the user — the spec is
// "fall through to PIN" on any failure.
export async function promptBiometric(reason: string): Promise<AuthResult> {
  if (!isNative) return { success: false, reason: 'unavailable' };
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Use PIN',
      // disableDeviceFallback=true keeps the OS from offering its own PIN
      // sheet — we want users to fall back to OUR PIN entry, which has the
      // lockout counter wired in. The OS PIN bypasses that counter entirely.
      disableDeviceFallback: true,
    });
    if (result.success) return { success: true };
    // result.error is one of: 'user_cancel' | 'system_cancel' | 'app_cancel'
    // | 'lockout' | 'user_fallback' | 'passcode_not_set' | 'not_enrolled'
    // | 'not_available' | 'authentication_failed' | 'unknown'
    const code = 'error' in result ? result.error : 'unknown';
    if (code === 'lockout') return { success: false, reason: 'lockout' };
    if (
      code === 'not_available' ||
      code === 'not_enrolled' ||
      code === 'passcode_not_set'
    ) {
      return { success: false, reason: 'unavailable' };
    }
    return { success: false, reason: 'cancelled' };
  } catch (err) {
    console.warn('[biometric] authenticateAsync threw:', err);
    return { success: false, reason: 'error' };
  }
}
