import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

/** App footer credit line, as in the maquettes. */
export default function Footer() {
  return (
    <Text style={styles.text}>
      © 2026 TIM SARL · TontineX360 — Tech Intelligence & Management, Douala
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
    color: colors.footer,
    fontSize: font.size.xs,
    lineHeight: font.size.xs * 1.5,
    paddingHorizontal: 24,
  },
});
