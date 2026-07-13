import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, IconBubble } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import type { BubbleTint } from '../../components/ui/IconBubble';
import type { BureauStackParamList } from '../../navigation/types';
import { membersApi } from '../../lib/api/members';
import { sessionsApi } from '../../lib/api/sessions';
import { financeApi } from '../../lib/api/finance';
import { cyclesApi } from '../../lib/api/cycles';
import { invitationsApi } from '../../lib/api/invitations';
import { useAuthStore } from '../../lib/stores/auth-store';
import { usePermissions } from '../../lib/hooks/use-permissions';
import { sessionStatus } from '../../lib/bureau/cycle-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatNumber, timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauOverview'>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function shortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function BureauOverviewScreen() {
  const navigation = useNavigation<Nav>();
  const assoc = useAuthStore((s) => s.activeAssociation);
  const user = useAuthStore((s) => s.user);
  const p = usePermissions();

  const canMembers = p.isPresident || p.canAny(['members.*', '*']);
  const canFinance = p.isPresident || p.canAny(['finance.*', '*']);

  const membersQ = useQuery({ queryKey: ['bureau', 'members', 'list'], queryFn: () => membersApi.list(), enabled: canMembers, retry: false });
  const sessionsQ = useQuery({ queryKey: ['bureau', 'overview', 'sessions'], queryFn: () => sessionsApi.list(), retry: false });
  const treasuryQ = useQuery({ queryKey: ['bureau', 'overview', 'treasury'], queryFn: () => financeApi.treasury(), enabled: canFinance, retry: false });
  const cyclesQ = useQuery({ queryKey: ['bureau', 'overview', 'cycles'], queryFn: () => cyclesApi.list(), retry: false });
  const invitationsQ = useQuery({ queryKey: ['bureau', 'invitations', 'pending'], queryFn: () => invitationsApi.list({ status: 'pending' }), enabled: canMembers, retry: false });
  const contribQ = useQuery({ queryKey: ['bureau', 'overview', 'contributions'], queryFn: () => financeApi.contributions(), enabled: canFinance, retry: false });

  const activeMembers = (membersQ.data ?? []).filter((m) => m.is_active).length;
  const totalBalance = (treasuryQ.data ?? []).reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const activeCycles = (cyclesQ.data ?? []).filter((c) => c.status === 'active').length;
  const sessions = sessionsQ.data ?? [];
  const nextSession = sessions.find((s) => s.status === 'scheduled');
  const recentSessions = [...sessions].slice(0, 5);
  const recentMembers = (membersQ.data ?? []).slice(0, 4);
  const pendingInvites = invitationsQ.data ?? [];

  const contributionRate = (() => {
    const eligible = (contribQ.data ?? []).filter((c) => ['paid', 'partial', 'defaulted'].includes(c.status));
    if (eligible.length === 0) return null;
    const expected = eligible.reduce((s, c) => s + Number(c.expected_amount ?? 0), 0);
    const paid = eligible.reduce((s, c) => s + Number(c.paid_amount ?? 0), 0);
    if (expected <= 0) return null;
    return Math.round((paid / expected) * 100);
  })();

  const onRefresh = () => {
    membersQ.refetch(); sessionsQ.refetch(); treasuryQ.refetch();
    cyclesQ.refetch(); invitationsQ.refetch(); contribQ.refetch();
  };
  const refreshing =
    membersQ.isRefetching || sessionsQ.isRefetching || treasuryQ.isRefetching ||
    cyclesQ.isRefetching || invitationsQ.isRefetching || contribQ.isRefetching;

  const assocName = assoc?.name ?? 'Votre association';

  const quickActions: { icon: IoniconName; label: string; tint: BubbleTint; onPress: () => void; show: boolean }[] = [
    { icon: 'add', label: 'Nouvelle séance', tint: 'primary', onPress: () => navigation.navigate('BureauSessionCreate'), show: true },
    { icon: 'person-add', label: 'Inviter membre', tint: 'lime', onPress: () => navigation.navigate('BureauInvitations'), show: canMembers },
    { icon: 'card', label: 'Saisir cotisations', tint: 'accent', onPress: () => navigation.navigate('BureauFinance'), show: canFinance },
    { icon: 'cube', label: 'Distribuer cagnotte', tint: 'info', onPress: () => navigation.navigate('BureauCycles'), show: true },
    { icon: 'cash', label: 'Gérer prêts', tint: 'accent', onPress: () => navigation.navigate('BureauFinance'), show: canFinance },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Titre */}
        <View>
          <Text style={styles.breadcrumb}>Tableau de bord</Text>
          <Text style={styles.pageTitle}>{assocName}</Text>
          <Text style={styles.pageSub}>Vue d'ensemble en temps réel de l'activité de l'association.</Text>
        </View>

        {/* Hero */}
        <LinearGradient colors={[colors.primary, colors.green[500]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTitle}>{assocName}</Text>
          <Text style={styles.heroSub}>Pilotage en temps réel — cotisations, prêts et cycles en un coup d'œil.</Text>
          <View style={styles.heroBtns}>
            <Pressable style={styles.heroPrimaryBtn} onPress={() => navigation.navigate('BureauSessions')}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.heroPrimaryText}>Ouvrir une séance</Text>
            </Pressable>
            <Pressable style={styles.heroOutlineBtn} onPress={() => navigation.navigate('BureauFinance')}>
              <Text style={styles.heroOutlineText}>Voir les finances</Text>
            </Pressable>
          </View>
          <View style={styles.heroStatsCard}>
            <Text style={styles.heroStatsTitle}>VUE D'ENSEMBLE</Text>
            <View style={styles.heroStatsGrid}>
              <HeroStat label="Membres actifs" value={String(activeMembers)} />
              <HeroStat label="Trésorerie" value={`${formatNumber(totalBalance)} XAF`} />
              <HeroStat label="Cycles actifs" value={String(activeCycles)} />
              <HeroStat label="Séances" value={String(sessions.length)} />
            </View>
          </View>
        </LinearGradient>

        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <KpiCard icon="people" tint="lime" label="Membres actifs" value={String(activeMembers)} />
          <KpiCard icon="cash" tint="primary" label="Trésorerie" value={formatNumber(totalBalance)} unit="XAF" />
          <KpiCard icon="trending-up" tint="accent" label="Taux cotisation" value={contributionRate === null ? '—' : String(contributionRate)} unit={contributionRate === null ? undefined : '%'} />
          <KpiCard icon="calendar" tint="info" label="Prochaine séance" value={nextSession ? shortDate(nextSession.date) : '—'} />
        </View>

        {/* Actions rapides */}
        <View style={styles.quickWrap}>
          {quickActions.filter((a) => a.show).map((a) => (
            <Pressable key={a.label} style={styles.quickBtn} onPress={a.onPress}>
              <IconBubble icon={a.icon} tint={a.tint} size={32} />
              <Text style={styles.quickLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Séances récentes */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Séances récentes</Text>
            <Pressable onPress={() => navigation.navigate('BureauCycles')}>
              <Text style={styles.sectionLink}>Voir tout</Text>
            </Pressable>
          </View>
          {recentSessions.length === 0 ? (
            <Text style={styles.empty}>Aucune séance pour le moment.</Text>
          ) : (
            recentSessions.map((s, i) => {
              const st = sessionStatus(s.status);
              return (
                <Pressable key={s.id} style={[styles.itemRow, i > 0 && styles.divider]} onPress={() => navigation.navigate('BureauSessionDetail', { id: s.id })}>
                  <View style={styles.sBadge}>
                    <Text style={styles.sBadgeText}>S{s.session_number}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.itemTitle}>Séance {s.session_number}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {shortDate(s.date)}{s.location ? ` — ${s.location}` : ''}
                    </Text>
                  </View>
                  <StatusChip label={st.label} tone={st.tone} />
                </Pressable>
              );
            })
          )}
        </Card>

        {/* Membres récents */}
        {canMembers ? (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Membres récents</Text>
              <Pressable onPress={() => navigation.navigate('BureauMembers')}>
                <Text style={styles.sectionLink}>Tous</Text>
              </Pressable>
            </View>
            {recentMembers.length === 0 ? (
              <Text style={styles.empty}>Aucun membre.</Text>
            ) : (
              recentMembers.map((m, i) => (
                <Pressable key={m.id} style={[styles.itemRow, i > 0 && styles.divider]} onPress={() => navigation.navigate('BureauMemberDetail', { id: m.id })}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(m.user_name)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.itemTitle}>{m.user_name}</Text>
                    <Text style={styles.itemSub}>#{m.member_number}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </Card>
        ) : null}

        {/* Invitations en attente */}
        {canMembers ? (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="paper-plane" size={14} color={colors.primary} />
                <Text style={styles.sectionTitle}>Invitations en attente</Text>
                {pendingInvites.length > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{pendingInvites.length}</Text>
                  </View>
                ) : null}
              </View>
              <Pressable onPress={() => navigation.navigate('BureauInvitations')}>
                <Text style={styles.sectionLink}>+ Inviter</Text>
              </Pressable>
            </View>
            {pendingInvites.length === 0 ? (
              <Text style={styles.empty}>Aucune invitation en attente.</Text>
            ) : (
              pendingInvites.slice(0, 5).map((inv, i) => (
                <View key={inv.id} style={[styles.itemRow, i > 0 && styles.divider]}>
                  <IconBubble
                    icon={inv.channel === 'email' ? 'mail' : inv.channel === 'sms' || inv.channel === 'whatsapp' ? 'call' : 'paper-plane'}
                    tint="lime"
                    size={32}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{inv.name || inv.email || inv.phone || 'Sans nom'}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {(inv.email || inv.phone || '') + ' · ' + timeAgo(inv.created_at)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

function KpiCard({ icon, tint, label, value, unit }: { icon: IoniconName; tint: BubbleTint; label: string; value: string; unit?: string }) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiHead}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <IconBubble icon={icon} tint={tint} size={34} />
      </View>
      <View style={styles.kpiValueRow}>
        <Text style={styles.kpiValue}>{value}</Text>
        {unit ? <Text style={styles.kpiUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },

  breadcrumb: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.semibold },
  pageTitle: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.primary, marginTop: 2 },
  pageSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 },

  hero: { borderRadius: radius.hero, padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.primary, ...cardShadow },
  heroTitle: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.white },
  heroSub: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.9)' },
  heroBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  heroPrimaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.pill },
  heroPrimaryText: { color: colors.primary, fontWeight: font.bold, fontSize: font.size.sm },
  heroOutlineBtn: { justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 11, borderRadius: radius.pill, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  heroOutlineText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.sm },
  heroStatsCard: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs },
  heroStatsTitle: { fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6, fontWeight: font.bold, marginBottom: spacing.sm },
  heroStatsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  heroStat: { width: '50%', marginBottom: spacing.sm },
  heroStatLabel: { fontSize: font.size.xs, color: 'rgba(255,255,255,0.85)' },
  heroStatValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white, marginTop: 1 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: { width: '48%', flexGrow: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  kpiHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  kpiLabel: { flex: 1, fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.semibold, textTransform: 'uppercase', letterSpacing: 0.3 },
  kpiValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  kpiValue: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.text },
  kpiUnit: { fontSize: font.size.xs, color: colors.textMuted },

  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  quickLabel: { fontSize: font.size.sm, fontWeight: font.medium, color: colors.text },

  sectionCard: { borderRadius: radius.lg, paddingVertical: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.sm },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  sectionLink: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.semibold },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  itemTitle: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  itemSub: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },

  sBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  sBadgeText: { fontSize: font.size.xs, fontWeight: font.bold, color: colors.primary },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 11, fontWeight: font.bold, color: colors.white },

  countBadge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: colors.white, fontSize: 10, fontWeight: font.bold },

  empty: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
});
