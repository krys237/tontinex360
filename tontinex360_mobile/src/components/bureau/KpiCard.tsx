import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IconBubble } from '../ui';
import type { BubbleTint } from '../ui/IconBubble';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Carte KPI réutilisable (label + valeur + sous-label + icône). */
export default function KpiCard({
  icon,
  label,
  value,
  sublabel,
  unit,
  tint = 'primary',
}: {
  icon: IoniconName;
  label: string;
  value: string | number;
  sublabel?: string;
  unit?: string;
  tint?: BubbleTint;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <IconBubble icon={icon} tint={tint} size={32} />
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', flexGrow: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  label: { flex: 1, fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.semibold, textTransform: 'uppercase', letterSpacing: 0.3 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.text },
  unit: { fontSize: font.size.xs, color: colors.textMuted },
  sublabel: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
});
