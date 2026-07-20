import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import SearchBar from '../../components/bureau/SearchBar';
import { useDebounce } from '../../lib/hooks/use-debounce';
import { useClientSearch } from '../../lib/search/use-client-search';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { cyclesApi } from '../../lib/api/cycles';
import { tontinesApi } from '../../lib/api/tontines';
import type { TontineType } from '../../lib/types/tontine';
import { potsApi } from '../../lib/api/pots';
import { cycleStatus, payoutStatus } from '../../lib/bureau/cycle-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF, formatDateFr, timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauCycles'>;
type TabKey = 'cycles' | 'types' | 'pots' | 'payouts';

export default function BureauCyclesScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab] = useState<TabKey>('cycles');
  const [typeSearch, setTypeSearch] = useState('');
  const debouncedTypeSearch = useDebounce(typeSearch.trim(), 300);
  // Mode « recherche Types » : on masque le hero + la section méthodes pour
  // (1) remonter les résultats au-dessus du clavier, (2) éviter que les
  // compteurs du hero ne se décalent quand la liste filtrée change de taille.
  // Basé sur la saisie immédiate (pas le debounce) → le hero se replie dès la frappe.
  const focusTypeSearch = tab === 'types' && typeSearch.trim().length > 0;

  // Toujours chargés : alimentent le hero + le résumé général + les cartes méthodes.
  const cyclesQ = useQuery({
    queryKey: ['bureau', 'cycles'],
    queryFn: () => cyclesApi.list(),
  });
  const typesQ = useQuery({
    queryKey: ['bureau', 'tontine-types'],
    queryFn: () => tontinesApi.types(),
  });
  // Recherche serveur (search_fields backend) — query séparée pour ne pas
  // fausser les stats du hero, qui doivent refléter TOUS les types. N'est
  // sollicitée que quand l'utilisateur tape (sinon on réutilise typesQ complet).
  const typesSearchQ = useQuery({
    queryKey: ['bureau', 'tontine-types', 'search', debouncedTypeSearch],
    queryFn: () => tontinesApi.types({ search: debouncedTypeSearch }),
    enabled: tab === 'types' && debouncedTypeSearch.length > 0,
  });
  const potsQ = useQuery({
    queryKey: ['bureau', 'pots'],
    queryFn: () => potsApi.list(),
    enabled: tab === 'pots',
  });
  const payoutsQ = useQuery({
    queryKey: ['bureau', 'payouts'],
    queryFn: () => potsApi.payouts(),
    enabled: tab === 'payouts',
  });

  const cycles = cyclesQ.data ?? [];
  const types = typesQ.data ?? [];
  const cycleSearch = useClientSearch(cyclesQ.data, (c) => [
    c.name,
    cycleStatus(c.status).label,
    formatDateFr(c.start_date, false),
  ]);

  const stats = useMemo(() => {
    const activeTypes = types.filter((t) => t.is_active).length;
    return {
      activeTypes,
      totalCycles: cycles.length,
      runningCycles: cycles.filter((c) => c.status === 'active').length,
      configuredTypes: types.length,
    };
  }, [cycles, types]);

  const methodCounts = useMemo(() => {
    const count = (m: string) => types.filter((t) => t.is_active && t.default_acquisition_method === m).length;
    return { random: count('random'), auction: count('auction'), vote: count('vote') };
  }, [types]);

  const tabs = [
    { key: 'cycles', label: `Cycles (${cycles.length})` },
    { key: 'types', label: `Types (${types.length})` },
    { key: 'pots', label: 'Cagnottes' },
    { key: 'payouts', label: 'Distributions' },
  ];
  const activeQ = tab === 'cycles' ? cyclesQ : tab === 'types' ? typesQ : tab === 'pots' ? potsQ : payoutsQ;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={activeQ.isRefetching} onRefresh={() => activeQ.refetch()} tintColor={colors.primary} />
        }
      >
        {!focusTypeSearch ? (
        <>
        {/* ---- Hero ---- */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroTitle}>Automatisez vos tontines communautaires</Text>
          <Text style={styles.heroSub}>
            Gérez les types de tontines, les règles de participation, les distributions et les méthodes d'attribution des bénéficiaires.
          </Text>
          <View style={styles.heroBtnsCol}>
            <RequirePermission bureau>
              <Pressable style={styles.heroBtnFull} onPress={() => navigation.navigate('BureauTontineTypeForm')}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.heroBtnText}>Créer une tontine</Text>
              </Pressable>
            </RequirePermission>
            <Pressable style={styles.heroOutlineFull} onPress={() => navigation.navigate('BureauSessions')}>
              <Ionicons name="stats-chart" size={16} color={colors.white} />
              <Text style={styles.heroOutlineText}>Voir les performances</Text>
            </Pressable>
          </View>

          {/* Résumé général */}
          <View style={styles.resume}>
            <Text style={styles.resumeLabel}>RÉSUMÉ GÉNÉRAL</Text>
            <View style={styles.resumeGrid}>
              <ResumeStat label="Tontines actives" value={stats.activeTypes} />
              <ResumeStat label="Cycles en cours" value={stats.runningCycles} />
              <ResumeStat label="Cycles total" value={stats.totalCycles} />
              <ResumeStat label="Types configurés" value={stats.configuredTypes} />
            </View>
          </View>
        </LinearGradient>

        {/* ---- Types de Tontines (méthodes d'attribution) ---- */}
        <Text style={styles.sectionTitle}>Types de Tontines</Text>
        <Text style={styles.sectionSub}>Différentes méthodes d'attribution des cagnottes.</Text>
        <MethodCard icon="shuffle" tint="info" title="Tirage aléatoire" desc="Attribution automatique des bénéficiaires par tirage au sort." count={methodCounts.random} />
        <MethodCard icon="hammer" tint="accent" title="Enchères" desc="Les membres enchérissent pour obtenir la cagnotte en premier." count={methodCounts.auction} />
        <MethodCard icon="checkbox" tint="primary" title="Vote communautaire" desc="Les bénéficiaires sont choisis par vote des membres." count={methodCounts.vote} />
        </>
        ) : null}

        {/* ---- Onglets ---- */}
        <View style={styles.tabsInline}>
          <TabsRow tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
        </View>

        {/* ---- Cycles ---- */}
        {tab === 'cycles' ? (
          <>
            <RequirePermission bureau>
              <Pressable style={styles.addBtn} onPress={() => navigation.navigate('BureauCycleCreate')}>
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={styles.addBtnText}>Nouveau cycle</Text>
              </Pressable>
            </RequirePermission>

            {!cyclesQ.isLoading && cycles.length > 0 ? (
              <SearchBar value={cycleSearch.query} onChangeText={cycleSearch.setQuery} placeholder="Rechercher un cycle…" />
            ) : null}

            {cyclesQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
            ) : cycleSearch.filtered.length === 0 ? (
              <Empty icon="reload-circle-outline" text={cycleSearch.hasQuery ? `Aucun cycle pour « ${cycleSearch.query.trim()} ».` : 'Aucun cycle.'} />
            ) : (
              cycleSearch.filtered.map((c) => {
                const st = cycleStatus(c.status);
                return (
                  <Pressable key={c.id} style={styles.row} onPress={() => navigation.navigate('BureauCycleDetail', { id: c.id })}>
                    <IconBubble icon="reload-circle" tint="primary" size={40} />
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>{c.name}</Text>
                      <Text style={styles.rowSub}>
                        {formatDateFr(c.start_date, false)} · {c.session_count ?? 0} séance(s)
                      </Text>
                    </View>
                    <StatusChip label={st.label} tone={st.tone} />
                    <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                  </Pressable>
                );
              })
            )}
          </>
        ) : null}

        {/* ---- Types de cotisation ---- */}
        {tab === 'types' ? (
          <>
            <RequirePermission bureau>
              <Pressable style={styles.addBtn} onPress={() => navigation.navigate('BureauTontineTypeForm')}>
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={styles.addBtnText}>Nouveau type</Text>
              </Pressable>
            </RequirePermission>

            <SearchBar value={typeSearch} onChangeText={setTypeSearch} placeholder="Rechercher un type (nom, description)…" />

            {/* Liste : query serveur quand on cherche, sinon la liste complète. */}
            {(() => {
              const searching = debouncedTypeSearch.length > 0;
              const listQ = searching ? typesSearchQ : typesQ;
              const items = (searching ? typesSearchQ.data : typesQ.data) ?? [];
              if (listQ.isLoading) {
                return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />;
              }
              if (items.length === 0) {
                return (
                  <Empty
                    icon="layers-outline"
                    text={searching ? `Aucun type pour « ${debouncedTypeSearch} ».` : 'Aucun type de cotisation.'}
                  />
                );
              }
              return items.map((t) => (
                <TypeCard key={t.id} t={t} onEdit={() => navigation.navigate('BureauTontineTypeForm', { id: t.id })} />
              ));
            })()}
          </>
        ) : null}

        {/* ---- Cagnottes ---- */}
        {tab === 'pots' ? (
          potsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (potsQ.data ?? []).length === 0 ? (
            <Empty icon="cube-outline" text="Aucune cagnotte." />
          ) : (
            (potsQ.data ?? []).map((p) => (
              <Pressable key={p.id} style={styles.row} onPress={() => navigation.navigate('BureauPotDetail', { id: p.id })}>
                <IconBubble icon="cube" tint={p.is_closed ? 'lime' : 'accent'} size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{p.tontine_name}</Text>
                  <Text style={styles.rowSub}>
                    {formatXAF(p.total_available)} · {p.method_display}
                  </Text>
                </View>
                <StatusChip label={p.is_closed ? 'Fermée' : 'Ouverte'} tone={p.is_closed ? 'muted' : 'success'} />
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </Pressable>
            ))
          )
        ) : null}

        {/* ---- Distributions ---- */}
        {tab === 'payouts' ? (
          payoutsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (payoutsQ.data ?? []).length === 0 ? (
            <Empty icon="gift-outline" text="Aucune distribution." />
          ) : (
            (payoutsQ.data ?? []).map((p) => {
              const st = payoutStatus(p.status);
              return (
                <View key={p.id} style={styles.row}>
                  <IconBubble icon="gift" tint="primary" size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{formatXAF(p.amount)}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {p.member_name} · {p.tontine_name}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <StatusChip label={st.label} tone={st.tone} />
                    {p.paid_at ? <Text style={styles.meta}>{timeAgo(p.paid_at)}</Text> : null}
                  </View>
                </View>
              );
            })
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Empty({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.empty}>
      <IconBubble icon={icon} tint="lime" size={56} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const PATTERN_LABEL: Record<string, string> = {
  rotating: 'Rotative',
  individual_savings: 'Épargne indiv.',
  collective_savings: 'Caisse commune',
};
const METHOD_LABEL: Record<string, string> = {
  random: 'Tirage',
  sequential: 'Tour de rôle',
  auction: 'Enchère',
  vote: 'Vote',
  need_based: 'Besoin',
  manual: 'Manuel',
};
const MODE_LABEL: Record<string, string> = { fixed: 'Fixe', range: 'Plage', free: 'Libre' };

function Badge({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'gold' | 'green' | 'blue' }) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}` as const]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}` as const]]}>{text}</Text>
    </View>
  );
}

