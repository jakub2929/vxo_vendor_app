import { clearAllAuth, clearUnlockedSession } from './pinStore';
import { supabase } from './supabase';
import { clearVendorCache } from './vendorCache';

export async function signOut() {
  const result = await supabase.auth.signOut();
  clearVendorCache();
  await clearAllAuth();
  clearUnlockedSession();
  return result;
}
