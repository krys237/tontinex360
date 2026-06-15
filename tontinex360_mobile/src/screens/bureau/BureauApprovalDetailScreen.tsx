import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { Card, TextField, PrimaryButton, OutlineButton, IconBubble } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import type { BureauStackParamList } from '../../navigation/types';
import { approvalsApi } from '../../lib/api/approvals';
import { useAuthStore } from '../../lib/stores/auth-store';
import { actionLabel, approvalStatus } from '../../lib/bureau/approval-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatDateFr, countdown } from '../../lib/utils/format';

type Rt = RouteProp<BureauStackParamList, 'BureauApprovalDetail'>;

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

function pretty(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function BureauApprovalDetailScreen() {
  const { id } = useRoute<Rt>().params;
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const q = useQuery({
    queryKey: ['bureau', 'approval', id],
    queryFn: () => approvalsApi.get(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bureau', 'approval', id] });
    qc.invalidateQueries({ queryKey: ['bureau', 'approvals'] });
  };

  const approveMut = useMutation({
    mutationFn: () => approvalsApi.approve(id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const rejectMut = useMutation({
    mutationFn: () => approvalsApi.reject(id, reason.trim()),
    onSuccess: () => {
      setRejecting(false);
      setReason('');
      invalidate();
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const cancelMut = useMutation({
    mutationFn: () => approvalsApi.cancel(id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  if (q.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }
  const a = q.data;
  if (!a) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.muted}>Demande introuvable.</Text>
      </SafeAreaView>
    );
  }

  const st = approvalStatus(a.status);
  const isOpen = ['pending', 'pres_approved', 'bureau_approved'].includes(a.status);
  const isRequester = !!membership && a.requested_by === membership.id;

  // Diff payload vs snapshot
  const keys = Array.from(
    new Set([...Object.keys(a.payload ?? {}), ...Object.keys(a.original_snapshot ?? {})]),
  );

  const slots = [
    { label: 'Président', name: a.president_approval_name, at: a.president_approval_at },
    { label: 'Bureau', name: a.bureau_approval_name, at: a.bureau_approval_at },
    ...(a.requires_triple
      ? [{ label: 'Bureau (2)', name: a.bureau_approval_2_name, at: a.bureau_approval_2_at }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* En-tête */}
        <Card style={styles.headCard}>
          <View style={styles.headRow}>
            <IconBubble
              icon={a.requires_triple ? 'shield-checkmark' : 'checkmark-circle'}
              tint={a.requires_triple ? 'accent' : 'primary'}
              size={44}
            />
            <View style={styles.flex}>
              <Text style={styles.title}>{actionLabel(a.action_type)}</Text>
              <Text style={styles.sub}>Demandé par {a.requested_by_name ?? '—'}</Text>
            </View>
            <StatusChip label={st.label} tone={st.tone} />
          </View>
          {a.requires_triple ? (
            <Text style={styles.tripleHint}>Triple validation requise (président + 2 membres du bureau).</Text>
          ) : null}
        </Card>

        {/* Motif & échéance */}
        <Card style={styles.card}>
          {a.reason ? <Info label="Motif" value={a.reason} /> : null}
          {a.summary ? <Info label="Résumé" value={a.summary} /> : null}
          <Info label="Créée le" value={formatDateFr(a.created_at)} />
          {isOpen && a.expires_at ? <Info label="Expire dans" value={countdown(a.expires_at)} /> : null}
          {a.status === 'rejected' && a.rejection_reason ? (
            <Info label="Motif du rejet" value={a.rejection_reason} />
          ) : null}
        </Card>

        {/* Changement proposé */}
        {keys.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Changement proposé</Text>
            <Card style={styles.card}>
              {keys.map((k, i) => (
                <View key={k} style={[styles.diffRow, i > 0 && styles.divider]}>
                  <Text style={styles.diffKey}>{k}</Text>
                  <View style={styles.diffValues}>
                    <Text style={styles.diffOld}>{pretty(a.original_snapshot?.[k])}</Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.textLight} />
                    <Text style={styles.diffNew}>{pretty(a.payload?.[k])}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {/* Validations */}
        <Text style={styles.sectionLabel}>Validations</Text>
        <Card style={styles.card}>
          {slots.map((s, i) => (
            <View key={s.label} style={[styles.slotRow, i > 0 && styles.divider]}>
              <IconBubble
                icon={s.name ? 'checkmark-circle' : 'ellipse-outline'}
                tint={s.name ? 'primary' : 'lime'}
                size={32}
              />
              <View style={styles.flex}>
                <Text style={styles.slotLabel}>{s.label}</Text>
                <Text style={styles.slotName}>
                  {s.name ? `${s.name}${s.at ? ` · ${formatDateFr(s.at)}` : ''}` : 'En attente'}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Actions */}
        {isOpen ? (
          rejecting ? (
            <Card style={styles.card}>
              <TextField
                label="Motif du rejet"
                value={reason}
                onChangeText={setReason}
                placeholder="Expliquez la raison du rejet…"
                multiline
              />
              <View style={styles.actionRow}>
                <OutlineButton title="Annuler" onPress={() => setRejecting(false)} style={styles.flex} />
                <PrimaryButton
                  title="Confirmer le rejet"
                  onPress={() => rejectMut.mutate()}
                  loading={rejectMut.isPending}
                  disabled={reason.trim().length < 3}
                  style={styles.flex}
                />
              </View>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <PrimaryButton title="Approuver" onPress={() => approveMut.mutate()} loading={approveMut.isPending} />
              <OutlineButton title="Rejeter" onPress={() => setRejecting(true)} />
              {isRequester ? (
                <OutlineButton
                  title="Annuler ma demande"
                  onPress={() =>
                    Alert.alert('Annuler', 'Annuler cette demande ?', [
                      { text: 'Non', style: 'cancel' },
                      { text: 'Oui', style: 'destructive', onPress: () => cancelMut.mutate() },
                    ])
                  }
                />
              ) : null}
            </View>
          )
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

  headCard: { gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  sub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  tripleHint: { fontSize: font.size.xs, color: colors.goldAccent },

  card: { borderRadius: radius.lg, gap: 2 },
  infoRow: { paddingVertical: 8 },
  infoLabel: { fontSize: font.size.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: font.size.sm, color: colors.text, marginTop: 2 },

  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
  },
  diffRow: { paddingVertical: 8 },
  diffKey: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  diffValues: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  diffOld: { fontSize: font.size.sm, color: colors.textMuted, textDecorationLine: 'line-through' },
  diffNew: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.semibold },

  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
  slotLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  slotName: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },

  divider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
