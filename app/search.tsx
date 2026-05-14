// /search sits outside AuthGate's exemption set in app/_layout.tsx (which
// only spares (public)/*, _debug, setup-pin, unlock, setup-biometric), so
// the inactivity timer correctly redirects to /(authed-no-tabs)/unlock when
// the app returns to foreground past the lock threshold.
import { SearchScreen } from '@/features/search/SearchScreen';

export default function SearchRoute() {
  return <SearchScreen />;
}
