import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import SearchBar from '../../components/bureau/SearchBar';
import SearchCapNotice from '../../components/bureau/SearchCapNotice';
import { useClientSearch } from '../../lib/search/use-client-search';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { sanctionsApi, type SanctionStatus, type SanctionType } from '../../lib/api/sanctions';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF, formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauSanctions'>;
type TabKey = 'applied' | 'types';

const STATUS: Record<SanctionStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  submitted: { label: 'À valider', tone: 'warning' },
  paid: { label: 'Payée', tone: 'success' },
  rejected: { label: 'Rejetée', tone: 'danger' },
  waived: { label: 'Graciée', tone: 'muted' },
  contested: { label: 'Contestée', tone: 'danger' },
};

const STATUS_FILTERS: { key: SanctionStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous statuts' },
  { key: 'pending', label: 'En attente' },
  { key: 'paid', label: 'Payée' },
  { key: 'waived', label: 'Graciée' },
  { key: 'contested', label: 'Contestée' },
];

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauSanctionsScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('applied');
  const [statusFilter, setStatusFilter] = useState<SanctionStatus | 'all'>('all');

  const listQ = useQuery({ queryKey: ['bureau', 'sanctions'], queryFn: () => sanctionsApi.list(), enabled: tab === 'applied' });
  const typesQ = useQuery({ queryKey: ['bureau', 'sanction-types'], queryFn: () => sanctionsApi.types() });

  const removeType = useMutation({
    mutationFn: (id: string) => sanctionsApi.removeType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'sanction-types'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const confirmRemove = (t: SanctionType) =>
    Alert.alert('Supprimer le type', `Supprimer « ${t.name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeType.mutate(t.id) },
    ]);

  const sanctions = listQ.data ?? [];
  const appliedSearch = useClientSearch(sanctions, (s) => [
    s.member_name,
    s.type_name,
    s.reason,
    STATUS[s.status]?.label,
  ]);
  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? appliedSearch.filtered
        : appliedSearch.filtered.filter((s) => s.status === statusFilter),
    [appliedSearch.filtered, statusFilter],
  );
  const typeSearch = useClientSearch(typesQ.data, (t) => [t.name, t.description]);

  const tabs = [
    { key: 'applied', label: 'Sanctions appliquées' },
    { key: 'types', label: 'Types de sanction' },
  ];
  const activeQ = tab === 'applied' ? listQ : typesQ;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={activeQ.isRefetching} onRefresh={() => activeQ.refetch()} tintColor={colors.primary} />}
      >
        {/* Action principale */}
        <RequirePermission bureau>
          <Pressable style={styles.applyBtn} onPress={() => navigation.navigate('BureauSanctionApply')}>
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.applyBtnText}>Appliquer une sanction</Text>
          </Pressable>
        </RequirePermission>

        <View style={styles.tabsInline}>
          <TabsRow tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
        </View>

        {/* ---- Sanctions appliquées ---- */}
        {tab === 'applied' ? (
          <>
            <SearchBar value={appliedSearch.query} onChangeText={appliedSearch.setQuery} placeholder="Rechercher (membre, motif…)" />
            <SearchCapNotice visible={appliedSearch.capped} />
            <View style={styles.filters}>
              {STATUS_FILTERS.map((f) => {
                const on = statusFilter === f.key;
                return (
                  <Pressable key={f.key} onPress={() => setStatusFilter(f.key)} style={[styles.filterChip, on && styles.filterChipOn]}>
                    <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {listQ.isLoading ? (
              <Loader />
            ) : filtered.length === 0 ? (
              <Empty
                icon="shield-checkmark-outline"
                text={appliedSearch.hasQuery ? `Aucune sanction pour « ${appliedSearch.query.trim()} ».` : 'Aucune sanction.'}
              />
            ) : (
              filtered.map((s) => {
                const st = STATUS[s.status] ?? STATUS.pending;
                return (
                  <View key={s.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <IconBubble icon="warning" tint="danger" size={40} />
                      <View style={styles.flex}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{s.member_name ?? 'Membre'}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {s.type_name ?? 'Sanction'}{s.reason ? ` · ${s.reason}` : ''}
                        </Text>
                        {s.paid_at ? <Text style={styles.rowMeta}>Payée le {formatDateFr(s.paid_at, false)}</Text> : null}
                      </View>
                      <View style={styles.right}>
                        <Text style={styles.amount}>{formatXAF(s.amount)}</Text>
                        <StatusChip label={st.label} tone={st.tone} />
                      </View>
                    </View>
                    <RequirePermission bureau>
                      <View style={styles.cardActions}>
                        <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('BureauSanctionApply', { id: s.id })}>
                          <Ionicons name="create-outline" size={15} color={colors.primary} />
                          <Text style={styles.actionText}>Modifier</Text>
                        </Pressable>
                        <Pressable style={[styles.actionBtn, styles.actionBtnWarn]} onPress={() => navigation.navigate('BureauSanctionCorrect', { id: s.id })}>
                          <Ionicons name="alert-circle-outline" size={15} color={colors.goldAccent} />
                          <Text style={[styles.actionText, styles.actionTextWarn]}>Corriger</Text>
                        </Pressable>
                      </View>
                    </RequirePermission>
                  </View>
                );
              })
            )}
          </>
        ) : null}

        {/* ---- Types de sanction ---- */}
        {tab === 'types' ? (
          <>
            <RequirePermission bureau>
              <Pressable style={styles.applyBtn} onPress={() => navigation.navigate('BureauSanctionTypeForm')}>
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={styles.applyBtnText}>Nouveau type</Text>
              </Pressable>
            </RequirePermission>

            {!typesQ.isLoading && (typesQ.data ?? []).length > 0 ? (
              <>
                <SearchBar value={typeSearch.query} onChangeText={typeSearch.setQuery} placeholder="Rechercher un type…" />
                <SearchCapNotice visible={typeSearch.capped} />
              </>
            ) : null}

            {typesQ.isLoading ? (
              <Loader />
            ) : typeSearch.filtered.length === 0 ? (
              <Empty
                icon="list-outline"
                text={typeSearch.hasQuery ? `Aucun type pour « ${typeSearch.query.trim()} ».` : 'Aucun type de sanction.'}
              />
            ) : (
              <View style={styles.typeGrid}>
                {typeSearch.filtered.map((t) => (
                  <View key={t.id} style={styles.typeCard}>
                    <View style={styles.typeHead}>
                      <Text style={styles.typeName} numberOfLines={2}>{t.name}</Text>
                      <View style={styles.typeActions}>
                        <Pressable onPress={() => navigation.navigate('BureauSanctionTypeForm', { id: t.id })} hitSlop={6}>
                          <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                        </Pressable>
                        <Pressable onPress={() => confirmRemove(t)} hitSlop={6}>
                          <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    </View>
                    {t.description ? <Text style={styles.typeDesc} numberOfLines={2}>{t.description}</Text> : <Text style={styles.typeDesc}>—</Text>}
                    <View style={styles.badges}>
                      {t.default_amount != null ? (
                        <View style={[styles.badge, styles.badgeGreen]}>
                          <Text style={[styles.badgeText, styles.badgeTextGreen]}>
                            {t.is_fixed_amount ? 'Fixe' : 'Variable'} : {formatXAF(t.default_amount)}
                          </Text>
                        </View>
                      ) : null}
                      {t.is_automatic ? (
                        <View style={[styles.badge, styles.badgePurple]}>
                          <Text style={[styles.badgeText, styles.badgeTextPurple]}>Auto</Text>
                        </View>
                      ) : null}
                      {!t.is_active ? (
                        <View style={[styles.badge, styles.badgeMuted]}>
                          <Text style={[styles.badgeText, styles.badgeTextMuted]}>Inactif</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Loader() {
  return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />;
}
function Empty({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.empty}>
      <IconBubble icon={icon} tint="lime" size={56} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },

  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
  },
  applyBtnText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  tabsInline: { marginTop: spacing.xs, marginBottom: spacing.xs },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  filterChipOn: { backgroundColor: colors.primary },
  filterText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  filterTextOn: { color: colors.white },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    ...cardShadow,
  },
  rowTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  rowMeta: { fontSize: font.size.xs, color: colors.textLight, marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.danger },

  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardActions: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.greenBg },
  actionBtnWarn: { backgroundColor: colors.goldSoft },
  actionText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },
  actionTextWarn: { color: '#7A5B10' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: { width: '48%', flexGrow: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  typeHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  typeName: { flex: 1, fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  typeActions: { flexDirection: 'row', gap: spacing.sm },
  typeDesc: { fontSize: font.size.xs, color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  badgeGreen: { backgroundColor: colors.greenBg },
  badgePurple: { backgroundColor: '#EDE7FB' },
  badgeMuted: { backgroundColor: colors.surfaceAlt },
  badgeText: { fontSize: font.size.xs, fontWeight: font.semibold },
  badgeTextGreen: { color: colors.primary },
  badgeTextPurple: { color: '#6D4FB0' },
  badgeTextMuted: { color: colors.textMuted },

  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
