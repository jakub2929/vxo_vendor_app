import { Image, StyleSheet } from 'react-native';

// Source asset is the Figma export `vxo_blu@2x 2` (node 4:10316) — a flat
// raster with the dark-blue VXO wordmark + smile-dot underline. Native size in
// Figma is 290×151; the actual PNG is 828×432 (~3x) for HiDPI sharpness.
const ASPECT_RATIO = 151 / 290;

type Props = {
  width?: number;
  tone?: 'default' | 'white';
};

export function VXOWordmark({ width = 290, tone = 'default' }: Props) {
  // The PNG is monochrome dark-blue on transparent. `tintColor` recolours every
  // non-transparent pixel, which is fine for inverting onto a coloured header.
  return (
    <Image
      source={require('../../assets/brand/vxo-wordmark.png')}
      style={[styles.image, { width, height: width * ASPECT_RATIO }]}
      tintColor={tone === 'white' ? '#ffffff' : undefined}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="VXO"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    alignSelf: 'center',
  },
});
