// Geo helpers — kept dependency-free so they can run in __DEV__ mocks, in
// Realtime callbacks, and inside the row renderer without any provider plumbing.

export type LatLng = { lat: number; lng: number };

// Used in __DEV__ when expo-location is bypassed — picked near the mock job
// addresses (Edmonton AB) so distances come out in a sensible ~1–25 mi range.
export const MOCK_VENDOR_COORDS: LatLng = {
  lat: 53.5461,
  lng: -113.4938,
};

const EARTH_RADIUS_MILES = 3958.7613;

// Haversine — great-circle distance in miles. Accurate to a few meters at
// city scale, which is all we need for "2.5 miles away" UI.
export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_MILES * c;
}

// Figma row examples: "2.5 Miles Away", ".5 miles away". One decimal place
// past the integer, no zero-padding on values < 1.
export function formatMiles(miles: number): string {
  if (miles < 1) {
    const s = miles.toFixed(1);
    return s.startsWith('0.') ? s.slice(1) : s;
  }
  return miles.toFixed(1);
}
