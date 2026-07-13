import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';

import { TextField } from '../ui';
import { financeApi } from '../../lib/api/finance';
import type { Contribution } from '../../lib/types/finance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF, formatXAFSigned } from '../../lib/utils/format';

/**
 * Demande de correction d'une cotisation déjà comptabilisée.
 * → soumise à double validation (Président + 1 membre du bureau), délai 24h.
 */
export default function ContributionCorrectionModal({
  contribution,
  onClose,
  onSubmitted,
}: {
  contribution: Contribution;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const currentPaid = Number(contribution.paid_amount ?? 0);
  const newPaid = Number(amount) || 0;
  const diff = newPaid - currentPaid;

  const mut = useMutation({
    mutationFn: () => financeApi.requestContributionCorrection(contribution.id, newPaid, reason.trim()),
    onSuccess: () => {
      onSubmitted();
      Alert.alert('Demande envoyée', 'La correction sera appliquée dès que les 2 approbations du bureau seront réunies.');
    },
    onError: (e: any) => Alert.alert('Erreur', e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible.'),
  });

  const valid = amount.trim().length > 0 && reason.trim().length >= 5;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="warning-outline" size={18} color={colors.goldAccent} />
              <Text style={styles.title}>Demande de correction</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              La correction sera <Text style={styles.bold}>soumise au Président et à un autre membre du bureau</Text>.
              Elle s'applique automatiquement quand les <Text style={styles.bold}>2 approbations</Text> sont réunies. Délai limite : <Text style={styles.bold}>24h</Text>.
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLine}>Cotisation de <Text style={styles.bold}>{contribution.member_name ?? 'Membre'}</Text></Text>
            <Text style={styles.infoMuted}>Attendu : <Text style={styles.infoStrong}>{formatXAF(contribution.expected_amount)}</Text></Text>
            <Text style={styles.infoMuted}>Actuellement payé : <Text style={styles.infoStrong}>{formatXAF(currentPaid)}</Text></Text>
          </View>

          <TextField
            label="Nouveau montant payé (XAF) *"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            placeholder="0"
            keyboardType="number-pad"
          />
          {amount.trim().length > 0 ? (
            <Text style={styles.diff}>
              Différence : <Text style={[styles.bold, { color: diff >= 0 ? colors.success : colors.danger }]}>{formatXAFSigned(diff)}</Text>
            </Text>
          ) : null}

          <TextField
            label="Motif de la correction * (min 5 caractères)"
            value={reason}
            onChangeText={setReason}
            placeholder="Ex : erreur de frappe, doublon…"
            multiline
          />

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={mut.isPending}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, (!valid || mut.isPending) && styles.btnDisabled]}
              onPress={() => valid && mut.mutate()}
              disabled={!valid || mut.isPending}
            >
              {mut.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.btnPrimaryText}>Soumettre au bureau</Text>}
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
  bold: { fontWeight: font.bold },

  warnBox: { backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gold.beige },
  warnText: { fontSize: font.size.xs, color: '#92702A', lineHeight: 17 },

  infoBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  infoLine: { fontSize: font.size.sm, color: colors.text },
  infoMuted: { fontSize: font.size.sm, color: colors.textMuted },
  infoStrong: { fontWeight: font.semibold, color: colors.text },

  diff: { fontSize: font.size.sm, color: colors.textMuted, marginTop: -spacing.xs },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  btnCancelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  btnDisabled: { opacity: 0.5 },
});
