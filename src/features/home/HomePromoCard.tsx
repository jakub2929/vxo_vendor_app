import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import { PromoCrownConfetti } from './PromoCrownConfetti';

type Props = {
  onPress?: () => void;
};

// Figma node 4:10013 — "Learn More VXO Opportunities" promo card. The Figma
// title reads "Oppertinies"; that's a typo in the design and has been fixed
// here per Q3.
export function HomePromoCard({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel="Learn more about VXO opportunities"
    >
      <PromoCrownConfetti width={62} height={60} />
      <View style={styles.content}>
        <Text style={styles.title}>Learn More VXO Opportunities</Text>
        <Text style={styles.body}>
          Enjoy all the benefits and explore more possibilities
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 12,
    paddingRight: 16,
    paddingVertical: 12,
    backgroundColor: colors.accent.indigo,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.base,
  },
  cardPressed: {
    opacity: 0.9,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 25.2,
    color: '#FFFFFF',
  },
  body: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 19.2,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
});
