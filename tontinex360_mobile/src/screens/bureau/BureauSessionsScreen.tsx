import React, { useState } from 'react';
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

import KpiCard from '../../components/bureau/KpiCard';
import StatusChip from '../../components/bureau/StatusChip';
import { Card, IconBubble, ProgressBar } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { sessionsApi } from '../../lib/api/sessions';
import { cyclesApi } from '../../lib/api/cycles';
import { sessionStatus } from '../../lib/bureau/cycle-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr, formatXAF } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauSessions'>;

function whenLabel(date?: string, startTime?: string | null): string {
  const d = formatDateFr(date, false) || '—';
  return startTime ? `${d} · ${startTime.slice(0, 5)}` : d;
}

export default function BureauSessionsScreen() {
  const navigation = useNavigation<Nav>();
  const [cycleFilter, setCycleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const cyclesQ = useQuery({ queryKey: ['bureau', 'cycles'], queryFn: () => cyclesApi.list(), retry: false });
  const allQ = useQuery({ queryKey: ['bureau', 'sessions', 'all'], queryFn: () => sessionsApi.list() });
  const listQ = useQuery({
    queryKey: ['bureau', 'sessions', cycleFilter, statusFilter],
    queryFn: () =>
      sessionsApi.list({
        ...(cycleFilter ? { cycle: cycleFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  });

  const all = allQ.data ?? [];
  const statsCycleId = cycleFilter || all[0]?.cycle || '';
  const statsQ = useQuery({
    queryKey: ['bureau', 'cycle', statsCycleId, 'stats'],
    queryFn: () => cyclesApi.sessionsStats(statsCycleId),
    enabled: !!statsCycleId,
    retry: false,
  });

  const total = all.length;
  const scheduled = all.filter((s) => s.status === 'scheduled').length;
  const inProgress = all.filter((s) => s.status === 'in_progress').length;
  const completed = all.filter((s) => s.status === 'completed').length;
  // Séance mise en avant : en cours → programmée → sinon la plus récente.
  const mostRecent = [...all].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
  const featured =
    all.find((s) => s.status === 'in_progress') ||
    all.find((s) => s.status === 'scheduled') ||
    mostRecent;

  const stats = statsQ.data;
  const progress = stats
    ? stats.progress_percent ??
      (stats.total_sessions ? Math.round(((stats.completed_sessions ?? 0) / stats.total_sessions) * 100) : null)
    : null;

  const cycleChips = [{ id: '', name: 'Tous' }, ...(cyclesQ.data ?? []).map((c) => ({ id: c.id, name: c.name }))];
  const statusChips = [
    { key: '', label: 'Tous' },
    { key: 'scheduled', label: 'Programmées' },
    { key: 'in_progress', label: 'En cours' },
    { key: 'completed', label: 'Terminées' },
    { key: 'cancelled', label: 'Annulées' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={allQ.isRefetching || listQ.isRefetching}
            onRefresh={() => {
              allQ.refetch();
              listQ.refetch();
              statsQ.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View>
          <Text style={styles.breadcrumb}>Tontines</Text>
          <Text style={styles.pageTitle}>Gestion des Séances</Text>
          <Text style={styles.pageSub}>Réunions, présences, cotisations et clôtures en temps réel.</Text>
        </View>

        {/* Séance mise en avant (toujours visible : sinon état de repli) */}
        <LinearGradient colors={[colors.primary, colors.green[500]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          {featured ? (
            <>
              <Text style={styles.heroTitle}>
                {featured.session_number != null ? `Séance n°${featured.session_number}` : `Séance du ${formatDateFr(featured.date, false)}`}
              </Text>
              <Text style={styles.heroSub}>
                {featured.status === 'in_progress'
                  ? 'Séance en cours — gérez les présences et la clôture.'
                  : featured.status === 'scheduled'
                    ? 'Prochaine séance programmée — préparez la feuille de présence.'
                    : 'Dernière séance — consultez le compte-rendu.'}
              </Text>
              <View style={styles.heroBtnsCol}>
                <Pressable style={styles.heroBtnFull} onPress={() => navigation.navigate('BureauSessionDetail', { id: featured.id })}>
                  <Ionicons name="eye" size={16} color={colors.primary} />
                  <Text style={styles.heroBtnText}>{featured.status === 'in_progress' ? 'Gérer la séance' : 'Voir la séance'}</Text>
                </Pressable>
                <Pressable style={styles.heroOutlineFull} onPress={() => navigation.navigate('BureauSessionCreate')}>
                  <Ionicons name="add" size={16} color={colors.white} />
                  <Text style={styles.heroOutlineText}>Nouvelle séance</Text>
                </Pressable>
              </View>
              <View style={styles.heroStats}>
                <Text style={styles.heroStatsTitle}>RÉSUMÉ SÉANCE</Text>
                <View style={styles.heroGrid}>
                  <HeroStat label="État" value={sessionStatus(featured.status).label} />
                  <HeroStat label="Date" value={formatDateFr(featured.date, false)} />
                  {featured.start_time ? <HeroStat label="Heure" value={featured.start_time.slice(0, 5)} /> : null}
                  {featured.location ? <HeroStat label="Lieu" value={featured.location} /> : null}
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.heroTitle}>Aucune séance à venir</Text>
              <Text style={styles.heroSub}>Planifiez la prochaine réunion de l'association.</Text>
              <View style={styles.heroBtnsCol}>
                <Pressable style={styles.heroBtnFull} onPress={() => navigation.navigate('BureauSessionCreate')}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.heroBtnText}>Ouvrir une séance</Text>
                </Pressable>
              </View>
            </>
          )}
        </LinearGradient>

        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <KpiCard icon="calendar" tint="primary" label="Total séances" value={total} />
          <KpiCard icon="time" tint="info" label="Programmées" value={scheduled} />
          <KpiCard icon="play-circle" tint="accent" label="En cours" value={inProgress} />
          <KpiCard icon="checkmark-circle" tint="lime" label="Terminées" value={completed} />
        </View>

        {/* Progression du cycle */}
        {stats && progress != null ? (
          <Card style={styles.progressCard}>
            <View style={styles.progressHead}>
              <Text style={styles.progressTitle}>Progression du cycle</Text>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
            <ProgressBar value={progress / 100} />
            <View style={styles.progressMetrics}>
              <Metric label="Séances faites" value={`${stats.completed_sessions ?? '—'} / ${stats.total_sessions ?? '—'}`} />
              {stats.total_distributed != null ? <Metric label="Distribué" value={formatXAF(Number(stats.total_distributed))} /> : null}
              {stats.average_attendance != null ? <Metric label="Présence moy." value={`${stats.average_attendance}%`} /> : null}
            </View>
          </Card>
        ) : null}

        {/* Historique */}
        <Text style={styles.sectionTitle}>Historique des séances</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {cycleChips.map((c) => {
            const on = cycleFilter === c.id;
            return (
              <Pressable key={c.id || 'all'} onPress={() => setCycleFilter(c.id)} style={[styles.filterChip, on && styles.filterChipOn]}>
                <Text style={[styles.filterText, on && styles.filterTextOn]} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {statusChips.map((s) => {
            const on = statusFilter === s.key;
            return (
              <Pressable key={s.key || 'all'} onPress={() => setStatusFilter(s.key)} style={[styles.filterChip, on && styles.filterChipOn]}>
                <Text style={[styles.filterText, on && styles.filterTextOn]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {listQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : (listQ.data ?? []).length === 0 ? (
          <View style={styles.empty}>
            <IconBubble icon="calendar-outline" tint="lime" size={56} />
            <Text style={styles.emptyText}>Aucune séance.</Text>
          </View>
        ) : (
          (listQ.data ?? []).map((s) => {
            const st = sessionStatus(s.status);
            return (
              <Pressable key={s.id} style={styles.row} onPress={() => navigation.navigate('BureauSessionDetail', { id: s.id })}>
                <View style={styles.sBadge}>
                  <Text style={styles.sBadgeText}>{s.session_number != null ? `S${s.session_number}` : '•'}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>
                    {s.session_number != null ? `Séance n°${s.session_number}` : `Séance du ${formatDateFr(s.date, false)}`}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {whenLabel(s.date, s.start_time)}{s.location ? ` · ${s.location}` : ''}
                  </Text>
                </View>
                <StatusChip label={st.label} tone={st.tone} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  breadcrumb: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.semibold },
  pageTitle: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.primary, marginTop: 2 },
  pageSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 },

  hero: { borderRadius: radius.hero, padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.primary, ...cardShadow },
  heroTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.white },
  heroSub: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.9)' },
  heroBtnsCol: { gap: spacing.sm, marginTop: spacing.xs },
  heroBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white, paddingVertical: 12, borderRadius: radius.pill },
  heroBtnText: { color: colors.primary, fontWeight: font.bold, fontSize: font.size.sm },
  heroOutlineFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  heroOutlineText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.sm },
  heroStats: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs },
  heroStatsTitle: { fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6, fontWeight: font.bold, marginBottom: spacing.sm },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  heroStat: { width: '50%', marginBottom: spacing.sm, paddingRight: spacing.sm },
  heroStatLabel: { fontSize: font.size.xs, color: 'rgba(255,255,255,0.85)' },
  heroStatValue: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.white, marginTop: 1 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  progressCard: { borderRadius: radius.lg, gap: spacing.sm },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  progressPct: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.primary },
  progressMetrics: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm },
  metricLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  metricValue: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text, marginTop: 2 },

  sectionTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginTop: spacing.xs },
  filterRow: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, maxWidth: 160 },
  filterChipOn: { backgroundColor: colors.primary },
  filterText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  filterTextOn: { color: colors.white },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...cardShadow },
  sBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  sBadgeText: { fontSize: font.size.xs, fontWeight: font.bold, color: colors.primary },
  rowTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
