import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';

import { TextField } from '../ui';
import ChipSelect from './ChipSelect';
import { financeApi } from '../../lib/api/finance';
import type { Contribution } from '../../lib/types/finance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF } from '../../lib/utils/format';

const PAY_METHODS = [
  { key: 'cash', label: 'Espèces' },
  { key: 'mobile_money', label: 'Mobile Money' },
  { key: 'bank', label: 'Virement' },
  { key: 'other', label: 'Autre' },
];

/**
 * Compléter une cotisation (top-up) — ajout d'un paiement sans approbation,
 * plafonné au montant attendu. Ne concerne pas les cotisations REJECTED/SUBMITTED.
 */
export default function ContributionTopUpModal({
  contribution,
  onClose,
  onDone,
}: {
  contribution: Contribution;
  onClose: () => void;
  onDone: () => void;
}) {
  const expected = Number(contribution.expected_amount ?? 0);
  const paid = Number(contribution.paid_amount ?? 0);
  const remaining = Math.max(0, expected - paid);

  const [amount, setAmount] = useState(String(remaining || ''));
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const add = Math.min(Number(amount) || 0, remaining);
  const newPaid = paid + add;
  const willComplete = newPaid >= expected;

  const mut = useMutation({
    mutationFn: () =>
      financeApi.topUpContribution(contribution.id, {
        amount: Number(amount),
        payment_method: method,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      onDone();
    },
    onError: (e: any) => Alert.alert('Erreur', e?.response?.data?.error ?? e?.response?.data?.detail ?? 'Complément impossible.'),
  });

  const valid = Number(amount) > 0 && Number(amount) <= remaining;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.title}>Compléter la cotisation</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>

          {/* Récap membre */}
          <View style={styles.recapBox}>
            <Text style={styles.recapMember}>{contribution.member_name ?? 'Membre'}</Text>
            <View style={styles.recapRow}>
              <Recap label="Attendu" value={formatXAF(expected)} />
              <Recap label="Déjà payé" value={formatXAF(paid)} tone={colors.success} />
              <Recap label="Reste" value={formatXAF(remaining)} tone={colors.danger} />
            </View>
          </View>

          <TextField
            label="Montant à ajouter (XAF) *"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
            helper={Number(amount) > remaining ? `Plafonné au reste dû (${formatXAF(remaining)})` : undefined}
          />

          <View>
            <Text style={styles.fieldLabel}>Mode de paiement</Text>
            <ChipSelect options={PAY_METHODS} value={method} onChange={setMethod} />
          </View>

          <TextField
            label="Notes (optionnel)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex : reçu lors de la séance n°5"
            multiline
          />

          {add > 0 ? (
            <View style={[styles.previewBox, willComplete ? styles.previewOk : styles.previewPartial]}>
              <Text style={[styles.previewText, { color: willComplete ? colors.primary : '#92702A' }]}>
                Après ce complément : <Text style={styles.bold}>{formatXAF(newPaid)} / {formatXAF(expected)}</Text>
                {willComplete ? ' ✓ cotisation complète (PAYÉE)' : ' · cotisation partielle'}
              </Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={mut.isPending}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, (!valid || mut.isPending) && styles.btnDisabled]}
              onPress={() => valid && mut.mutate()}
              disabled={!valid || mut.isPending}
            >
              {mut.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.btnPrimaryText}>Enregistrer le complément</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Recap({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.recapCell}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={[styles.recapValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: spacing.lg, gap: spacing.sm, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  bold: { fontWeight: font.bold },

  recapBox: { backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.gold.beige },
  recapMember: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  recapRow: { flexDirection: 'row', gap: spacing.sm },
  recapCell: { flex: 1 },
  recapLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  recapValue: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text, marginTop: 1 },

  fieldLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text, marginBottom: 6 },

  previewBox: { borderRadius: radius.md, padding: spacing.md, borderWidth: 1 },
  previewOk: { backgroundColor: colors.greenBg, borderColor: colors.greenBgDeep },
  previewPartial: { backgroundColor: colors.goldSoft, borderColor: colors.gold.beige },
  previewText: { fontSize: font.size.sm },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  btnCancelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  btnDisabled: { opacity: 0.5 },
});
