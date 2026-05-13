import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { DotVariant } from './jobStatusMeta';

// 60×60 avatar — VXO wordmark + smile, raster export from Figma instance
// I4:10448;546:6184 (Type=Online/Offline Avatar). The two Figma variants
// differ only by the status dot color; the artwork itself is identical, so
// we use one PNG and overlay a vector dot. Dot is 15×15 with a 1.6px white
// stroke, matching Figma vars #246BFD (online) / #BDBDBD (offline).
const AVATAR_SIZE = 60;
const DOT_SIZE = 15;

type Props = {
  dotVariant: DotVariant;
};

export function JobAvatar({ dotVariant }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/brand/job-avatar.png')}
        style={styles.image}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.dotWrap}>
        <Svg width={DOT_SIZE} height={DOT_SIZE} viewBox="0 0 15 15">
          <Circle
            cx={7.5}
            cy={7.5}
            r={6.7}
            fill={dotVariant === 'online' ? '#246BFD' : '#BDBDBD'}
            stroke="#FFFFFF"
            strokeWidth={1.6}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    position: 'relative',
  },
  image: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  dotWrap: {
    position: 'absolute',
    // Figma: inset bottom-0 left-3/4 right-0 top-3/4 → bottom-right quadrant.
    // Place the 15×15 dot so its center sits at 75% of the avatar.
    right: 0,
    bottom: 0,
    width: DOT_SIZE,
    height: DOT_SIZE,
  },
});
