import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';

import { Card } from '../../components/ui';
import { cyclesApi } from '../../lib/api/cycles';
import { useAuthStore } from '../../lib/stores/auth-store';
import { usePermissions } from '../../lib/hooks/use-permissions';
import type { AuctionBidStatus } from '../../lib/types/cycle';
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

const STATUS: Record<AuctionBidStatus, { label: string; bg: string; fg: string; icon: string }> = {
  active: { label: 'En cours', bg: colors.tintBlueBg, fg: colors.info, icon: 'time-outline' },
  won: { label: 'Remportée', bg: colors.greenBg, fg: colors.primary, icon: 'trophy-outline' },
  lost: { label: 'Perdue', bg: colors.surfaceAlt, fg: colors.textMuted, icon: 'close-circle-outline' },
  cancelled: { label: 'Annulée', bg: colors.surfaceAlt, fg: colors.textMuted, icon: 'ban-outline' },
};

export default function MesEncheresScreen() {
  const insets = useSafeAreaInsets();
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;
  const { isBureau } = usePermissions();
  const [activeTab, setActiveTab] = useState<'mine' | 'all'>('mine');

  const bidsQ = useQuery({ queryKey: ['cycle', 'bids'], queryFn: () => cyclesApi.bids() });
  const potsQ = useQuery({ queryKey: ['cycle', 'pots'], queryFn: () => cyclesApi.pots() });
  const sessionsQ = useQuery({ queryKey: ['cycle', 'sessions'], queryFn: () => cyclesApi.sessions() });

  const potsMap = React.useMemo(() => {
    const map = new Map<string, any>();
    (potsQ.data ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [potsQ.data]);

  const sessionsMap = React.useMemo(() => {
    const map = new Map<string, any>();
    (sessionsQ.data ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [sessionsQ.data]);

  const myBids = (bidsQ.data ?? []).filter((b) => b.membership === myId);
  const myWonCount = myBids.filter((b) => b.status === 'won').length;
  const myTotalPremium = myBids.filter((b) => b.status === 'won').reduce((sum, b) => sum + (Number(b.bid_amount) || 0), 0);

  const activeBids = activeTab === 'mine' ? myBids : (bidsQ.data ?? []);
  
  const loading = bidsQ.isLoading || potsQ.isLoading || sessionsQ.isLoading;
  const refreshing = bidsQ.isRefetching || potsQ.isRefetching || sessionsQ.isRefetching;

  const onRefresh = () => {
    bidsQ.refetch();
    potsQ.refetch();
    sessionsQ.refetch();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.x3 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        
        {/* Stats Summary Header */}
        <Card style={styles.summary}>
          <Text style={styles.summaryTitle}>Mon bilan des enchères</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{myBids.length}</Text>
              <Text style={styles.statLabel}>Placées</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.primary }]}>{myWonCount}</Text>
              <Text style={styles.statLabel}>Remportées</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.primary }]}>{formatNumber(myTotalPremium)}</Text>
              <Text style={styles.statLabel}>Premium (XAF)</Text>
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
                Mes participations
              </Text>
            </Pressable>
            
            <Pressable
              onPress={() => setActiveTab('all')}
              style={[styles.tabBtn, activeTab === 'all' && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                Toutes les enchères
              </Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : activeBids.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="hammer-outline" size={28} color={colors.textLight} />
            <Text style={styles.empty}>Aucune enchère enregistrée.</Text>
          </Card>
        ) : (
          activeBids.map((b) => {
            const st = STATUS[b.status] ?? STATUS.active;
            const pot = potsMap.get(b.pot);
            const session = pot ? sessionsMap.get(pot.session) : null;
            
            const tontineName = pot ? pot.tontine_name : 'Tontine';
            const sessionLabel = session ? `Séance N°${session.session_number}` : 'Séance';
            const dateLabel = session ? dateFR(session.date) : dateFR(b.created_at);
            const sharesLabel = b.shares_requested ? `${b.shares_requested} nom(s)` : '1 nom';
            const lotAmount = b.target_lot ? Number(b.target_lot) : 0;

            return (
              <Card key={b.id} style={styles.item}>
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
                      {dateLabel} · {sharesLabel}
                    </Text>
                    
                    {lotAmount > 0 && (
                      <Text style={styles.itemLotVal}>
                        Valeur du lot : {formatNumber(lotAmount)} XAF
                      </Text>
                    )}

                    {activeTab === 'all' && b.member_name && (
                      <Text style={styles.itemBidder}>
                        Par : {b.member_name}
                      </Text>
                    )}
                  </View>

                  <View style={styles.rightCol}>
                    <Text style={styles.itemAmount}>{formatNumber(b.bid_amount)} XAF</Text>
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
  itemLotVal: { fontSize: font.size.xs, color: colors.primary, fontWeight: font.medium, marginTop: 4 },
  itemBidder: { fontSize: font.size.xs, color: colors.textMuted, fontStyle: 'italic', marginTop: 4 },
  
  rightCol: { alignItems: 'flex-end', gap: 8 },
  itemAmount: { fontSize: font.size.md, fontWeight: font.bold, color: colors.textStrong },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: font.bold },
});
