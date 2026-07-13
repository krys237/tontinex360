import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';

import { TextField } from '../ui';
import { approvalsApi } from '../../lib/api/approvals';
import type { ApprovalActionType } from '../../lib/types/approval';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

export interface ApprovalField {
  name: string;
  label: string;
  type?: 'text' | 'number';
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}

/**
 * Soumet une action sensible au moteur d'approbation (double validation).
 * Réutilisé pour les prêts (approve/modify/write_off) et autres actions bureau.
 */
export default function ApprovalRequestModal({
  title,
  actionType,
  targetId,
  targetLabel,
  contextSummary,
  fields = [],
  onClose,
  onSubmitted,
}: {
  title: string;
  actionType: ApprovalActionType;
  targetId: string;
  targetLabel?: string;
  contextSummary?: string;
  fields?: ApprovalField[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ''])),
  );
  const [reason, setReason] = useState('');

  const mut = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {};
      for (const f of fields) {
        const v = values[f.name];
        if (v !== undefined && v !== '') payload[f.name] = f.type === 'number' ? Number(v) : v;
      }
      return approvalsApi.request(actionType, targetId, payload, reason.trim());
    },
    onSuccess: onSubmitted,
    onError: (e: any) => Alert.alert('Erreur', e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible.'),
  });

  const canSubmit = reason.trim().length >= 5 && fields.every((f) => !f.required || (values[f.name] ?? '').length > 0);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.goldAccent} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>Cette action sera soumise à la <Text style={styles.bold}>double validation du bureau</Text> (Président + un autre membre).</Text>
            </View>

            {targetLabel ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>Cible</Text>
                <Text style={styles.infoValue}>{targetLabel}</Text>
                {contextSummary ? <Text style={styles.infoCtx}>{contextSummary}</Text> : null}
              </View>
            ) : null}

            {fields.map((f) => (
              <TextField
                key={f.name}
                label={`${f.label}${f.required ? ' *' : ''}`}
                value={values[f.name] ?? ''}
                onChangeText={(t) => setValues((prev) => ({ ...prev, [f.name]: f.type === 'number' ? t.replace(/[^0-9.]/g, '') : t }))}
                placeholder={f.placeholder}
                keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
              />
            ))}

            <TextField label="Motif * (min 5 caractères)" value={reason} onChangeText={setReason} placeholder="Justification de l'action…" multiline />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose} disabled={mut.isPending}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary, (!canSubmit || mut.isPending) && styles.btnDisabled]}
              onPress={() => canSubmit && mut.mutate()}
              disabled={!canSubmit || mut.isPending}
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
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, flexShrink: 1 },
  bold: { fontWeight: font.bold },

  warnBox: { backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gold.beige },
  warnText: { fontSize: font.size.xs, color: '#92702A', lineHeight: 17 },
  infoBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  infoLabel: { fontSize: 10, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  infoCtx: { fontSize: font.size.xs, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  btnCancelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  btnDisabled: { opacity: 0.5 },
});