function TypeCard({ t, onEdit }: { t: TontineType; onEdit: () => void }) {
  const restitution =
    t.payout_pattern === 'rotating'
      ? `Rotative · ${METHOD_LABEL[t.default_acquisition_method ?? 'random'] ?? ''}`
      : PATTERN_LABEL[t.payout_pattern ?? 'rotating'];
  return (
    <View style={styles.typeCard}>
      <View style={styles.typeHead}>
        <IconBubble icon="layers" tint="lime" size={40} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{t.name}</Text>
          {t.description ? <Text style={styles.rowSub} numberOfLines={1}>{t.description}</Text> : null}
        </View>
        <Pressable style={styles.editBtn} onPress={onEdit} hitSlop={8}>
          <Ionicons name="create-outline" size={15} color={colors.primary} />
          <Text style={styles.editText}>Modifier</Text>
        </Pressable>
      </View>
      <View style={styles.badges}>
        <Badge text={t.contribution_kind === 'in_kind' ? '🌽 Nature' : '🪙 Argent'} tone="gold" />
        <Badge text={`Mode : ${MODE_LABEL[t.rate_mode] ?? t.rate_mode}`} tone="blue" />
        {t.allows_multiple_shares ? <Badge text="Multi-nom" tone="muted" /> : null}
        <Badge text={restitution} tone="green" />
      </View>
    </View>
  );
}

function ResumeStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.resumeStat}>
      <Text style={styles.resumeValue}>{value}</Text>
      <Text style={styles.resumeStatLabel}>{label}</Text>
    </View>
  );
}

function MethodCard({
  icon, tint, title, desc, count,
}: { icon: any; tint: 'info' | 'accent' | 'primary'; title: string; desc: string; count: number }) {
  return (
    <View style={styles.methodCard}>
      <View style={styles.methodHead}>
        <IconBubble icon={icon} tint={tint} size={40} />
        <View style={styles.flex}>
          <Text style={styles.methodTitle}>{title}</Text>
          <Text style={styles.methodDesc}>{desc}</Text>
        </View>
      </View>
      <View style={styles.methodCountBox}>
        <Text style={styles.methodCountLabel}>TONTINES ACTIVES</Text>
        <Text style={styles.methodCountValue}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },

  hero: { borderRadius: radius.hero, padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.primary, ...cardShadow },
  heroTitle: { color: colors.white, fontSize: font.size.xl, fontWeight: font.bold },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.size.sm },
  heroBtnsCol: { gap: spacing.sm, marginTop: spacing.xs },
  heroBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white, paddingVertical: 12, borderRadius: radius.pill },
  heroBtnText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  heroOutlineFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  heroOutlineText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  resume: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  resumeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: font.bold, letterSpacing: 0.5, marginBottom: spacing.sm },
  resumeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  resumeStat: { width: '50%', flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 3 },
  resumeValue: { color: colors.white, fontSize: font.size.lg, fontWeight: font.bold },
  resumeStatLabel: { color: 'rgba(255,255,255,0.85)', fontSize: font.size.xs },

  sectionTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text, marginTop: spacing.sm },
  sectionSub: { fontSize: font.size.sm, color: colors.textMuted, marginBottom: spacing.xs },
  methodCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  methodHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  methodTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  methodDesc: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  methodCountBox: { backgroundColor: colors.greenBg, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  methodCountLabel: { fontSize: 10, fontWeight: font.semibold, color: colors.textMuted, letterSpacing: 0.4 },
  methodCountValue: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.primary, marginTop: 1 },

  tabsInline: { marginTop: spacing.md, marginBottom: spacing.xs },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  addBtnText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  typeCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  typeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editText: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.semibold },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  badge_muted: { backgroundColor: colors.surfaceAlt },
  badge_gold: { backgroundColor: colors.goldSoft },
  badge_green: { backgroundColor: colors.greenBg },
  badge_blue: { backgroundColor: colors.blue[100] },
  badgeText: { fontSize: font.size.xs, fontWeight: font.semibold },
  badgeText_muted: { color: colors.textMuted },
  badgeText_gold: { color: '#7A5B10' },
  badgeText_green: { color: colors.primary },
  badgeText_blue: { color: colors.blue[600] },
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
  right: { alignItems: 'flex-end', gap: 4 },
  meta: { fontSize: font.size.xs, color: colors.textLight },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
