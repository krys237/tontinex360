import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

/** Carousel pagination dots; the active dot is an elongated pill. */
export default function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D5DCD6' },
  dotActive: { width: 22, backgroundColor: colors.accent },
});
