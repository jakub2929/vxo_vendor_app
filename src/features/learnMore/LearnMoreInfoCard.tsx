import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

type Props = {
  title: string;
  // ReactNode (not string) so cards can include tappable inline links —
  // e.g. the last card's mailto / support route.
  children: ReactNode;
};

// Figma node 4:10021..4:10025 — identical styling for all 5 cards on the
// Learn More VXO Opportunities screen (4:10017).
export function LearnMoreInfoCard({ title, children }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.surface.mutedAlt,
    borderWidth: 2,
    borderColor: colors.surface.muted,
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.bodyAlt,
  },
  body: {
    gap: 0,
  },
});
