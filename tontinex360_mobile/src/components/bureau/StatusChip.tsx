import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

export type StatusTone = 'success' | 'warning' | 'danger' | 'muted' | 'info';

const TONES: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: colors.greenBgDeep, fg: colors.primary },
  warning: { bg: colors.goldSoft, fg: colors.goldAccent },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  muted: { bg: colors.surfaceAlt, fg: colors.textMuted },
  info: { bg: '#E0F2FE', fg: colors.info },
};

/** Pastille de statut générique pour les listes bureau. */
export default function StatusChip({
  label,
  tone = 'muted',
  style,
}: {
  label: string;
  tone?: StatusTone;
  style?: ViewStyle;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  text: { fontSize: font.size.xs, fontWeight: font.semibold },
});
