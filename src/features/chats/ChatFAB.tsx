import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, shadows } from '@/theme';

type Props = {
  onPress: () => void;
};

// Floating chat button — bottom-right of the Chats list.
// Figma node 4:10152: ~60×60 gradient circle, 24×24 chat icon, brand glow.
// FAB role unclear — designer included it from generic chat template. Vendors
// can't start chats unilaterally per Ryan's spec. Recommend hiding in v1 or
// routing to VXO Support as "Contact us". For now: caller decides via onPress.
export function ChatFAB({ onPress }: Props) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Contact VXO"
        style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={colors.brand.headerGradient}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.circle}
        >
          <MessageCircle size={26} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const SIZE = 60;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 24,
    bottom: 24,
  },
  shadow: {
    borderRadius: SIZE / 2,
    ...shadows.glow,
  },
  pressed: {
    opacity: 0.9,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
