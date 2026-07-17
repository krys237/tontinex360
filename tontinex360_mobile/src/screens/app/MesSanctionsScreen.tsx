import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { Card, SectionHeader, IconBubble } from '../../components/ui';
import { sanctionsApi, type SanctionStatus } from '../../lib/api/sanctions';
import { useAuthStore } from '../../lib/stores/auth-store';
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

const SANCTION_STATUS: Record<SanctionStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'À payer', bg: colors.goldSoft, fg: colors.warning },
  paid: { label: 'Payée', bg: colors.greenBg, fg: colors.success },
  waived: { label: 'Annulée', bg: colors.surfaceAlt, fg: colors.textMuted },
  contested: { label: 'Contestée', bg: colors.tintBlueBg, fg: colors.info },
};

export default function MesSanctionsScreen() {
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;

  const sanctionsQ = useQuery({
    queryKey: ['sanctions', 'mine', myId ?? null],
    queryFn: () => sanctionsApi.list(myId ? { membership: myId } : undefined),
  });

  const sanctions = sanctionsQ.data ?? [];
  const pending = sanctions.filter((s) => s.status === 'pending');
  const totalToPay = pending.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={sanctionsQ.isRefetching} onRefresh={() => sanctionsQ.refetch()} tintColor={colors.primary} />
        }>
        {/* Résumé */}
        <Card style={styles.summary}>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryLabel}>Total à payer</Text>
            <Text style={styles.summaryValue}>{formatXAF(totalToPay)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{pending.length}</Text>
              <Text style={styles.summaryItemLabel}>En attente</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{sanctions.length}</Text>
              <Text style={styles.summaryItemLabel}>Au total</Text>
            </View>
          </View>
        </Card>

        {/* Mes sanctions */}
        <Card style={styles.card}>
          <SectionHeader title="Mes sanctions" />
          {sanctionsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : sanctions.length === 0 ? (
            <View style={styles.emptyBox}>
              <IconBubble icon="shield-checkmark-outline" tint="lime" size={56} />
              <Text style={styles.emptyText}>Aucune sanction. Bravo !</Text>
            </View>
          ) : (
            sanctions.map((s, i) => {
              const st = SANCTION_STATUS[s.status] ?? SANCTION_STATUS.pending;
              return (
                <View key={s.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <View style={styles.rowHead}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{s.type_name ?? 'Sanction'}</Text>
                      {s.reason ? <Text style={styles.rowSub} numberOfLines={2}>{s.reason}</Text> : null}
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={styles.rowMetaRow}>
                    <Text style={styles.amount}>{formatXAF(s.amount)}</Text>
                    {s.created_at ? <Text style={styles.rowMeta}>{dateFR(s.created_at)}</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <Text style={styles.note}>Le règlement des sanctions se fait auprès du trésorier.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.x3 },

  // Résumé
  summary: { borderRadius: radius.lg, gap: spacing.md, ...cardShadow },
  summaryMain: {},
  summaryLabel: { fontSize: font.size.xs, fontWeight: font.semibold, letterSpacing: 0.5, color: colors.textMuted },
  summaryValue: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text, letterSpacing: -0.5, marginTop: 2 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'flex-start' },
  summaryItemValue: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.primary },
  summaryItemLabel: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.surfaceAlt, marginHorizontal: 12 },

  card: { borderRadius: radius.lg, ...cardShadow },

  // Sanctions
  row: { paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  rowMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 8 },
  amount: { fontSize: font.size.md, fontWeight: font.bold, color: colors.danger },
  rowMeta: { fontSize: font.size.sm, color: colors.textMuted },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.bold },

  emptyBox: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x2 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },

  note: { fontSize: font.size.xs, color: colors.textLight, textAlign: 'center', paddingHorizontal: spacing.md },
});
