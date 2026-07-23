import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { Card, TextField, PrimaryButton, OutlineButton } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import LoanDecisionModal, { type LoanDecisionMode } from '../../components/bureau/LoanDecisionModal';
import type { BureauStackParamList } from '../../navigation/types';
import { financeApi } from '../../lib/api/finance';
import { loanStatus } from '../../lib/bureau/finance-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF, formatNumber, formatDateFr } from '../../lib/utils/format';

type Rt = RouteProp<BureauStackParamList, 'BureauLoanDetail'>;

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauLoanDetailScreen() {
  const { id } = useRoute<Rt>().params;
  const qc = useQueryClient();
  const [counter, setCounter] = useState(false);
  const [amount, setAmount] = useState('');
  const [decision, setDecision] = useState<LoanDecisionMode | null>(null);

  const q = useQuery({
    queryKey: ['bureau', 'loan', id],
    queryFn: () => financeApi.getLoan(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bureau', 'loan', id] });
    qc.invalidateQueries({ queryKey: ['bureau', 'loans'] });
  };

  const counterMut = useMutation({
    mutationFn: () => financeApi.counterOfferLoan(id, Number(amount)),
    onSuccess: () => {
      setCounter(false);
      setAmount('');
      invalidate();
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  if (q.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }
  const l = q.data;
  if (!l) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.muted}>Prêt introuvable.</Text>
      </SafeAreaView>
    );
  }

  const st = loanStatus(l.status);
  const remaining = Number(l.remaining ?? Number(l.total_due) - Number(l.total_repaid)) || 0;
  const isPending = l.status === 'pending';
  // Le refus reste possible tant que le prêt n'est pas décaissé (mêmes règles que le serveur).
  const canDecide = ['pending', 'counter_offered', 'awaiting_guarantors'].includes(String(l.status));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.headCard}>
          <Text style={styles.amount}>{formatXAF(l.amount)}</Text>
          <Text style={styles.member}>{l.member_name ?? 'Membre'}</Text>
          <View style={{ marginTop: 8 }}>
            <StatusChip label={st.label} tone={st.tone} />
          </View>
        </Card>

        <Card style={styles.card}>
          {l.approved_amount != null ? <Info label="Montant approuvé" value={formatXAF(l.approved_amount)} /> : null}
          <Info label="Intérêt" value={`${formatNumber(l.interest_rate)} %`} />
          <Info label="Total dû" value={formatXAF(l.total_due)} />
          <Info label="Remboursé" value={formatXAF(l.total_repaid)} />
          <Info label="Restant" value={formatXAF(remaining)} />
          {l.due_date ? <Info label="Échéance" value={formatDateFr(l.due_date, false)} /> : null}
          {l.source_fund || l.source_fund_name ? (
            <Info label="Fonds source" value={l.source_fund_name ?? 'Fonds'} />
          ) : null}
          {l.purpose || l.reason ? <Info label="Motif" value={l.purpose || l.reason || ''} /> : null}
        </Card>

        {/* Contre-offre en attente de la réponse du membre */}
        {l.status === 'counter_offered' ? (
          <Card style={styles.card}>
            <Text style={styles.counterTitle}>Contre-offre envoyée</Text>
            <Text style={styles.counterText}>
              {formatXAF(l.approved_amount ?? 0)} proposé au membre
              {l.counter_offer_note ? ` — « ${l.counter_offer_note} »` : ''}. En attente de sa réponse.
            </Text>
          </Card>
        ) : null}

        {/* Actions bureau : décision directe (approbation = décaissement immédiat) */}
        {canDecide ? (
          <RequirePermission bureau>
            {counter ? (
              <Card style={styles.card}>
                <TextField
                  label="Montant approuvé (contre-offre)"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Ex : 100000"
                  keyboardType="numeric"
                />
                <View style={styles.actionRow}>
                  <OutlineButton title="Annuler" onPress={() => setCounter(false)} style={styles.flex} />
                  <PrimaryButton
                    title="Proposer"
                    onPress={() => counterMut.mutate()}
                    loading={counterMut.isPending}
                    disabled={!Number(amount) || Number(amount) >= Number(l.amount)}
                    style={styles.flex}
                  />
                </View>
              </Card>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {isPending ? (
                  <>
                    <PrimaryButton title="Approuver et décaisser" onPress={() => setDecision('approve')} />
                    <OutlineButton title="Faire une contre-offre" onPress={() => setCounter(true)} />
                  </>
                ) : null}
                <OutlineButton title="Refuser le prêt" onPress={() => setDecision('reject')} />
                {isPending ? (
                  <Text style={styles.hint}>
                    L’approbation décaisse immédiatement le prêt depuis le fonds que vous choisirez.
                  </Text>
                ) : null}
              </View>
            )}
          </RequirePermission>
        ) : null}
      </ScrollView>

      {decision ? (
        <LoanDecisionModal
          loan={l}
          mode={decision}
          onClose={() => setDecision(null)}
          onDone={(updated) => {
            setDecision(null);
            invalidate();
            Alert.alert(
              decision === 'approve' ? 'Prêt décaissé' : 'Prêt refusé',
              decision === 'approve'
                ? `${formatXAF(updated.amount)} décaissé${updated.source_fund_name ? ` depuis « ${updated.source_fund_name} »` : ' depuis la trésorerie générale'}. Le membre est notifié.`
                : 'La demande a été annulée. Le membre est notifié.',
            );
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  muted: { textAlign: 'center', marginTop: spacing.x4, color: colors.textMuted },
  headCard: { alignItems: 'center', gap: 2 },
  amount: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.primary },
  member: { fontSize: font.size.sm, color: colors.textMuted },
  card: { borderRadius: radius.lg, gap: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoLabel: { fontSize: font.size.sm, color: colors.textMuted },
  infoValue: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  hint: { fontSize: font.size.xs, color: colors.textMuted, textAlign: 'center' },
  counterTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  counterText: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 },
});
