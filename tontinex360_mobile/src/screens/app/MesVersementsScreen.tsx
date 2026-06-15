import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Card } from '../../components/ui';
import { financeApi } from '../../lib/api/finance';
import { useAuthStore } from '../../lib/stores/auth-store';
import type { Contribution } from '../../lib/types/finance';
import { formatNumber, formatXAF } from '../../lib/utils/format';
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

type CStatus = Contribution['status'];
const STATUS: Record<CStatus, { label: string; bg: string; fg: string }> = {
  paid: { label: 'Payée', bg: colors.greenBg, fg: colors.primary },
  partial: { label: 'Partielle', bg: colors.goldSoft, fg: colors.goldAccent },
  pending: { label: 'En attente', bg: colors.surfaceAlt, fg: colors.textMuted },
  submitted: { label: 'À valider', bg: colors.goldSoft, fg: colors.goldAccent },
  rejected: { label: 'Rejetée', bg: colors.dangerSoft, fg: colors.danger },
  defaulted: { label: 'Impayée', bg: colors.dangerSoft, fg: colors.danger },
};

export default function MesVersementsScreen() {
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;

  const contribQ = useQuery({
    queryKey: ['contributions', 'mine', myId ?? null],
    queryFn: () => financeApi.contributions(myId ? { membership: myId } : undefined),
  });

  const contributions = contribQ.data ?? [];
  const totalVerse = contributions.reduce((s, c) => s + (Number(c.paid_amount) || 0), 0);
  const paidCount = contributions.filter((c) => c.status === 'paid').length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={contribQ.isRefetching} onRefresh={() => contribQ.refetch()} tintColor={colors.primary} />}>
        {/* Summary */}
        <Card style={styles.summary}>
          <Text style={styles.summaryLabel}>TOTAL VERSÉ</Text>
          <Text style={styles.summaryValue}>
            {formatNumber(totalVerse)} <Text style={styles.summaryCurrency}>FCFA</Text>
          </Text>
          <Text style={styles.summarySub}>
            {paidCount} cotisation{paidCount > 1 ? 's' : ''} payée{paidCount > 1 ? 's' : ''} sur {contributions.length}
          </Text>
        </Card>

        {contribQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : contributions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.empty}>Aucun versement enregistré.</Text>
          </Card>
        ) : (
          contributions.map((c) => {
            const st = STATUS[c.status] ?? STATUS.pending;
            const expected = Number(c.expected_amount) || 0;
            const paid = Number(c.paid_amount) || 0;
            return (
              <Card key={c.id} style={styles.item}>
                <View style={styles.itemHead}>
                  <View style={styles.flex}>
                    <Text style={styles.itemAmount}>{formatXAF(paid)}</Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      Attendu : {formatXAF(expected)}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                  </View>
                </View>
                {c.paid_at ? <Text style={styles.itemDate}>Payée le {dateFR(c.paid_at)}</Text> : null}
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
  summaryCurrency: { fontSize: font.size.lg },
  summarySub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 4 },

  emptyCard: { borderRadius: radius.card, alignItems: 'center', paddingVertical: spacing.x2 },
  empty: { fontSize: font.size.sm, color: colors.textMuted },

  item: { borderRadius: radius.card, padding: spacing.lg },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemAmount: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  itemSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  itemDate: { fontSize: font.size.xs, color: colors.textLight, marginTop: 8 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.bold },
});
