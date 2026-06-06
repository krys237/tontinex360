import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

/** Green page title (e.g. "Bienvenue !", "Créer un compte"). */
export function Heading({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

/** Muted subtitle under a heading. */
export function Subtitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  heading: {
    fontSize: font.size.x2,
    fontWeight: font.extrabold,
    color: colors.heading,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: font.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: font.size.md * 1.4,
  },
});
