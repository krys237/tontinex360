import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import { financeApi } from '../../lib/api/finance';
import { loanStatus } from '../../lib/bureau/finance-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatXAF, formatDateFr } from '../../lib/utils/format';

const ACC_TONE = { pending: 'warning', accepted: 'success', declined: 'danger' } as const;
const ACC_LABEL = { pending: 'En attente', accepted: 'Accepté', declined: 'Refusé' } as const;

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauMyGuaranteesScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bureau', 'my-guarantees'], queryFn: () => financeApi.myGuarantees() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['bureau', 'my-guarantees'] });

  const acceptMut = useMutation({
    mutationFn: (loanId: string) => financeApi.guarantorAccept(loanId),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const declineMut = useMutation({
    mutationFn: (loanId: string) => financeApi.guarantorDecline(loanId),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const items = q.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.warnBox}>
          <Ionicons name="warning-outline" size={18} color={colors.goldAccent} />
          <View style={styles.flex}>
            <Text style={styles.warnTitle}>Être garant engage votre patrimoine</Text>
            <Text style={styles.warnText}>
              Si l'emprunteur ne rembourse pas, l'association peut prélever sur votre wallet ou vos lots à recevoir pour solder sa dette. Acceptez en connaissance de cause.
            </Text>
          </View>
        </View>

        {q.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x3 }} />
        ) : items.length === 0 ? (
          <Card style={styles.empty}>
            <Ionicons name="shield-outline" size={36} color={colors.textLight} />
            <Text style={styles.emptyText}>Vous n'êtes garant d'aucun prêt pour le moment.</Text>
          </Card>
        ) : (
          items.map((g) => {
            const l = g.loan;
            const st = loanStatus(l.status);
            const acc = g.acceptance_status;
            return (
              <Card key={g.acceptance_id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.flex}>
                    <Text style={styles.member}>{l.member_name ?? 'Membre'}</Text>
                    <Text style={styles.meta}>Prêt de {formatXAF(l.amount)} · taux {Number(l.interest_rate)}%</Text>
                    {l.due_date ? <Text style={styles.meta}>Échéance : {formatDateFr(l.due_date, false)}</Text> : null}
                  </View>
                  <View style={styles.chips}>
                    <StatusChip label={st.label} tone={st.tone} />
                    <StatusChip label={ACC_LABEL[acc]} tone={ACC_TONE[acc]} />
                  </View>
                </View>

                {acc === 'pending' ? (
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.btn, styles.btnDecline]}
                      onPress={() =>
                        Alert.alert('Refuser la garantie', "Refuser annulera la demande de prêt de l'emprunteur. Confirmer ?", [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Refuser', style: 'destructive', onPress: () => declineMut.mutate(l.id) },
                        ])
                      }
                      disabled={declineMut.isPending || acceptMut.isPending}
                    >
                      <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
                      <Text style={styles.btnDeclineText}>Refuser</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btn, styles.btnAccept]}
                      onPress={() => acceptMut.mutate(l.id)}
                      disabled={declineMut.isPending || acceptMut.isPending}
                    >
                      {acceptMut.isPending ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={15} color={colors.white} />
                          <Text style={styles.btnAcceptText}>Accepter</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },

  warnBox: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gold.beige },
  warnTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: '#92702A' },
  warnText: { fontSize: font.size.xs, color: '#92702A', lineHeight: 17, marginTop: 2 },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.x3 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },

  card: { borderRadius: radius.lg, gap: spacing.sm },
  cardTop: { flexDirection: 'row', gap: spacing.sm },
  member: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  meta: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  chips: { alignItems: 'flex-end', gap: 4 },

  actions: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 44, borderRadius: radius.pill },
  btnDecline: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.white },
  btnDeclineText: { color: colors.danger, fontWeight: font.semibold, fontSize: font.size.sm },
  btnAccept: { backgroundColor: colors.primary },
  btnAcceptText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.sm },
});
