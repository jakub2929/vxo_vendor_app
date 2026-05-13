import type { TextStyle } from 'react-native';

// Canonical typography tokens — verified against DESIGN.md §2.2, tokens.ts, and
// Figma MCP. Family names must match the keys registered in src/lib/appReady.ts
// and app/index.tsx (Urbanist-{Regular,Medium,SemiBold,Bold,ExtraBold}).
//
// React Native rounds lineHeight to integers internally; the fractional values
// are preserved here for parity with the Figma source.
export const typography = {
  display: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 48,
    lineHeight: 57.6,
  },
  h1: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 40,
    lineHeight: 48,
  },
  h2: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 38.4,
  },
  h3: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 28.8,
  },
  title: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28,
  },
  bodyBold: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 25.2,
  },
  body: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22.4,
  },
  bodySmall: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 19.6,
  },
  caption: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 14.4,
  },
  micro: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 12,
  },
} as const satisfies Record<string, TextStyle>;
