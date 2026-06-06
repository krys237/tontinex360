import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import IconBubble, { BubbleTint } from './IconBubble';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { cardShadow } from '../../theme/shadow';

type IoniconName = React.ComponentProps<typeof IconBubble>['icon'];

/** White stat card: label + corner icon bubble + green value + optional hint/unit. */
export default function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  tint = 'lime',
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: IoniconName;
  tint?: BubbleTint;
}) {
  return (
    <View style={styles.tile}>
      <View style={styles.top}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {icon ? <IconBubble icon={icon} tint={tint} size={32} /> : null}
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    ...cardShadow,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  label: { flex: 1, fontSize: font.size.sm, fontWeight: font.medium, color: colors.textMuted },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.primary, letterSpacing: -0.3 },
  unit: { fontSize: font.size.sm, fontWeight: font.medium, color: colors.textMuted },
  hint: { fontSize: font.size.xs, color: colors.textLight },
});
