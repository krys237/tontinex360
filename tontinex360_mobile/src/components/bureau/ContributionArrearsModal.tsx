import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation } from '@tanstack/react-query';

import { TextField } from '../ui';
import ChipSelect from './ChipSelect';
import { financeApi } from '../../lib/api/finance';
import type { Contribution } from '../../lib/types/finance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF, formatDateFr } from '../../lib/utils/format';

const PAY_METHODS = [
  { key: 'cash', label: 'Espèces' },
  { key: 'mobile_money', label: 'Mobile Money' },
  { key: 'bank', label: 'Virement' },
  { key: 'other', label: 'Autre' },
];

/**
 * Régularise les impayés d'un membre pour une tontine : ventile un paiement
 * entre les retards des séances précédentes + la séance courante.
 * Utilise `arrears-preview` (aperçu) puis `pay-arrears` (POST, pas d'avance).
 */
export default function ContributionArrearsModal({
  contribution,
  onClose,
  onDone,
}: {
  contribution: Contribution;
  onClose: () => void;
  onDone: () => void;
}) {
  const params = { membership: contribution.membership, session: contribution.session, tontine_type: contribution.tontine_type };

  const previewQ = useQuery({
    queryKey: ['bureau', 'arrears-preview', params],
    queryFn: () => financeApi.arrearsPreview(params),
  });

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const totalDue = Number(previewQ.data?.total_due ?? 0);
  useEffect(() => {
    if (previewQ.data && amount === '') setAmount(String(totalDue || ''));
  }, [previewQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const mut = useMutation({
    mutationFn: () =>
      financeApi.payArrears({ ...params, amount: Number(amount), payment_method: method, notes: notes.trim() || undefined }),
    onSuccess: onDone,
    onError: (e: any) => Alert.alert('Erreur', e?.response?.data?.error ?? e?.response?.data?.detail ?? 'Régularisation impossible.'),
  });

  const notSubscribed = !!previewQ.data?.message;
  const valid = !notSubscribed && Number(amount) > 0 && Number(amount) <= totalDue;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="build-outline" size={18} color={colors.goldAccent} />
              <Text style={styles.title}>Régulariser les impayés</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>

          {previewQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : notSubscribed ? (
            <View style={styles.infoBox}><Text style={styles.infoText}>{previewQ.data?.message}</Text></View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              <Text style={styles.member}>{contribution.member_name ?? 'Membre'} · {contribution.tontine_type_name ?? contribution.tontine_type}</Text>

              {/* Ventilation */}
              <View style={styles.breakdownBox}>
                {(previewQ.data?.arrears ?? []).length > 0 ? (
                  <>
                    <Text style={styles.breakdownTitle}>Retards</Text>
                    {(previewQ.data?.arrears ?? []).map((a) => (
                      <View key={a.contribution_id} style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Séance n°{a.session_number} · {formatDateFr(a.session_date, false)}</Text>
                        <Text style={styles.breakdownOwed}>{formatXAF(a.owed)}</Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={styles.noArrears}>Aucun retard sur les séances précédentes.</Text>
                )}
                {previewQ.data?.current ? (
                  <View style={[styles.breakdownRow, styles.currentRow]}>
                    <Text style={styles.breakdownLabel}>Séance courante</Text>
                    <Text style={styles.breakdownOwed}>{formatXAF(previewQ.data.current.owed)}</Text>
                  </View>
                ) : null}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total dû</Text>
                  <Text style={styles.totalValue}>{formatXAF(totalDue)}</Text>
                </View>
              </View>

              <TextField
                label="Montant reçu (XAF) *"
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                helper={Number(amount) > totalDue ? `Pas d'avance : plafonné à ${formatXAF(totalDue)}` : 'Ventilé des retards les plus anciens vers la séance courante.'}
              />

              <View>
                <Text style={styles.fieldLabel}>Mode de paiement</Text>
                <ChipSelect options={PAY_METHODS} value={method} onChange={setMethod} />
              </View>

              <TextField label="Notes (optionnel)" value={notes} onChangeText={setNotes} placeholder="Ex : régularisation séance n°5" multiline />
            </ScrollView>
          )}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={mut.isPending}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, (!valid || mut.isPending) && styles.btnDisabled]}
              onPress={() => valid && mut.mutate()}
              disabled={!valid || mut.isPending}
            >
              {mut.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.btnPrimaryText}>Enregistrer le paiement</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: spacing.lg, gap: spacing.sm, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },

  infoBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md },
  infoText: { fontSize: font.size.sm, color: colors.textMuted },

  member: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },

  breakdownBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 6 },
  breakdownTitle: { fontSize: 10, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.3 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: font.size.sm, color: colors.textMuted },
  breakdownOwed: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.danger },
  noArrears: { fontSize: font.size.sm, color: colors.success },
  currentRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 2, borderTopColor: colors.border, paddingTop: 6, marginTop: 2 },
  totalLabel: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  totalValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },

  fieldLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text, marginBottom: 6 },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  btnCancelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  btnDisabled: { opacity: 0.5 },
});
