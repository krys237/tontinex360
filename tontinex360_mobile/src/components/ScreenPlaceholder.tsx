import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

/**
 * Generic placeholder used during Phase 0 for screens whose real UI (from Figma)
 * is integrated in a later phase.
 */
export default function ScreenPlaceholder({
  title,
  phase,
  subtitle,
}: {
  title: string;
  phase?: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{phase ?? 'À intégrer'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.bg,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  badge: {
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  badgeText: { color: colors.primaryDark, fontWeight: '600', fontSize: 12 },
});
