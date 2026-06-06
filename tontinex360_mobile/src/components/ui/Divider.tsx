import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

/** Horizontal rule with an optional centered label ("OU"). */
export default function Divider({ label }: { label?: string }) {
  if (!label) return <View style={styles.line} />;
  return (
    <View style={styles.row}>
      <View style={styles.flexLine} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.flexLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  flexLine: { flex: 1, height: 1, backgroundColor: colors.inputBorder },
  line: { height: 1, backgroundColor: colors.inputBorder, marginVertical: 18 },
  label: {
    marginHorizontal: 12,
    color: colors.textMuted,
    fontSize: font.size.sm,
    fontWeight: font.medium,
    letterSpacing: 1,
  },
});
