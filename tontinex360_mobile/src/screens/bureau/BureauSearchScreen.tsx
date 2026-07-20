import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import SearchBar from '../../components/bureau/SearchBar';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { BUREAU_CATALOG, type CatalogEntry } from '../../lib/bureau/search-catalog';
import { filterByQuery } from '../../lib/search/text';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauSearch'>;
type Section = { title: string; data: CatalogEntry[] };

function groupByModule(entries: CatalogEntry[]): Section[] {
  const order: string[] = [];
  const map = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    if (!map.has(e.module)) {
      map.set(e.module, []);
      order.push(e.module);
    }
    map.get(e.module)!.push(e);
  }
  return order.map((title) => ({ title, data: map.get(title)! }));
}

export default function BureauSearchScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const matched = filterByQuery(BUREAU_CATALOG, query, (e) => [e.label, e.module, ...e.keywords]);
    return groupByModule(matched);
  }, [query]);

  const go = (e: CatalogEntry) => {
    // Navigation dynamique depuis un catalogue : on relâche le typage sur le
    // seul point d'appel (le catalogue garantit des routes sans param requis).
    const nav = navigation as unknown as {
      navigate: (name: string, params?: Record<string, unknown>) => void;
      getParent: () => { navigate: (name: string) => void } | undefined;
    };
    if (e.parent) {
      nav.getParent()?.navigate(e.parent);
      return;
    }
    if (e.route) {
      nav.navigate(e.route, e.params);
    }
  };

  const total = sections.reduce((n, s) => n + s.data.length, 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un module, une action…"
          autoFocus
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => go(item)}>
            <IconBubble icon={item.icon} tint="white" size={36} />
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search" size={30} color={colors.textLight} />
            <Text style={styles.emptyText}>
              Aucun module ne correspond à « {query.trim()} ».
            </Text>
          </View>
        }
        ListHeaderComponent={
          query.trim() ? (
            <Text style={styles.countHint}>
              {total} résultat{total > 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={styles.countHint}>Tous les modules du bureau</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.x5, gap: spacing.xs },
  countHint: { fontSize: font.size.xs, color: colors.textMuted, marginBottom: spacing.sm },
  sectionHeader: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  rowLabel: { flex: 1, fontSize: font.size.md, fontWeight: font.medium, color: colors.text },
  empty: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.x5 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
});
