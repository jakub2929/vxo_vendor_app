import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

// Iconly Light / Search — 1:1 port from Figma node I4:10157;1130:20163;430:9081.
// Native viewBox is 23.3917 × 23.9256 (non-square) and the Figma frame uses
// preserveAspectRatio="none", so we render at 28×28 with that same non-uniform
// stretch to match exactly.
export function IconlySearch({ size = 28, color = '#FFFFFF' }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 23.3917 23.9256"
      fill="none"
      preserveAspectRatio="none"
      accessibilityRole="image"
    >
      <Circle
        cx={11.2367}
        cy={11.2367}
        r={10.4867}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5303 19.0749L22.6417 23.1756"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
