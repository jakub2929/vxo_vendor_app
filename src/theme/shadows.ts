import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

// Elevation tokens — verified against assets/figma-refs/tokens/tokens.ts and
// Figma MCP `Button/Shadow 1` on node 4:10411. DESIGN.md §2.3 listed glow.x = 0,
// but the live Figma value is x = 4 (MCP authoritative).
//
// React Native uses iOS-style shadow props (shadowColor/Offset/Opacity/Radius)
// and an Android `elevation` integer. We export Platform.select objects that
// resolve to the right shape per platform.

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export const shadows = {
  glow: Platform.select<ShadowStyle>({
    ios: {
      shadowColor: '#246bfd',
      shadowOpacity: 0.25,
      shadowOffset: { width: 4, height: 8 },
      shadowRadius: 24,
    },
    android: { elevation: 8 },
    default: {},
  }) as ShadowStyle,
  cardLow: Platform.select<ShadowStyle>({
    ios: {
      shadowColor: '#04060f',
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 60,
    },
    android: { elevation: 2 },
    default: {},
  }) as ShadowStyle,
  cardHigh: Platform.select<ShadowStyle>({
    ios: {
      shadowColor: '#04060f',
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 20 },
      shadowRadius: 100,
    },
    android: { elevation: 8 },
    default: {},
  }) as ShadowStyle,
  // React Native does not natively support inset shadows on View. Documented
  // here so callsites can locate the token; render the inset via a 1px border
  // or background tint instead.
  innerInk: {} as ShadowStyle,
} as const;
