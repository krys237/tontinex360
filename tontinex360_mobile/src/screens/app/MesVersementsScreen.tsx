import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';

import { Card } from '../../components/ui';
import { financeApi } from '../../lib/api/finance';
import { cyclesApi } from '../../lib/api/cycles';
import { useAuthStore } from '../../lib/stores/auth-store';
import { usePermissions } from '../../lib/hooks/use-permissions';
import type { ContributionStatus } from '../../lib/types/finance';
import { formatNumber } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function dateFR(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS: Record<ContributionStatus, { label: string; bg: string; fg: string; icon: string }> = {
  paid: { label: 'Payée', bg: colors.greenBg, fg: colors.primary, icon: 'checkmark-circle-outline' },
  partial: { label: 'Partielle', bg: colors.goldSoft, fg: colors.goldAccent, icon: 'cash-outline' },
  pending: { label: 'En attente', bg: colors.surfaceAlt, fg: colors.textMuted, icon: 'time-outline' },
  submitted: { label: 'À valider', bg: colors.goldSoft, fg: colors.goldAccent, icon: 'shield-outline' },
  rejected: { label: 'Rejetée', bg: colors.dangerSoft, fg: colors.danger, icon: 'close-circle-outline' },
  defaulted: { label: 'Impayée', bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle-outline' },
};

export default function MesVersementsScreen() {
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;
  const { isBureau } = usePermissions();
  const [activeTab, setActiveTab] = useState<'mine' | 'all'>('mine');

  // Dynamic parameters based on the active tab
  const queryParams = React.useMemo(() => {
    if (activeTab === 'mine' && myId) {
      return { membership: myId };
    }
    return undefined; // All contributions (Bureau View)
  }, [activeTab, myId]);

  const contribQ = useQuery({
    queryKey: ['contributions', activeTab, myId],
    queryFn: () => financeApi.contributions(queryParams as any),
  });

  const sessionsQ = useQuery({ queryKey: ['cycle', 'sessions'], queryFn: () => cyclesApi.sessions() });

  const sessionsMap = React.useMemo(() => {
    const map = new Map<string, any>();
    (sessionsQ.data ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [sessionsQ.data]);

  // Member stats calculated from their own payments
  const myContributions = (activeTab === 'mine' ? contribQ.data : []) ?? [];
  // Fallback check: if on 'all' tab, we can calculate stats if we filter the loaded list
  const memberContribList = activeTab === 'mine' ? myContributions : (contribQ.data ?? []).filter(c => c.membership === myId);

  const totalVerse = memberContribList.reduce((s, c) => s + (Number(c.paid_amount) || 0), 0);
  const paidCount = memberContribList.filter((c) => c.status === 'paid').length;
  const pendingCount = memberContribList.filter((c) => c.status === 'pending' || c.status === 'submitted').length;

  const listData = contribQ.data ?? [];

  const loading = contribQ.isLoading || sessionsQ.isLoading;
  const refreshing = contribQ.isRefetching || sessionsQ.isRefetching;

  const onRefresh = () => {
    contribQ.refetch();
    sessionsQ.refetch();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        
        {/* Stats Summary Header */}
        <Card style={styles.summary}>
          <Text style={styles.summaryTitle}>Mon bilan des versements</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{formatNumber(totalVerse)}</Text>
              <Text style={styles.statLabel}>Total versé (XAF)</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.primary }]}>{paidCount}</Text>
              <Text style={styles.statLabel}>Cotisations payées</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.goldAccent }]}>{pendingCount}</Text>
              <Text style={styles.statLabel}>En attente / À valider</Text>
            </View>
          </View>
        </Card>

        {/* Role-based Tabs (Bureau View) */}
        {isBureau && (
          <View style={styles.tabsRow}>
            <Pressable
              onPress={() => setActiveTab('mine')}
              style={[styles.tabBtn, activeTab === 'mine' && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === 'mine' && styles.tabTextActive]}>
                Mes versements
              </Text>
            </Pressable>
            
            <Pressable
              onPress={() => setActiveTab('all')}
              style={[styles.tabBtn, activeTab === 'all' && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                Tous les versements
              </Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : listData.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="cash-outline" size={28} color={colors.textLight} />
            <Text style={styles.empty}>Aucun versement enregistré.</Text>
          </Card>
        ) : (
          listData.map((c) => {
            const st = STATUS[c.status] ?? STATUS.pending;
            const expected = Number(c.expected_amount) || 0;
            const paid = Number(c.paid_amount) || 0;
            const session = sessionsMap.get(c.session);
            
            const tontineName = c.tontine_type_name ?? 'Tontine';
            const sessionLabel = session ? `Séance N°${session.session_number}` : 'Séance';
            const dateLabel = c.paid_at 
              ? `Payé le ${dateFR(c.paid_at)}` 
              : (session ? `Séance le ${dateFR(session.date)}` : dateFR(c.created_at));

            return (
              <Card key={c.id} style={styles.item}>
                <View style={styles.itemHead}>
                  <View style={[styles.itemBubble, { borderColor: st.fg }]}>
                    <Ionicons name={st.icon as any} size={20} color={st.fg} />
                  </View>
                  
                  <View style={styles.flex}>
                    <View style={styles.row}>
                      <Text style={styles.itemTontineName}>{tontineName}</Text>
                      <Text style={styles.itemSessionLabel}>{sessionLabel}</Text>
                    </View>
                    
                    <Text style={styles.itemSub}>
                      {dateLabel}
                    </Text>
                    
                    <Text style={styles.itemExpected}>
                      Montant attendu : {formatNumber(expected)} XAF
                    </Text>

                    {activeTab === 'all' && c.member_name && (
                      <Text style={styles.itemBidder}>
                        Par : {c.member_name}
                      </Text>
                    )}
                  </View>

                  <View style={styles.rightCol}>
                    <Text style={styles.itemAmount}>{formatNumber(paid)} XAF</Text>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x3 },
  loader: { marginTop: spacing.x2 },

  summary: { borderRadius: radius.lg, padding: spacing.lg, ...cardShadow },
  summaryTitle: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: font.size.xl, fontWeight: font.extrabold, color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.surfaceAlt },

  tabsRow: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, marginVertical: spacing.xs },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.white, ...cardShadow },
  tabText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.medium },
  tabTextActive: { color: colors.primary, fontWeight: font.bold },

  emptyCard: { borderRadius: radius.lg, alignItems: 'center', paddingVertical: spacing.x3, gap: spacing.sm, ...cardShadow },
  empty: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },

  item: { borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemBubble: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: colors.white, 
    borderWidth: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  itemTontineName: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  itemSessionLabel: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.primary, backgroundColor: colors.greenBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  itemSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 4 },
  itemExpected: { fontSize: font.size.xs, color: colors.textLight, marginTop: 4 },
  itemBidder: { fontSize: font.size.xs, color: colors.textMuted, fontStyle: 'italic', marginTop: 4 },
  
  rightCol: { alignItems: 'flex-end', gap: 8 },
  itemAmount: { fontSize: font.size.md, fontWeight: font.bold, color: colors.textStrong },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: font.bold },
});
