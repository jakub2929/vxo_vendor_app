import Svg, { Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

// Iconly Light / More Circle — 1:1 port from Figma node I4:10157;1130:20164;430:9211.
// Hollow circle outline + 3 horizontal dots inside.
export function IconlyMoreCircle({ size = 28, color = '#FFFFFF' }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 23.0833 23.0833"
      fill="none"
      preserveAspectRatio="none"
      accessibilityRole="image"
    >
      <Path
        d="M11.5417 0.75C17.501 0.75 22.3333 5.58117 22.3333 11.5417C22.3333 17.501 17.501 22.3333 11.5417 22.3333C5.58117 22.3333 0.75 17.501 0.75 11.5417C0.75 5.58233 5.58233 0.75 11.5417 0.75Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M16.1374 11.5567H16.1479" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11.4602 11.5567H11.4707" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6.78307 11.5567H6.79357" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
