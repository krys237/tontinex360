import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import type { BureauStackParamList } from '../../navigation/types';
import { financeApi } from '../../lib/api/finance';
import { sessionsApi } from '../../lib/api/sessions';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF, formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauLoanAllocate'>;

export default function BureauLoanAllocateScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const sessionsQ = useQuery({ queryKey: ['bureau', 'sessions', 'finance'], queryFn: () => sessionsApi.list(), retry: false });
  const loansQ = useQuery({ queryKey: ['bureau', 'loans', 'pending'], queryFn: () => financeApi.loans({ status: 'pending' }) });
  const capacityQ = useQuery({ queryKey: ['loan-capacity'], queryFn: () => financeApi.getLoanCapacity(), retry: false });

  const loans = loansQ.data ?? [];

  useEffect(() => {
    if (loans.length === 0) return;
    setAllocations((prev) => {
      const next = { ...prev };
      for (const l of loans) if (next[l.id] === undefined) next[l.id] = String(Number(l.amount));
      return next;
    });
  }, [loans]);

  const available = Number(capacityQ.data?.available ?? 0);
  const totalProposed = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocations],
  );
  const overcap = totalProposed > available;

  const allocateMut = useMutation({
    mutationFn: () => {
      const payload = loans
        .map((l) => ({ loan: l.id, approved_amount: Number(allocations[l.id] ?? 0) }))
        .filter((a) => a.approved_amount >= 0);
      return financeApi.allocateSessionLoans(sessionId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'loans'] });
      qc.invalidateQueries({ queryKey: ['loan-capacity'] });
      Alert.alert('Allocation enregistrée', 'Les décisions ont été appliquées.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (e: any) => Alert.alert('Erreur', e?.response?.data?.error ?? e?.response?.data?.detail ?? "Erreur d'allocation."),
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Séance */}
        <Card style={styles.card}>
          <Text style={styles.label}>Séance d'allocation</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessRow}>
            {(sessionsQ.data ?? []).map((s) => {
              const on = s.id === sessionId;
              return (
                <Pressable key={s.id} onPress={() => setSessionId(s.id)} style={[styles.sessChip, on && styles.sessChipOn]}>
                  <Text style={[styles.sessChipText, on && styles.sessChipTextOn]}>n°{s.session_number} · {formatDateFr(s.date, false)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>

        {/* Capacité */}
        {capacityQ.data ? (
          <View style={styles.capBox}>
            <View style={styles.capRow}>
              <Text style={styles.capLabel}>Capacité de prêt disponible</Text>
              <Text style={styles.capValue}>{formatXAF(available)}</Text>
            </View>
            <Text style={styles.capSub}>
              Caisse {formatXAF(Number(capacityQ.data.total_treasury))} − réserve {capacityQ.data.buffer_pct}% − encours {formatXAF(Number(capacityQ.data.outstanding_loans))}
            </Text>
          </View>
        ) : null}

        {loansQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x2 }} />
        ) : loans.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={36} color={colors.textLight} />
            <Text style={styles.emptyText}>Aucune demande de prêt en attente.</Text>
          </Card>
        ) : (
          loans.map((l) => {
            const proposed = Number(allocations[l.id] ?? 0);
            const demanded = Number(l.amount);
            const decision = proposed === 0 ? { label: 'Refusé', tone: 'danger' as const, icon: 'alert-circle' as const }
              : proposed < demanded ? { label: 'Contre-offre', tone: 'warning' as const, icon: 'cut' as const }
              : { label: 'Approuvé tel quel', tone: 'success' as const, icon: 'checkmark-circle' as const };
            return (
              <Card key={l.id} style={styles.loanCard}>
                <View style={styles.loanTop}>
                  <View style={styles.flex}>
                    <Text style={styles.member}>{l.member_name ?? 'Membre'}</Text>
                    <Text style={styles.demanded}>Demandé : {formatXAF(demanded)}</Text>
                  </View>
                  <StatusChip label={decision.label} tone={decision.tone} />
                </View>
                <TextField
                  label="À accorder (XAF)"
                  value={allocations[l.id] ?? ''}
                  onChangeText={(t) => setAllocations((prev) => ({ ...prev, [l.id]: t.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  placeholder="0"
                />
              </Card>
            );
          })
        )}

        {/* Total */}
        {loans.length > 0 ? (
          <View style={[styles.totalBox, overcap && styles.totalBoxOver]}>
            <Text style={styles.totalLabel}>Total à débloquer</Text>
            <Text style={[styles.totalValue, { color: overcap ? colors.danger : colors.success }]}>{formatXAF(totalProposed)}</Text>
          </View>
        ) : null}
        {overcap ? <Text style={styles.overWarn}>⚠ Dépasse la capacité disponible ({formatXAF(available)})</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.btn, styles.btnCancel]} onPress={() => navigation.goBack()} disabled={allocateMut.isPending}>
          <Text style={styles.btnCancelText}>Annuler</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnPrimary, (!sessionId || loans.length === 0 || overcap || allocateMut.isPending) && styles.btnDisabled]}
          onPress={() => allocateMut.mutate()}
          disabled={!sessionId || loans.length === 0 || overcap || allocateMut.isPending}
        >
          {allocateMut.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.btnPrimaryText}>Valider l'allocation</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x3 },

  card: { borderRadius: radius.lg, gap: spacing.sm },
  label: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  sessRow: { gap: spacing.sm, paddingRight: spacing.lg },
  sessChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  sessChipOn: { backgroundColor: colors.primary },
  sessChipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  sessChipTextOn: { color: colors.white },

  capBox: { backgroundColor: colors.greenBg, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.greenBgDeep },
  capRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capLabel: { fontSize: font.size.sm, color: colors.primary },
  capValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  capSub: { fontSize: 10, color: colors.primary, opacity: 0.8, marginTop: 2 },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.x3 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },

  loanCard: { borderRadius: radius.lg, gap: spacing.sm },
  loanTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  member: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  demanded: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },

  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...{} },
  totalBoxOver: { borderWidth: 1, borderColor: colors.danger },
  totalLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  totalValue: { fontSize: font.size.lg, fontWeight: font.bold },
  overWarn: { fontSize: font.size.xs, color: colors.danger },

  footer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.surfaceAlt, backgroundColor: colors.white },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  btnCancelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  btnDisabled: { opacity: 0.5 },
});
