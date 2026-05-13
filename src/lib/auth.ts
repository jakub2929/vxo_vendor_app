import { supabase } from './supabase';
import { clearVendorCache } from './vendorCache';

export async function signOut() {
  const result = await supabase.auth.signOut();
  clearVendorCache();
  return result;
}
