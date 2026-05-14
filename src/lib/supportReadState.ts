// Per-thread "last opened" timestamps for the support landing's unread badge.
// We don't have a `read_at` column on support_messages (schema change deferred
// by Phase 0 decision) — instead we record on the device when the vendor
// opened a thread and treat any non-vendor message with created_at > that as
// unread. Cleared by opening the thread again.
//
// SecureStore is overkill (no sensitive data) but it's the only KV persistence
// already installed; using it keeps the dep surface small.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ThreadType } from '@/features/support/useSupportThread';

const KEY_PREFIX = 'support.lastOpened.';
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

function keyFor(threadType: ThreadType): string {
  return `${KEY_PREFIX}${threadType}`;
}

export async function getLastOpenedAt(
  threadType: ThreadType,
): Promise<string | null> {
  if (!isNative) return null;
  return SecureStore.getItemAsync(keyFor(threadType));
}

export async function markThreadOpened(threadType: ThreadType): Promise<void> {
  if (!isNative) return;
  await SecureStore.setItemAsync(keyFor(threadType), new Date().toISOString());
}
