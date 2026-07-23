import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from '@tanstack/react-query';

import { TextField } from '../ui';
import { financeApi } from '../../lib/api/finance';
import type { Loan } from '../../lib/types/finance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF } from '../../lib/utils/format';

export type LoanDecisionMode = 'approve' | 'reject';

/**
 * Décision directe du bureau sur une demande de prêt (sans double-validation) :
 * - approve : choix du fonds source puis POST /finance/loans/{id}/approve/ —
 *   le prêt est décaissé immédiatement. Fonds précis = solde suffisant exigé
 *   (garde côté serveur) ; trésorerie générale = découvert autorisé.
 * - reject : POST /finance/loans/{id}/reject/ (pending, contre-offre ou
 *   attente garants) → statut annulé, le membre est notifié.
 */
export default function LoanDecisionModal({
  loan,
  mode,
  onClose,
  onDone,
}: {
  loan: Loan;
  mode: LoanDecisionMode;
  onClose: () => void;
  onDone: (updated: Loan) => void;
}) {
  const amount = Number(loan.amount) || 0;
  const [sourceFund, setSourceFund] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const fundsQ = useQuery({
    queryKey: ['bureau', 'tontine-balances'],
    queryFn: () => financeApi.tontineBalances(),
    enabled: mode === 'approve',
  });

  const mut = useMutation({
    mutationFn: () =>
      mode === 'approve'
        ? financeApi.approveLoan(loan.id, { source_fund: sourceFund })
        : financeApi.rejectLoan(loan.id, reason.trim() || undefined),
    onSuccess: (updated) => onDone(updated),
    onError: (e: any) =>
      Alert.alert('Erreur', e?.response?.data?.error ?? e?.response?.data?.detail ?? 'Action impossible pour le moment.'),
  });

  const funds = fundsQ.data?.funds ?? [];
  const approve = mode === 'approve';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons
                name={approve ? 'checkmark-circle-outline' : 'close-circle-outline'}
                size={18}
                color={approve ? colors.primary : colors.danger}
              />
              <Text style={styles.title}>{approve ? 'Approuver et décaisser' : 'Refuser le prêt'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.recapBox}>
            <Text style={styles.recapMember}>{loan.member_name ?? 'Membre'}</Text>
            <Text style={styles.recapLine}>
              {formatXAF(amount)} · taux {Number(loan.interest_rate)} % · total dû {formatXAF(loan.total_due)}
            </Text>
          </View>

          {approve ? (
            <>
              <Text style={styles.fieldLabel}>Fonds source du décaissement</Text>
              {fundsQ.isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <ScrollView style={styles.fundList} contentContainerStyle={{ gap: 8 }}>
                  <FundOption
                    selected={sourceFund === null}
                    onPress={() => setSourceFund(null)}
                    name="Trésorerie générale"
                    sub="Non affecté · découvert autorisé"
                  />
                  {funds.map((f) => {
                    const balance = Number(f.balance) || 0;
                    const insufficient = balance < amount;
                    return (
                      <FundOption
                        key={f.tontine_type_id}
                        selected={sourceFund === f.tontine_type_id}
                        onPress={() => !insufficient && setSourceFund(f.tontine_type_id)}
                        name={f.name}
                        sub={`Solde : ${formatXAF(balance)}${insufficient ? ' · insuffisant' : ''}`}
                        disabled={insufficient}
                      />
                    );
                  })}
                </ScrollView>
              )}
              <Text style={styles.hint}>
                Le prêt est décaissé immédiatement ; les remboursements et intérêts seront rattachés au
                fonds choisi.
              </Text>
            </>
          ) : (
            <TextField
              label="Motif du refus (optionnel)"
              value={reason}
              onChangeText={setReason}
              placeholder="Ex : capacité de prêt insuffisante ce mois-ci"
              multiline
            />
          )}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={mut.isPending}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, approve ? styles.btnPrimary : styles.btnDanger, mut.isPending && styles.btnDisabled]}
              onPress={() => mut.mutate()}
              disabled={mut.isPending}
            >
              {mut.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.btnPrimaryText}>{approve ? 'Décaisser' : 'Refuser'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FundOption({
  selected,
  onPress,
  name,
  sub,
  disabled,
}: {
  selected: boolean;
  onPress: () => void;
  name: string;
  sub: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.fundRow, selected && styles.fundRowOn, disabled && styles.fundRowOff]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={disabled ? colors.textLight : selected ? colors.primary : colors.textMuted}
      />
      <View style={styles.flex}>
        <Text style={[styles.fundName, disabled && { color: colors.textLight }]}>{name}</Text>
        <Text style={styles.fundSub}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: spacing.lg, gap: spacing.sm, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },

  recapBox: { backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: spacing.md, gap: 2, borderWidth: 1, borderColor: colors.gold.beige },
  recapMember: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  recapLine: { fontSize: font.size.sm, color: colors.textMuted },

  fieldLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  fundList: { maxHeight: 260 },
  fundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  fundRowOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  fundRowOff: { opacity: 0.55 },
  fundName: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  fundSub: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  hint: { fontSize: font.size.xs, color: colors.textLight },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  btnCancelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnPrimaryText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  btnDisabled: { opacity: 0.5 },
});
