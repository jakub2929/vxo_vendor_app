import { Image, Pressable, StyleSheet, View } from 'react-native';
import { SquarePen, User } from 'lucide-react-native';
import { colors } from '@/theme';

type Props = {
  uri?: string;
  onPress: () => void;
};

// Mirrors Figma node 4:10208 (blank) / 4:10195 (filled): 200×200 circular avatar
// with a 50×50 brand-primary chip anchored to the bottom-right corner.
export function AvatarPicker({ uri, onPress }: Props) {
  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <View style={styles.circle}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <User size={88} color={colors.text.tertiary} strokeWidth={1.5} />
        )}
      </View>
      <View style={styles.editChip}>
        <SquarePen size={28} color={colors.surface.base} fill={colors.surface.base} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: 200,
    height: 200,
  },
  editChip: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
