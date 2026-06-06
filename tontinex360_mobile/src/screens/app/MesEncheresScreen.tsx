import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';

import { Card } from '../../components/ui';
import { cyclesApi } from '../../lib/api/cycles';
import { useAuthStore } from '../../lib/stores/auth-store';
import type { AuctionBidStatus } from '../../lib/types/cycle';
import { formatXAF } from '../../lib/utils/format';
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

const STATUS: Record<AuctionBidStatus, { label: string; bg: string; fg: string }> = {
  active: { label: 'En cours', bg: colors.tintBlueBg, fg: colors.info },
  won: { label: 'Remportée', bg: colors.greenBg, fg: colors.primary },
  lost: { label: 'Perdue', bg: colors.surfaceAlt, fg: colors.textMuted },
  cancelled: { label: 'Annulée', bg: colors.surfaceAlt, fg: colors.textMuted },
};

export default function MesEncheresScreen() {
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;

  const bidsQ = useQuery({ queryKey: ['cycle', 'bids'], queryFn: () => cyclesApi.bids() });

  const bids = (bidsQ.data ?? []).filter((b) => b.membership === myId);
  const wonCount = bids.filter((b) => b.status === 'won').length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={bidsQ.isRefetching} onRefresh={() => bidsQ.refetch()} tintColor={colors.primary} />}>
        {/* Summary */}
        <Card style={styles.summary}>
          <Text style={styles.summaryLabel}>MES ENCHÈRES</Text>
          <Text style={styles.summaryValue}>{bids.length}</Text>
          <Text style={styles.summarySub}>
            {wonCount} remportée{wonCount > 1 ? 's' : ''}
          </Text>
        </Card>

        {bidsQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : bids.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="hammer-outline" size={28} color={colors.textLight} />
            <Text style={styles.empty}>Vous n'avez participé à aucune enchère.</Text>
          </Card>
        ) : (
          bids.map((b) => {
            const st = STATUS[b.status] ?? STATUS.active;
            return (
              <Card key={b.id} style={styles.item}>
                <View style={styles.itemHead}>
                  <View style={styles.itemBubble}>
                    <Ionicons name="hammer" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.itemAmount}>{formatXAF(b.bid_amount)}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      Enchère du {dateFR(b.created_at)}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
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

  summary: { borderRadius: radius.card, padding: spacing.xl, ...cardShadow },
  summaryLabel: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.textMuted, letterSpacing: 0.6 },
  summaryValue: { fontSize: font.size.x3, fontWeight: font.extrabold, color: colors.primary, marginTop: 4, letterSpacing: -0.5 },
  summarySub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 4 },

  emptyCard: { borderRadius: radius.card, alignItems: 'center', paddingVertical: spacing.x2, gap: spacing.sm },
  empty: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },

  item: { borderRadius: radius.card, padding: spacing.lg },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemBubble: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  itemAmount: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  itemSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.bold },
});
