import React from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

export interface TabDef {
  key: string;
  label: string;
  badge?: number;
}

/** Barre d'onglets horizontaux scrollables avec badges (pattern bureau). */
export default function TabsRow({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[styles.tab, on && styles.tabActive]}
          >
            <Text style={[styles.label, on && styles.labelActive]}>{t.label}</Text>
            {t.badge ? (
              <View style={[styles.badge, on && styles.badgeOnActive]}>
                <Text style={[styles.badgeText, on && styles.badgeTextOnActive]}>
                  {t.badge > 99 ? '99+' : t.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  tabActive: { backgroundColor: colors.primary },
  label: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  labelActive: { color: colors.white },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOnActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: font.bold },
  badgeTextOnActive: { color: colors.white },
});
