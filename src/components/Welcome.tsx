import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { StickerCollage } from './StickerCollage';
import { PaginationDots } from './PaginationDots';
import { PrimaryButton } from './PrimaryButton';

const FRAME_WIDTH = 428;
const FIGMA_BOTTOM_PADDING = 48;
const { width: windowWidth } = Dimensions.get('window');
const scale = windowWidth / FRAME_WIDTH;

type Props = {
  onGetStarted: () => void;
};

export function Welcome({ onGetStarted }: Props) {
  const insets = useSafeAreaInsets();
  // SafeAreaView already inserts insets.bottom padding; compensate so the gap
  // below the button matches Figma's 48px frame padding regardless of device.
  const paddingBottom = Math.max(FIGMA_BOTTOM_PADDING - insets.bottom, 16);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StickerCollage scale={scale} />

      <View style={[styles.bottom, { paddingBottom }]}>
        <View style={styles.titleGroup}>
          <Text allowFontScaling={false} style={styles.title}>
            Welcome to VXO
          </Text>
          <Text allowFontScaling={false} style={styles.subtitle}>
            The best messenger and chat app of the century to bring you more
            business.
          </Text>
        </View>

        <PaginationDots total={3} active={0} />

        <PrimaryButton
          label="Get Started"
          onPress={onGetStarted}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  // Mirrors Figma frame 4:10403: anchored to bottom, px-24, py-48, gap-48.
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
    gap: 48,
  },
  titleGroup: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 40,
    lineHeight: 48,
    color: colors.brand.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: 0.2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
  },
});
