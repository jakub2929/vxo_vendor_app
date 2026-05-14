// PIN + biometric state, stored in expo-secure-store (iOS Keychain / Android
// EncryptedSharedPreferences). All keys are namespaced under `auth.*` to keep
// clear of the Supabase storage adapter's own keys.
//
// THREAT MODEL (Phase 0, approved):
// A 4-digit PIN has only 10^4 possible inputs. SHA-256 over PIN || 16-byte salt
// is effectively instant to brute-force *if* an attacker extracts the hash.
// The defense-in-depth here is the hardware-backed keystore that wraps the
// hash on disk — Secure Enclave on iOS, Android Keystore on Android. The
// 5-attempt lockout enforces the bound at the app layer (after which we wipe
// session + PIN and force email OTP re-auth).
//
// Stronger KDFs (bcrypt/scrypt/Argon2) would slow offline brute-force but
// expo-crypto doesn't expose any of them, and pulling in a native module only
// matters in a threat model where the attacker has already defeated the
// device's keystore — at which point they have the Supabase session token too
// and don't need the PIN. Documented trade-off; sufficient for this spec.

import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  hash: 'auth.pin.hash',
  salt: 'auth.pin.salt',
  setupCompleted: 'auth.pin.setup_completed',
  biometricEnabled: 'auth.biometric.enabled',
  biometricOffered: 'auth.biometric.offered',
  failedAttempts: 'auth.failed_attempts',
  lastBackgrounded: 'auth.last_backgrounded',
} as const;

export const MAX_FAILED_ATTEMPTS = 5;

// Phase 3 inactivity gate. When the app is backgrounded and returns after
// more than this many ms, the in-memory `unlockedThisSession` flag is cleared
// and AuthGate re-routes to /unlock. Set to 5 minutes per spec.
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

