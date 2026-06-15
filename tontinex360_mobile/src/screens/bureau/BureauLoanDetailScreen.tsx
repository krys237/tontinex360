import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton, OutlineButton } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import type { BureauStackParamList } from '../../navigation/types';
import { financeApi } from '../../lib/api/finance';
import { loanStatus } from '../../lib/bureau/finance-labels';
import { useApprovalAction } from '../../lib/hooks/use-approval-action';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF, formatNumber, formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauLoanDetail'>;
type Rt = RouteProp<BureauStackParamList, 'BureauLoanDetail'>;

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauLoanDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { id } = useRoute<Rt>().params;
  const qc = useQueryClient();
  const [counter, setCounter] = useState(false);
  const [amount, setAmount] = useState('');

  const q = useQuery({
    queryKey: ['bureau', 'loan', id],
    queryFn: () => financeApi.getLoan(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bureau', 'loan', id] });
    qc.invalidateQueries({ queryKey: ['bureau', 'loans'] });
  };

  const approveMut = useApprovalAction({
    onSuccess: (req) => {
      invalidate();
      Alert.alert('Demande envoyée', 'L’approbation du prêt a été soumise au bureau.', [
        { text: 'Voir', onPress: () => navigation.navigate('BureauApprovalDetail', { id: req.id }) },
        { text: 'OK' },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

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
          {l.purpose || l.reason ? <Info label="Motif" value={l.purpose || l.reason || ''} /> : null}
        </Card>

        {/* Actions (prêt en attente) */}
        {isPending ? (
          <RequirePermission anyOf={['finance.loans', 'finance.*']} president>
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
                    disabled={!Number(amount)}
                    style={styles.flex}
                  />
                </View>
              </Card>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <PrimaryButton
                  title="Approuver le prêt"
                  loading={approveMut.isPending}
                  onPress={() =>
                    approveMut.mutate({
                      action: 'loan.approve',
                      targetId: id,
                      reason: 'Approbation du prêt via l’application mobile',
                    })
                  }
                />
                <OutlineButton title="Faire une contre-offre" onPress={() => setCounter(true)} />
                <Text style={styles.hint}>
                  L’approbation nécessite la validation du président et d’un membre du bureau.
                </Text>
              </View>
            )}
          </RequirePermission>
        ) : null}
      </ScrollView>
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
});
