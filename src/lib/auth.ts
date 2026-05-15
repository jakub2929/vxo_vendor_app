import { clearAllAuth, clearUnlockedSession } from './pinStore';
import { supabase } from './supabase';
import { clearVendorCache } from './vendorCache';

export async function signOut() {
  // Clear this device's expo_push_token from the vendor row BEFORE dropping
  // the session — otherwise the next vendor to sign in on the same device
  // inherits push routing for the previous user. Best-effort: any failure here
  // (network, RLS, missing row) must NOT block the supabase.auth.signOut()
  // call that follows.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email;

    if (!email) {
      console.warn(
        '[auth/signout] no authed email — skipping push token clear',
      );
    } else {
      console.log('[auth/signout] clearing push token for', email);
      // .select() so PostgREST returns the affected rows. Without it, `data`
      // is null and we can't distinguish "wrote to 1 row" from "RLS silently
      // matched 0 rows" — both come back as { data: null, error: null }.
      const { data, error } = await supabase
        .from('vendors')
        .update({ expo_push_token: null })
        .eq('email', email)
        .select('id');

      if (error) {
        console.error(
          '[auth/signout] failed to clear push token:',
          error.message,
        );
      } else if (!data || data.length === 0) {
        // RLS-silent no-op or no matching row. Most likely cause: the vendors
        // row's email doesn't match auth.jwt()->>'email' (case, whitespace,
        // missing row), or the UPDATE policy is missing. Surface loudly.
        console.warn(
          '[auth/signout] push token clear matched 0 rows for',
          email,
          '— check vendors RLS UPDATE policy and row exists',
        );
      } else {
        console.log(
          '[auth/signout] push token cleared',
          `(${data.length} row${data.length === 1 ? '' : 's'})`,
        );
      }
    }
  } catch (e) {
    console.error('[auth/signout] push token clear threw', e);
  }

  const result = await supabase.auth.signOut();
  clearVendorCache();
  await clearAllAuth();
  clearUnlockedSession();
  return result;
}
