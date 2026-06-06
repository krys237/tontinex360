import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { font } from '../../theme/typography';

/** Tinted callout box (green or blue) with optional icon + title. */
export default function InfoCard({
  variant = 'green',
  icon,
  title,
  children,
}: {
  variant?: 'green' | 'blue';
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}) {
  const isBlue = variant === 'blue';
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: isBlue ? colors.tintBlueBg : colors.tintGreenBg,
          borderColor: isBlue ? colors.tintBlueBorder : colors.tintGreenBorder,
        },
      ]}>
      {title ? (
        <View style={styles.titleRow}>
          {icon}
          <Text style={[styles.title, { color: isBlue ? colors.blue[600] : colors.primary }]}>
            {title}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.text, { color: isBlue ? colors.blue[600] : colors.green[800] }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: font.size.md, fontWeight: font.bold },
  text: { fontSize: font.size.sm, lineHeight: font.size.sm * 1.5 },
});
