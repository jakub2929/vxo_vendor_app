import { Image, StyleSheet, View } from 'react-native';

// One emoji sticker, sourced from Figma Avatar nodes 4:10413–4:10421 inside the
// Welcome group (4:10412). `cx`/`cy` is the sticker centre in the 428×926 frame
// coordinate space; `size` is the inner image render size (un-rotated). `rotate`
// is applied around the centre, so the layout box stays `size × size`.
type Sticker = {
  src: number;
  cx: number;
  cy: number;
  size: number;
  rotate: number;
};

// Values come from Figma MCP `get_design_context` on node 4:10402: inner image
// size is the un-rotated render size; rotation comes from the wrapping
// `flex-none rotate-[Xdeg]` div. Frame-coord centre = Figma absoluteBoundingBox
// (x + w/2, y + h/2) from `get_metadata`. File order follows source node IDs.
const STICKERS: readonly Sticker[] = [
  { src: require('../../assets/welcome/sticker-1.png'), cx: 158.86, cy: 482.68, size: 60, rotate: 17.64 },
  { src: require('../../assets/welcome/sticker-2.png'), cx: 310.54, cy: 462.41, size: 100, rotate: 9.28 },
  { src: require('../../assets/welcome/sticker-3.png'), cx: 41.67, cy: 424.89, size: 80, rotate: 12.84 },
  { src: require('../../assets/welcome/sticker-4.png'), cx: 431.68, cy: 379.89, size: 80, rotate: 12.84 },
  { src: require('../../assets/welcome/sticker-5.png'), cx: 317.36, cy: 318.52, size: 70, rotate: -11.67 },
  { src: require('../../assets/welcome/sticker-6.png'), cx: 162.96, cy: 354.10, size: 140, rotate: -14.11 },
  { src: require('../../assets/welcome/sticker-7.png'), cx: 19.73, cy: 273.14, size: 60, rotate: -20.91 },
  { src: require('../../assets/welcome/sticker-8.png'), cx: 338.64, cy: 161.21, size: 120, rotate: 7.38 },
  { src: require('../../assets/welcome/sticker-9.png'), cx: 140.88, cy: 176.80, size: 100, rotate: -14.43 },
] as const;

type Props = {
  scale: number;
};

// Renders the 9 emoji stickers absolutely positioned in Figma-frame coords,
// scaled to device width. Children intentionally overflow on left and right
// (sticker-4 reaches x≈472, sticker-7 reaches x≈-10), so overflow:'visible'
// must stay.
export function StickerCollage({ scale }: Props) {
  return (
    <View style={styles.root} pointerEvents="none">
      {STICKERS.map((s, i) => {
        const px = s.size * scale;
        return (
          <Image
            key={i}
            source={s.src}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: (s.cx - s.size / 2) * scale,
              top: (s.cy - s.size / 2) * scale,
              width: px,
              height: px,
              transform: [{ rotate: `${s.rotate}deg` }],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
});
