import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

// Stylised "smile-with-dot eyes" mascot mark — matches the logo node
// I4:10141;1130:20158 in Figma. The real brand asset isn't checked into
// `assets/brand/` yet, so this is a vector approximation.
// TODO: replace with the official mascot SVG/PNG when delivered.
export function VXOMascot({ size = 32, color = '#ffffff' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={11} cy={13} r={1.8} fill={color} />
      <Circle cx={21} cy={13} r={1.8} fill={color} />
      <Path
        d="M9 18 Q16 24 23 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
