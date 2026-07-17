import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card, SectionHeader } from '../../components/ui';
import LoanRequestModal from '../../components/finance/LoanRequestModal';
import { financeApi } from '../../lib/api/finance';
import { useAuthStore } from '../../lib/stores/auth-store';
import type { LoanStatus } from '../../lib/types/finance';
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

const LOAN_STATUS: Record<LoanStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'En attente', bg: colors.goldSoft, fg: colors.goldAccent },
  approved: { label: 'Approuvé', bg: colors.greenBg, fg: colors.primary },
  disbursed: { label: 'Décaissé', bg: colors.tintBlueBg, fg: colors.info },
  repaying: { label: 'En remboursement', bg: colors.tintBlueBg, fg: colors.info },
  repaid: { label: 'Remboursé', bg: colors.greenBg, fg: colors.success },
  defaulted: { label: 'En défaut', bg: colors.dangerSoft, fg: colors.danger },
};

export default function MesPretsScreen() {
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;
  const [loanOpen, setLoanOpen] = useState(false);

  const loansQ = useQuery({
    queryKey: ['loans', 'mine', myId ?? null],
    queryFn: () => financeApi.loans(myId ? { membership: myId } : undefined),
  });

  const loans = loansQ.data ?? [];
  const totalBorrowed = loans.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  const totalRemaining = loans.reduce(
    (acc, l) => acc + (Number(l.remaining ?? (Number(l.total_due) - Number(l.total_repaid))) || 0),
    0,
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loansQ.isRefetching} onRefresh={() => loansQ.refetch()} tintColor={colors.primary} />
        }>
        {/* Résumé */}
        <Card style={styles.summary}>
          <View style={styles.summaryMain}>
            <Text style={styles.summaryLabel}>Total emprunté</Text>
            <Text style={styles.summaryValue}>{formatXAF(totalBorrowed)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{loans.length}</Text>
              <Text style={styles.summaryItemLabel}>Prêt{loans.length > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemValue}>{formatNumber(totalRemaining)}</Text>
              <Text style={styles.summaryItemLabel}>Restant (FCFA)</Text>
            </View>
          </View>
        </Card>

        {/* Demander un prêt */}
        <Pressable
          onPress={() => setLoanOpen(true)}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Ionicons name="cash-outline" size={20} color={colors.white} />
          <Text style={styles.ctaText}>Demander un prêt</Text>
        </Pressable>

        {/* Mes prêts */}
        <Card style={styles.card}>
          <SectionHeader title="Mes prêts" />
          {loansQ.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : loans.length === 0 ? (
            <Text style={styles.empty}>Aucun prêt pour le moment.</Text>
          ) : (
            loans.map((l, i) => {
              const st = LOAN_STATUS[l.status as keyof typeof LOAN_STATUS] ?? LOAN_STATUS.pending;
              const remaining = Number(l.remaining ?? (Number(l.total_due) - Number(l.total_repaid))) || 0;
              return (
                <View key={l.id} style={[styles.loanRow, i > 0 && styles.loanDivider]}>
                  <View style={styles.loanHead}>
                    <View style={styles.flex}>
                      <Text style={styles.loanAmount}>{formatXAF(l.amount)}</Text>
                      <Text style={styles.loanSub} numberOfLines={1}>
                        {l.purpose?.trim() ? l.purpose : `Intérêt ${formatNumber(l.interest_rate)} %`}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={styles.loanMetaRow}>
                    <Text style={styles.loanMeta}>
                      Restant : <Text style={styles.loanMetaStrong}>{formatXAF(remaining)}</Text>
                    </Text>
                    {l.due_date ? <Text style={styles.loanMeta}>Échéance : {dateFR(l.due_date)}</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      <LoanRequestModal
        visible={loanOpen}
        onClose={() => setLoanOpen(false)}
        membershipId={myId}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['loans'] });
          qc.invalidateQueries({ queryKey: ['wallet', 'me'] });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.x3 },
  pressed: { opacity: 0.85 },

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

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.green[600],
    borderRadius: radius.pill,
    minHeight: 52,
  },
  ctaText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.base },

  card: { borderRadius: radius.lg, ...cardShadow },

  // Loans
  loanRow: { paddingVertical: 12 },
  loanDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  loanHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  loanAmount: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  loanSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  loanMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  loanMeta: { fontSize: font.size.sm, color: colors.textMuted },
  loanMetaStrong: { color: colors.primary, fontWeight: font.semibold },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: font.size.xs, fontWeight: font.bold },

  empty: { fontSize: font.size.sm, color: colors.textMuted },
});
