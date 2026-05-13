import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { MOCK_VENDOR_COORDS, type LatLng } from '@/lib/geo';

// Returns the vendor's current foreground location, or null if permission was
// denied / coords are unavailable. Wrapped in TanStack Query so we can share
// the same fix across all rows in a list without re-prompting on every render.
//
// __DEV__ short-circuits to MOCK_VENDOR_COORDS so the distance UI is testable
// in the simulator without granting permission. EXPO_PUBLIC_FORCE_REAL_DATA=1
// flips USE_MOCKS off and exercises the real expo-location path.
//
// Permission UX: ask is deferred until *this hook fires* (i.e. when the Jobs
// tab actually mounts). If the user denies, the data is null and rows simply
// omit the distance suffix — no nag, no banner.
export function useVendorLocation() {
  return useQuery<LatLng | null>({
    queryKey: ['vendor-location'],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (USE_MOCKS) return MOCK_VENDOR_COORDS;

      const { status } =
        await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    },
  });
}
