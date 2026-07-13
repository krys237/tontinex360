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

import KpiCard from '../../components/bureau/KpiCard';
import StatusChip from '../../components/bureau/StatusChip';
import TabsRow from '../../components/bureau/TabsRow';
import { Card } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { membersApi } from '../../lib/api/members';
import type { BureauMember } from '../../lib/types/member';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauBoard'>;

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function BureauBoardScreen() {
  const navigation = useNavigation<Nav>();
  const [activePos, setActivePos] = useState<string | null>(null);

  const positionsQ = useQuery({ queryKey: ['bureau', 'positions'], queryFn: () => membersApi.bureauPositions(), retry: false });
  const membersQ = useQuery({ queryKey: ['bureau', 'bureau-members', 'active'], queryFn: () => membersApi.bureauMembers({ is_active: true }), retry: false });

  const byPosition = useMemo(() => {
    const m: Record<string, BureauMember[]> = {};
    (membersQ.data ?? []).forEach((bm) => {
      const key = bm.position?.slug || bm.position?.id;
      if (!key) return;
      (m[key] ??= []).push(bm);
    });
    return m;
  }, [membersQ.data]);

  const positions = [...(positionsQ.data ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const current = positions.find((p) => (p.slug || p.id) === activePos) ?? positions[0];
  const filled = (membersQ.data ?? []).length;
  const required = positions.filter((p) => p.is_required).length;
  const totalPos = positions.length;
  const vacancies = Math.max(0, required - filled);

  const loading = positionsQ.isLoading || membersQ.isLoading;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={positionsQ.isRefetching || membersQ.isRefetching}
            onRefresh={() => {
              positionsQ.refetch();
              membersQ.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View>
          <Text style={styles.breadcrumb}>Communauté</Text>
          <Text style={styles.pageTitle}>Bureau de l'Association</Text>
          <Text style={styles.pageSub}>Responsables, mandats et organisation du comité exécutif.</Text>
        </View>

        {/* Hero gouvernance */}
        <LinearGradient colors={[colors.primary, colors.green[500]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTitle}>Gouvernance active</Text>
          <Text style={styles.heroSub}>Le bureau supervise les finances, les validations et l'organisation stratégique.</Text>
          <View style={styles.heroBtns}>
            <Pressable style={[styles.heroBtn, styles.heroBtnRow]} onPress={() => navigation.navigate('BureauSettings', { tab: 'positions' })}>
              <Ionicons name="construct" size={16} color={colors.primary} />
              <Text style={styles.heroBtnText}>Postes</Text>
            </Pressable>
            <Pressable style={[styles.heroOutlineBtn, styles.heroBtnRow]} onPress={() => navigation.navigate('BureauGovernance')}>
              <Ionicons name="podium" size={16} color={colors.white} />
              <Text style={styles.heroOutlineText}>Élections</Text>
            </Pressable>
          </View>
          <View style={styles.heroStats}>
            <Text style={styles.heroStatsTitle}>STRUCTURE DU BUREAU</Text>
            <View style={styles.heroGrid}>
              <HeroStat label="Postes actifs" value={filled} />
              <HeroStat label="Postes requis" value={required} />
              <HeroStat label="Postes total" value={totalPos} />
              <HeroStat label="À pourvoir" value={vacancies} />
            </View>
          </View>
        </LinearGradient>

        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <KpiCard icon="ribbon" tint="primary" label="Postes occupés" value={filled} />
          <KpiCard icon="people" tint="primary" label="Postes requis" value={required} sublabel="Définis par l'association" />
          <KpiCard icon="albums" tint="accent" label="Postes total" value={totalPos} />
          <KpiCard icon="person-add" tint={vacancies > 0 ? 'danger' : 'lime'} label="À pourvoir" value={vacancies} />
        </View>

        {/* Responsables */}
        <Text style={styles.sectionTitle}>Responsables Officiels</Text>
        <Text style={styles.sectionSub}>Membres actifs du bureau exécutif.</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : positions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="ribbon-outline" size={36} color={colors.textLight} />
            <Text style={styles.emptyText}>Aucun poste de bureau défini.</Text>
            <Pressable onPress={() => navigation.navigate('BureauSettings', { tab: 'positions' })}>
              <Text style={styles.emptyLink}>Configurer les postes →</Text>
            </Pressable>
          </Card>
        ) : current ? (
          <>
            <View style={styles.tabsWrap}>
              <TabsRow
                tabs={positions.map((p) => {
                  const n = (byPosition[p.slug] || byPosition[p.id] || []).length;
                  return { key: p.slug || p.id, label: p.name, badge: n || undefined };
                })}
                active={current.slug || current.id}
                onChange={setActivePos}
              />
            </View>

            {(() => {
              const holders = byPosition[current.slug] || byPosition[current.id] || [];
              const vacant = holders.length === 0;
              return (
                <Card style={styles.posCard}>
                  <View style={styles.posBadges}>
                    <StatusChip label={current.is_required ? 'Requis' : 'Optionnel'} tone={current.is_required ? 'warning' : 'muted'} />
                    {vacant ? <StatusChip label="Vacant" tone="danger" /> : <StatusChip label={`${holders.length} titulaire${holders.length > 1 ? 's' : ''}`} tone="success" />}
                  </View>
                  <Text style={styles.posName}>{current.name}</Text>
                  {current.description ? <Text style={styles.posDesc}>{current.description}</Text> : null}

                  <View style={styles.holders}>
                    {vacant ? (
                      <Text style={styles.vacantText}>Aucun titulaire actuellement.</Text>
                    ) : (
                      holders.map((bm) => (
                        <Pressable
                          key={bm.id}
                          style={styles.holderRow}
                          onPress={() => bm.membership?.id && navigation.navigate('BureauMemberDetail', { id: bm.membership.id })}
                        >
                          <LinearGradient colors={[colors.green[500], colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials(bm.membership?.user_name)}</Text>
                          </LinearGradient>
                          <View style={styles.flex}>
                            <Text style={styles.holderName} numberOfLines={1}>{bm.membership?.user_name || '—'}</Text>
                            <Text style={styles.holderMeta}>
                              Depuis {formatDateFr(bm.start_date, false)}
                              {bm.end_date ? ` · jusqu'au ${formatDateFr(bm.end_date, false)}` : ''}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                        </Pressable>
                      ))
                    )}
                  </View>
                </Card>
              );
            })()}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
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
  heroBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  heroBtnRow: { flex: 1, alignSelf: 'auto', justifyContent: 'center' },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.pill },
  heroBtnText: { color: colors.primary, fontWeight: font.bold, fontSize: font.size.sm },
  heroOutlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.pill, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  heroOutlineText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.sm },
  heroStats: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs },
  heroStatsTitle: { fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6, fontWeight: font.bold, marginBottom: spacing.sm },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  heroStat: { width: '50%', marginBottom: spacing.sm },
  heroStatLabel: { fontSize: font.size.xs, color: 'rgba(255,255,255,0.85)' },
  heroStatValue: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.white, marginTop: 1 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  sectionTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginTop: spacing.xs },
  sectionSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: -spacing.xs },

  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.x2 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
  emptyLink: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.semibold },

  tabsWrap: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  posCard: { borderRadius: radius.lg, gap: 4 },
  posBadges: { flexDirection: 'row', gap: spacing.sm },
  posName: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginTop: 4 },
  posDesc: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  holders: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm, gap: spacing.xs },
  vacantText: { fontSize: font.size.sm, color: colors.textLight, fontStyle: 'italic' },
  holderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 11, fontWeight: font.bold },
  holderName: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  holderMeta: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
});
