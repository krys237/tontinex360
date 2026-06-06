import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

/** Subtle mint→white gradient backdrop used by the card-style auth screens. */
export default function GradientBackground({
  children,
  edges = ['top', 'bottom'],
  style,
}: {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
}) {
  return (
    <LinearGradient
      colors={[colors.bgGradientTop, colors.bgGradientBottom] as const}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.fill}>
      <SafeAreaView style={[styles.fill, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