async function getItem(key: string): Promise<string | null> {
  if (!isNative) return null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (!isNative) return;
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (!isNative) return;
  await SecureStore.deleteItemAsync(key);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

// Salt stored as hex; hash computed over `${saltHex}:${pin}` so a future change
// to the prefix (e.g. add a version byte) is straightforward without touching
// callers.
async function hashPin(pin: string, saltHex: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${saltHex}:${pin}`,
  );
}

// Length-independent equality so a malicious caller (not really our threat
// model — SecureStore is local — but cheap to do right) can't time-side-channel
// the comparison.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function setPin(pin: string): Promise<void> {
  const saltBytes = Crypto.getRandomBytes(16);
  const saltHex = bytesToHex(saltBytes);
  const hash = await hashPin(pin, saltHex);
  // Order matters: write `setup_completed` LAST. If the app crashes mid-write,
  // AuthGate sees `setup_completed=null` and routes back through
  // (authed-no-tabs)/setup-pin cleanly. Writing it first would leave the user
  // "done" with no actual PIN.
  await setItem(KEYS.salt, saltHex);
  await setItem(KEYS.hash, hash);
  await setItem(KEYS.failedAttempts, '0');
  await setItem(KEYS.setupCompleted, '1');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [storedHash, salt] = await Promise.all([
    getItem(KEYS.hash),
    getItem(KEYS.salt),
  ]);
  if (!storedHash || !salt) return false;
  const computed = await hashPin(pin, salt);
  return constantTimeEqual(computed, storedHash);
}

export async function markSetupCompleted(): Promise<void> {
  await setItem(KEYS.setupCompleted, '1');
}

export async function isSetupCompleted(): Promise<boolean> {
  return (await getItem(KEYS.setupCompleted)) === '1';
}

export async function isPinConfigured(): Promise<boolean> {
  return (await getItem(KEYS.hash)) !== null;
}

export async function getFailedAttempts(): Promise<number> {
  const raw = await getItem(KEYS.failedAttempts);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function incFailedAttempts(): Promise<number> {
  const next = (await getFailedAttempts()) + 1;
  await setItem(KEYS.failedAttempts, String(next));
  return next;
}

export async function resetFailedAttempts(): Promise<void> {
  await setItem(KEYS.failedAttempts, '0');
}

export async function clearAllAuth(): Promise<void> {
  // Iterates every key in the KEYS map, so adding a new key (biometric.offered,
  // future last_backgrounded etc.) automatically gets wiped on signOut +
  // lockout + Reset PIN. Single source of truth.
  await Promise.all(Object.values(KEYS).map((k) => deleteItem(k)));
}

// --- Biometric flags ----------------------------------------------------------
// These flags only describe what the user has *chosen* in-app. The runtime
// capability check (hasHardware / isEnrolled) lives in src/lib/biometric.ts.
// Always combine the flag with a capability check before triggering a prompt —
// the OS can revoke biometric availability without telling us, and a stale
// `enabled='1'` flag must never cause an authenticateAsync call that errors
// out at the platform layer.

export async function isBiometricEnabled(): Promise<boolean> {
  return (await getItem(KEYS.biometricEnabled)) === '1';
}

export async function markBiometricEnabled(): Promise<void> {
  await setItem(KEYS.biometricEnabled, '1');
}

export async function clearBiometricEnabled(): Promise<void> {
  // Used in two cases: (1) user toggles off in Settings, (2) unlock detects
  // OS-level revocation (hasHardware/isEnrolled now false despite stored '1').
  // Distinct from clearAllAuth — keeps PIN + offered flag intact.
  await deleteItem(KEYS.biometricEnabled);
}

export async function isBiometricOffered(): Promise<boolean> {
  return (await getItem(KEYS.biometricOffered)) === '1';
}

export async function markBiometricOffered(): Promise<void> {
  // Written when the user either enables biometric, skips the setup screen,
  // or when the screen self-skips on a device with no hardware/enrollment.
  // Without this flag the setup screen would re-prompt on every cold start.
  await setItem(KEYS.biometricOffered, '1');
}

// In-memory session flag. False on JS module load (= cold start), set to true
// once the user has passed the unlock screen — or once AuthGate has determined
// there's no PIN to unlock against. Reset by signOut() and by the Phase 3
// inactivity check below so the next session starts locked again.
let unlockedThisSession = false;

// Listener registry so non-React code (the AppState listener in supabase.ts)
// can flip the lock state and have AuthGate's effect re-run. AuthGate
// subscribes on mount and increments a tick state inside its own scope; the
// pinStore stays React-free.
type LockListener = () => void;
const lockListeners = new Set<LockListener>();

function notifyLockChange(): void {
  for (const listener of lockListeners) listener();
}

export function subscribeLockChange(listener: LockListener): () => void {
  lockListeners.add(listener);
  return () => {
    lockListeners.delete(listener);
  };
}

export function isUnlockedThisSession(): boolean {
  return unlockedThisSession;
}

export function markUnlocked(): void {
  if (unlockedThisSession) return;
  unlockedThisSession = true;
  notifyLockChange();
}

export function clearUnlockedSession(): void {
  if (!unlockedThisSession) return;
  unlockedThisSession = false;
  notifyLockChange();
}

// --- Inactivity timestamp (Phase 3) ------------------------------------------
// Written on every AppState → background / inactive transition, read on the
// matching → active transition. The SecureStore round-trip is the source of
// truth even if the JS reloaded in between — that's the whole point of
// putting this on disk instead of in memory.

export async function markBackgrounded(): Promise<void> {
  await setItem(KEYS.lastBackgrounded, String(Date.now()));
}

export async function clearLastBackgrounded(): Promise<void> {
  await deleteItem(KEYS.lastBackgrounded);
}

// Returns true when the user has been away long enough to require a fresh
// unlock. Defensive about three failure modes:
//   - No timestamp stored → returns false (treat as not expired; the app
//     simply never backgrounded, or this is a cold start without prior bg).
//   - Unparseable string → returns true (data corruption — safer to re-lock).
//   - Negative elapsed (system clock moved backward, e.g. NTP correction or
//     manual change) → returns true (we can't trust the math, re-lock).
export async function isInactivityExpired(): Promise<boolean> {
  const raw = await getItem(KEYS.lastBackgrounded);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (!Number.isFinite(ts)) return true;
  const elapsed = Date.now() - ts;
  if (elapsed < 0) return true;
  return elapsed >= INACTIVITY_TIMEOUT_MS;
}
