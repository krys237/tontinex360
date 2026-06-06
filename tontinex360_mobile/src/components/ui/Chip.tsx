import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

export type ChipTint = 'green' | 'gold' | 'danger' | 'grey';

const TINTS: Record<ChipTint, { bg: string; fg: string }> = {
  green: { bg: colors.greenBgDeep, fg: colors.primary },
  gold: { bg: colors.goldSoft, fg: '#9A7B10' },
  danger: { bg: colors.dangerSoft, fg: '#7A4044' },
  grey: { bg: colors.surfaceAlt, fg: colors.textMuted },
};

/** Small pill badge. */
export default function Chip({
  label,
  tint = 'green',
  style,
}: {
  label: string;
  tint?: ChipTint;
  style?: ViewStyle;
}) {
  const t = TINTS[tint];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: { fontSize: font.size.sm, fontWeight: font.semibold },
});
