import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';

import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import { Card, PrimaryButton, SoftButton, ProgressBar } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { governanceApi, type PollStatus } from '../../lib/api/governance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr } from '../../lib/utils/format';

type Rt = RouteProp<BureauStackParamList, 'BureauPollDetail'>;

const TONE: Record<PollStatus, StatusTone> = {
  draft: 'muted', open: 'success', closed: 'info', cancelled: 'danger',
};

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauPollDetailScreen() {
  const id = useRoute<Rt>().params.id;
  const qc = useQueryClient();

  const pollQ = useQuery({ queryKey: ['bureau', 'poll', id], queryFn: () => governanceApi.getPoll(id) });
  const resultsQ = useQuery({ queryKey: ['bureau', 'poll', id, 'results'], queryFn: () => governanceApi.pollResults(id) });

  const toggle = useMutation({
    mutationFn: (open: boolean) => (open ? governanceApi.openPoll(id) : governanceApi.closePoll(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'poll', id] });
      qc.invalidateQueries({ queryKey: ['bureau', 'polls'] });
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const p = pollQ.data;
  const results = resultsQ.data;
  const total = results?.total_votes ?? p?.total_votes ?? 0;

  if (pollQ.isLoading || !p) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pollQ.isRefetching || resultsQ.isRefetching} onRefresh={() => { pollQ.refetch(); resultsQ.refetch(); }} tintColor={colors.primary} />}
      >
        <Card style={styles.card}>
          <View style={styles.head}>
            <StatusChip label={p.status_display ?? p.status} tone={TONE[p.status] ?? 'muted'} />
            <Text style={styles.meta}>{p.kind === 'multi_choice' ? 'Plusieurs choix' : 'Un seul choix'}{p.is_anonymous ? ' · Anonyme' : ''}</Text>
          </View>
          <Text style={styles.title}>{p.title}</Text>
          {p.question ? <Text style={styles.question}>{p.question}</Text> : null}
          <Text style={styles.sub}>
            {p.created_by_name ? `Par ${p.created_by_name} · ` : ''}{formatDateFr(p.created_at, false)}
            {p.ends_at ? ` · Clôture le ${formatDateFr(p.ends_at, false)}` : ''}
          </Text>
        </Card>

        {/* Résultats */}
        <Text style={styles.section}>Résultats · {total} vote(s)</Text>
        {(results?.options ?? p.options ?? []).map((o: any) => {
          const votes = o.votes_count ?? 0;
          const pct = o.percentage != null ? o.percentage : total ? (votes / total) * 100 : 0;
          return (
            <View key={o.id} style={styles.optionCard}>
              <View style={styles.optionTop}>
                <Text style={styles.optionLabel}>{o.label}</Text>
                <Text style={styles.optionVotes}>{votes} · {Math.round(pct)}%</Text>
              </View>
              <ProgressBar value={Math.max(0, Math.min(1, pct / 100))} />
            </View>
          );
        })}

        {/* Actions bureau */}
        <RequirePermission bureau>
          <View style={styles.actions}>
            {p.status === 'draft' ? (
              <PrimaryButton title="Ouvrir le vote" onPress={() => toggle.mutate(true)} loading={toggle.isPending} />
            ) : p.status === 'open' ? (
              <SoftButton title="Clôturer le sondage" onPress={() => toggle.mutate(false)} />
            ) : null}
          </View>
        </RequirePermission>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  meta: { fontSize: font.size.xs, color: colors.textMuted },
  title: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  question: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 },
  sub: { fontSize: font.size.xs, color: colors.textLight, marginTop: spacing.sm },
  section: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.sm, marginLeft: 4 },
  optionCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  optionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionLabel: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, flex: 1 },
  optionVotes: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.primary },
  actions: { marginTop: spacing.md },
});
