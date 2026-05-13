import Svg, { Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

// Approximated Stripe "S" mark on a rounded-square tile in brand purple
// (#635BFF). Replace with the official asset from
// https://stripe.com/newsroom/brand-assets once available locally.
// TODO: replace with official Stripe brand SVG.
export function StripeIcon({ size = 20, color = '#635BFF' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={0} y={0} width={24} height={24} rx={6} ry={6} fill={color} />
      <Path
        d="M13.05 9.6c0-.6.5-.84 1.32-.84 1.18 0 2.66.36 3.84 1V6.1A10.2 10.2 0 0 0 14.37 5.4C11.13 5.4 9 7.1 9 9.84c0 4.32 5.94 3.6 5.94 5.5 0 .72-.62.96-1.5.96-1.34 0-3.06-.55-4.38-1.28v3.74c1.46.62 2.94.9 4.38.9 3.34 0 5.58-1.64 5.58-4.46 0-4.62-6-3.78-6-5.6Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}
