import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

/** Track + lime→primary gradient fill. `value` is 0..1. */
export default function ProgressBar({
  value = 0,
  height = 10,
}: {
  value?: number;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <LinearGradient
        colors={[colors.green[500], colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: '100%', width: `${pct * 100}%`, borderRadius: height }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.surfaceMuted, overflow: 'hidden', width: '100%' },
});
