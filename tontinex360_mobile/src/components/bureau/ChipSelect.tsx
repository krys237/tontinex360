import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

export type ChipOption<T> = { key: T; label: string };

/** Sélecteur en pilules (remplace les <select> du web sur mobile). */
export default function ChipSelect<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (k: T) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.wrap, style]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={String(o.key)} onPress={() => onChange(o.key)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  chipTextOn: { color: colors.white },
});
