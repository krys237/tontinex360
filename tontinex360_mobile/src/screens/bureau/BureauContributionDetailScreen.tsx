import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { Card, TextField, PrimaryButton, OutlineButton } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import SignatureModal from '../../components/bureau/SignatureModal';
import ContributionCorrectionModal from '../../components/bureau/ContributionCorrectionModal';
import ContributionTopUpModal from '../../components/bureau/ContributionTopUpModal';
import ContributionArrearsModal from '../../components/bureau/ContributionArrearsModal';
import type { BureauStackParamList } from '../../navigation/types';
import { financeApi } from '../../lib/api/finance';
import { membersApi } from '../../lib/api/members';
import { contributionStatus } from '../../lib/bureau/finance-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF, formatDateFr } from '../../lib/utils/format';

type Rt = RouteProp<BureauStackParamList, 'BureauContributionDetail'>;
const PENDING = ['pending', 'submitted', 'partial'];

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauContributionDetailScreen() {
  const { id } = useRoute<Rt>().params;
  const qc = useQueryClient();
  const [mode, setMode] = useState<null | 'reject'>(null);
  const [reason, setReason] = useState('');
  const [showCorrect, setShowCorrect] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showArrears, setShowArrears] = useState(false);
  const [signing, setSigning] = useState(false);
  const [refSigUrl, setRefSigUrl] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['bureau', 'contribution', id],
    queryFn: () => financeApi.getContribution(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bureau', 'contribution', id] });
    qc.invalidateQueries({ queryKey: ['bureau', 'contributions'] });
  };

  const validateMut = useMutation({
    mutationFn: () => financeApi.validateContribution(id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const rejectMut = useMutation({
    mutationFn: () => financeApi.rejectContribution(id, reason.trim()),
    onSuccess: () => {
      setMode(null);
      setReason('');
      invalidate();
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const openSigning = async (membership: string) => {
    setSigning(true);
    setRefSigUrl(null);
    try {
      const m = await membersApi.get(membership);
      setRefSigUrl(m.signature_reference ?? null);
    } catch {
      setRefSigUrl(null);
    }
  };

  if (q.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }
  const c = q.data;
  if (!c) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.muted}>Cotisation introuvable.</Text>
      </SafeAreaView>
    );
  }

  const st = contributionStatus(c.status);
  const canValidate = PENDING.includes(c.status);
  const canSign = (c.status === 'paid' || c.status === 'partial') && !c.has_receipt;
  const canCorrect = !c.has_receipt && !c.has_pending_correction;
  const canTopUp = Number(c.paid_amount) < Number(c.expected_amount) && !['rejected', 'submitted'].includes(c.status);
  const canRegularize = c.status === 'defaulted' || c.status === 'partial';
  const hasPdf = !!(c.has_receipt && c.receipt_pdf);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.headCard}>
          <Text style={styles.amount}>{formatXAF(c.paid_amount || c.expected_amount)}</Text>
          <Text style={styles.member}>{c.member_name ?? 'Membre'}</Text>
          <View style={{ marginTop: 8 }}>
            <StatusChip label={st.label} tone={st.tone} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Info label="Montant attendu" value={formatXAF(c.expected_amount)} />
          <Info label="Montant payé" value={formatXAF(c.paid_amount)} />
          {c.tontine_type_name ? <Info label="Tontine" value={c.tontine_type_name} /> : null}
          {c.payment_method ? <Info label="Méthode" value={c.payment_method} /> : null}
          {c.paid_at ? <Info label="Payée le" value={formatDateFr(c.paid_at)} /> : null}
          {c.has_pending_correction ? <Info label="Correction" value="En attente de validation" /> : null}
        </Card>

        {/* Actions */}
        <RequirePermission bureau>
          {mode === 'reject' ? (
            <Card style={styles.card}>
              <TextField label="Motif du rejet" value={reason} onChangeText={setReason} placeholder="Raison…" multiline />
              <View style={styles.actionRow}>
                <OutlineButton title="Annuler" onPress={() => setMode(null)} style={styles.flex} />
                <PrimaryButton
                  title="Rejeter"
                  onPress={() => rejectMut.mutate()}
                  loading={rejectMut.isPending}
                  disabled={reason.trim().length < 3}
                  style={styles.flex}
                />
              </View>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {canValidate ? (
                <>
                  <PrimaryButton title="Valider la cotisation" onPress={() => validateMut.mutate()} loading={validateMut.isPending} />
                  <OutlineButton title="Rejeter" onPress={() => setMode('reject')} />
                </>
              ) : null}
              {canTopUp ? <PrimaryButton title="Compléter la cotisation" onPress={() => setShowTopUp(true)} /> : null}
              {canRegularize ? <OutlineButton title="Régulariser les impayés" onPress={() => setShowArrears(true)} /> : null}
              {canSign ? <PrimaryButton title="Signer le bordereau" onPress={() => openSigning(c.membership)} /> : null}
              {hasPdf ? <OutlineButton title="Télécharger le PDF" onPress={() => Linking.openURL(c.receipt_pdf as string)} /> : null}
              {canCorrect ? <OutlineButton title="Demander une correction" onPress={() => setShowCorrect(true)} /> : null}
              {c.has_pending_correction ? <Text style={styles.pendingNote}>Une demande de correction est en attente de validation.</Text> : null}
            </View>
          )}
        </RequirePermission>
      </ScrollView>

      {showCorrect ? (
        <ContributionCorrectionModal
          contribution={c}
          onClose={() => setShowCorrect(false)}
          onSubmitted={() => { setShowCorrect(false); invalidate(); }}
        />
      ) : null}

      {showTopUp ? (
        <ContributionTopUpModal
          contribution={c}
          onClose={() => setShowTopUp(false)}
          onDone={() => { setShowTopUp(false); invalidate(); }}
        />
      ) : null}

      {showArrears ? (
        <ContributionArrearsModal
          contribution={c}
          onClose={() => setShowArrears(false)}
          onDone={() => { setShowArrears(false); invalidate(); }}
        />
      ) : null}

      {signing ? (
        <SignatureModal
          visible
          subject={{
            title: 'Bordereau de cotisation',
            memberName: c.member_name ?? 'Membre',
            amount: formatXAF(c.paid_amount || c.expected_amount),
            contextLine: `Cotisation · ${c.tontine_type_name ?? c.tontine_type}`,
          }}
          referenceSignatureUrl={refSigUrl}
          signFn={(signature, deviceInfo) => financeApi.signContributionReceipt(id, signature, deviceInfo)}
          onClose={() => { setSigning(false); setRefSigUrl(null); }}
          onSigned={invalidate}
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
  pendingNote: { fontSize: font.size.xs, color: colors.goldAccent, textAlign: 'center', marginTop: 2 },
});
