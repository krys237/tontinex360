import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconBubble } from '../../components/ui';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

/** Écran d'attente pour les modules bureau pas encore implémentés. */
export default function BureauPlaceholderScreen({ title }: { title?: string }) {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.center}>
        <IconBubble icon="construct" tint="accent" size={64} />
        <Text style={styles.title}>{title ?? 'Bientôt disponible'}</Text>
        <Text style={styles.sub}>Ce module du bureau arrive très prochainement.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.x2 },
  title: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  sub: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
});
