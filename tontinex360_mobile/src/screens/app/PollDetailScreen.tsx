import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { governanceApi, type Poll, type PollResults } from '../../lib/api/governance';
import type { AppStackParamList } from '../../navigation/types';
import { countdown } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type DetailRoute = RouteProp<AppStackParamList, 'PollDetail'>;

function errorMessage(e: unknown): string {
  const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return msg || "Votre vote n'a pas pu être enregistré.";
}

export default function PollDetailScreen() {
  const { params } = useRoute<DetailRoute>();
  const { id } = params;
  const qc = useQueryClient();

  const [selected, setSelected] = useState<string[]>([]);
  const [voting, setVoting] = useState(false);

  const placeholder = (qc.getQueryData<Poll[]>(['polls']) ?? []).find((p) => p.id === id);
  const pollQ = useQuery({ queryKey: ['poll', id], queryFn: () => governanceApi.getPoll(id), initialData: placeholder });
  const poll = pollQ.data;

  const open = !!poll?.is_open_now || poll?.status === 'open';
  const resultsQ = useQuery({
    queryKey: ['poll', id, 'results'],
    queryFn: () => governanceApi.pollResults(id),
    refetchInterval: open ? 10000 : false,
  });
  const results: PollResults | undefined = resultsQ.data;
  const resultById = useMemo(
    () => new Map((results?.options ?? []).map((o) => [o.id, o])),
    [results],
  );
  const showResults = !!results?.visible;

  if (!poll) {
    return (
      <View style={styles.center}>
        {pollQ.isLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.empty}>Sondage introuvable.</Text>}
      </View>
    );
  }

  const single = poll.kind === 'single_choice';
  const alreadyVoted = poll.has_voted && !poll.allow_change_vote;
  const canVote = open && (!poll.has_voted || poll.allow_change_vote);
  const maxChoices = poll.max_choices ?? undefined;

  const toggle = (optId: string) => {
    if (!canVote) return;
    setSelected((prev) => {
      if (single) return [optId];
      if (prev.includes(optId)) return prev.filter((x) => x !== optId);
      if (maxChoices && prev.length >= maxChoices) {
        Alert.alert('Choix multiples', `Vous ne pouvez sélectionner que ${maxChoices} option(s).`);
        return prev;
      }
      return [...prev, optId];
    });
  };

  const selectionValid = single ? selected.length === 1 : selected.length >= 1;

  const submit = async () => {
    if (!canVote || !selectionValid || voting) return;
    setVoting(true);
    try {
      const updated = await governanceApi.votePoll(id, selected);
      qc.setQueryData(['poll', id], updated);
      qc.invalidateQueries({ queryKey: ['poll', id, 'results'] });
      qc.invalidateQueries({ queryKey: ['polls'] });
      setSelected([]);
      Alert.alert('Vote enregistré', 'Merci, votre vote a bien été pris en compte.');
    } catch (e) {
      Alert.alert('Vote', errorMessage(e));
    } finally {
      setVoting(false);
    }
  };

  const statusLabel = open ? 'Vote ouvert' : poll.status === 'closed' ? 'Clôturé' : poll.status_display || poll.status;
  const remaining = poll.ends_at ? countdown(poll.ends_at) : '';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={[colors.primary, colors.green[600]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.kicker}>{open ? 'VOTE EN COURS' : 'VOTE CLÔTURÉ'}</Text>
            {open && remaining ? <Text style={styles.kickerRight}>Se termine dans {remaining}</Text> : null}
          </View>
          <Text style={styles.title}>{poll.title}</Text>
          {poll.created_by_name ? <Text style={styles.proposer}>Proposé par {poll.created_by_name}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="people" size={18} color={colors.white} />
              <Text style={styles.statValue}>{poll.total_votes ?? '—'}</Text>
              <Text style={styles.statLabel}>votes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Ionicons name={open ? 'lock-open' : 'lock-closed'} size={18} color={colors.white} />
              <Text style={styles.statValue}>{statusLabel}</Text>
              <Text style={styles.statLabel}>statut</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Détails de la proposition */}
        {poll.question ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Détails de la proposition</Text>
            <Text style={styles.question}>{poll.question}</Text>
          </View>
        ) : null}

        {/* Options */}
        <Text style={styles.sectionTitle}>{single ? 'Votre choix' : `Vos choix${maxChoices ? ` (max ${maxChoices})` : ''}`}</Text>
        {poll.options
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((o) => {
            const res = resultById.get(o.id);
            const pct = showResults ? Math.round(res?.percentage ?? 0) : 0;
            const isSel = selected.includes(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => toggle(o.id)}
                disabled={!canVote}
                style={[styles.option, isSel && styles.optionSel, !canVote && styles.optionDisabled]}>
                <View style={styles.optionTop}>
                  <View style={[styles.tick, single ? styles.tickRound : styles.tickSquare, isSel && styles.tickSel]}>
                    {isSel ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
                  </View>
                  <Text style={styles.optionLabel} numberOfLines={2}>
                    {o.label}
                  </Text>
                  {showResults ? <Text style={styles.optionPct}>{pct}%</Text> : null}
                </View>
                {showResults ? (
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                ) : null}
                {showResults && res?.votes_count != null ? (
                  <Text style={styles.optionCount}>{res.votes_count} vote{res.votes_count > 1 ? 's' : ''}</Text>
                ) : null}
              </Pressable>
            );
          })}

        {!showResults ? (
          <Text style={styles.hidden}>Les résultats seront visibles après la clôture du vote.</Text>
        ) : null}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {poll.is_anonymous ? (
          <View style={styles.confid}>
            <Ionicons name="lock-closed" size={13} color={colors.green[600]} />
            <Text style={styles.confidText}>Votre vote est confidentiel et sécurisé</Text>
          </View>
        ) : null}
        <Pressable
          style={[styles.cta, (!canVote || !selectionValid || voting) && styles.ctaDisabled]}
          disabled={!canVote || !selectionValid || voting}
          onPress={submit}>
          {voting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.ctaText}>
              {!open ? 'Vote clôturé' : alreadyVoted ? 'Vous avez déjà voté' : 'Valider mon vote'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: 14, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty: { color: colors.textMuted, fontSize: font.size.md },

  hero: { borderRadius: radius.hero, padding: 20, ...cardShadow },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: font.size.xs, fontWeight: font.bold, color: 'rgba(255, 255, 255, 0.85)', letterSpacing: 0.5 },
  kickerRight: { fontSize: font.size.xs, color: colors.white, fontWeight: font.semibold },
  title: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.white, marginTop: 8, lineHeight: font.size.lg * 1.25 },
  proposer: { fontSize: font.size.sm, color: 'rgba(255, 255, 255, 0.75)', marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255, 255, 255, 0.25)', marginVertical: 4 },
  statValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  statLabel: { fontSize: font.size.xs, color: 'rgba(255, 255, 255, 0.8)' },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border, ...cardShadow },
  cardTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginBottom: 8 },
  question: { fontSize: font.size.md, color: colors.text, lineHeight: font.size.md * 1.5 },

  sectionTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },

  option: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 },
  optionSel: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  optionDisabled: { opacity: 0.95 },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tick: { width: 22, height: 22, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  tickRound: { borderRadius: 11 },
  tickSquare: { borderRadius: 6 },
  tickSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionLabel: { flex: 1, fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  optionPct: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 999, backgroundColor: colors.primary },
  optionCount: { fontSize: font.size.xs, color: colors.textMuted },

  hidden: { fontSize: font.size.sm, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },

  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, gap: 10 },
  confid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  confidText: { fontSize: font.size.xs, color: colors.green[600] },
  cta: { minHeight: 52, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { backgroundColor: colors.green[400], opacity: 0.6 },
  ctaText: { color: colors.white, fontSize: font.size.md, fontWeight: font.semibold },
});
