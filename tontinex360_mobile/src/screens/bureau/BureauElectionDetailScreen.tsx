import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import MemberPicker from '../../components/bureau/MemberPicker';
import ChipSelect from '../../components/bureau/ChipSelect';
import { Card, TextField, PrimaryButton, SoftButton } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { governanceApi } from '../../lib/api/governance';
import { membersApi } from '../../lib/api/members';
import { useApprovalAction } from '../../lib/hooks/use-approval-action';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauElectionDetail'>;
type Rt = RouteProp<BureauStackParamList, 'BureauElectionDetail'>;

const TONE: Record<string, StatusTone> = {
  planned: 'muted', in_progress: 'warning', completed: 'success', cancelled: 'danger',
};

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (typeof d === 'string') return d;
  return d?.detail ?? d?.error ?? (d ? JSON.stringify(d) : 'Action impossible pour le moment.');
}

export default function BureauElectionDetailScreen() {
  const id = useRoute<Rt>().params.id;
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();

  const [member, setMember] = useState<{ id: string; name: string } | null>(null);
  const [position, setPosition] = useState<string>('');
  const [validating, setValidating] = useState(false);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [elected, setElected] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState('');

  const elecQ = useQuery({ queryKey: ['bureau', 'election', id], queryFn: () => governanceApi.getElection(id) });
  const candQ = useQuery({ queryKey: ['bureau', 'election', id, 'candidates'], queryFn: () => governanceApi.candidates(id) });
  const posQ = useQuery({ queryKey: ['bureau', 'bureau-positions'], queryFn: () => membersApi.bureauPositions() });

  const refetchAll = () => { elecQ.refetch(); candQ.refetch(); };

  const addCand = useMutation({
    mutationFn: () => governanceApi.addCandidate({ election: id, membership: member!.id, position }),
    onSuccess: () => { setMember(null); setPosition(''); qc.invalidateQueries({ queryKey: ['bureau', 'election', id, 'candidates'] }); },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const removeCand = useMutation({
    mutationFn: (cid: string) => governanceApi.removeCandidate(cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'election', id, 'candidates'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const submitResults = useApprovalAction({
    onSuccess: (req) => {
      Alert.alert('Soumis au bureau', 'La validation des résultats requiert la triple validation du bureau.', [
        { text: 'Voir la demande', onPress: () => navigation.navigate('BureauApprovalDetail', { id: req.id }) },
        { text: 'OK' },
      ]);
      setValidating(false);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const candidates = candQ.data ?? [];
  const posOptions = useMemo(
    () => (posQ.data ?? []).map((p) => ({ key: p.id, label: p.name })),
    [posQ.data],
  );

  const onSubmitResults = () => {
    if (reason.trim().length < 5) { Alert.alert('Motif requis', 'Indiquez un motif (min 5 caractères).'); return; }
    const results = candidates.map((c) => ({
      candidate_id: c.id,
      votes_count: Number(votes[c.id]) || 0,
      is_elected: !!elected[c.id],
    }));
    submitResults.mutate({ action: 'election.validate_results', targetId: id, payload: { results }, reason: reason.trim() });
  };

  const e = elecQ.data;
  if (elecQ.isLoading || !e) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }
  const locked = e.status === 'completed' || e.status === 'cancelled';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={elecQ.isRefetching || candQ.isRefetching} onRefresh={refetchAll} tintColor={colors.primary} />}
      >
        {/* En-tête */}
        <Card style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{e.title}</Text>
            <StatusChip label={e.status} tone={TONE[e.status] ?? 'muted'} />
          </View>
          <Text style={styles.sub}>
            {e.method === 'secret' ? 'Bulletin secret' : e.method === 'open' ? 'Vote à main levée' : e.method}
            {e.date ? ` · ${formatDateFr(e.date, false)}` : ''}
          </Text>
          {e.notes ? <Text style={styles.notes}>« {e.notes} »</Text> : null}
        </Card>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Saisie post-AG : après le vote en présentiel, saisissez les voix de chaque candidat puis cochez les élus. La validation requiert la triple approbation du bureau (création des membres du bureau).
          </Text>
        </View>

        {/* Candidats */}
        <Text style={styles.section}>Candidats ({candidates.length})</Text>
        {candQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
        ) : candidates.length === 0 ? (
          <Text style={styles.empty}>Aucun candidat enregistré pour cette élection.</Text>
        ) : (
          candidates.map((c) => (
            <View key={c.id} style={styles.candRow}>
              <View style={styles.flex}>
                <Text style={styles.candName}>{c.member_name ?? 'Membre'}</Text>
                <Text style={styles.candPos}>{c.position_name ?? '—'}</Text>
              </View>
              {validating ? (
                <View style={styles.voteEntry}>
                  <TextField
                    containerStyle={styles.voteField}
                    value={votes[c.id] ?? String(c.votes_count ?? '')}
                    onChangeText={(v) => setVotes((m) => ({ ...m, [c.id]: v }))}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                  <Pressable onPress={() => setElected((m) => ({ ...m, [c.id]: !m[c.id] }))} hitSlop={6}>
                    <Ionicons name={elected[c.id] ? 'checkbox' : 'square-outline'} size={22} color={elected[c.id] ? colors.primary : colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.candRight}>
                  <Text style={styles.candVotes}>{c.votes_count} voix</Text>
                  {c.is_elected ? <StatusChip label="Élu" tone="success" /> : null}
                  {!locked ? (
                    <Pressable onPress={() => removeCand.mutate(c.id)} hitSlop={6}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          ))
        )}

        {/* Ajout candidat */}
        {!locked && !validating ? (
          <RequirePermission bureau>
            <Card style={styles.addCard}>
              <Text style={styles.addTitle}>Ajouter un candidat</Text>
              <MemberPicker value={member} onChange={setMember} />
              <Text style={styles.label}>Poste visé</Text>
              <ChipSelect options={posOptions} value={position} onChange={setPosition} />
              <PrimaryButton
                title="Ajouter le candidat"
                onPress={() => addCand.mutate()}
                loading={addCand.isPending}
                disabled={!member || !position}
              />
            </Card>
          </RequirePermission>
        ) : null}

        {/* Validation des résultats */}
        {!locked ? (
          <RequirePermission bureau>
            {validating ? (
              <Card style={styles.addCard}>
                <Text style={styles.addTitle}>Valider les résultats</Text>
                <Text style={styles.warn}>Triple validation requise (Président + 2 membres du bureau). Les candidats cochés « élu » deviendront membres du bureau.</Text>
                <TextField label="Motif de la demande * (min 5 caractères)" value={reason} onChangeText={setReason} placeholder="Pourquoi cette opération est-elle nécessaire ?" multiline />
                <PrimaryButton title="Soumettre au bureau" onPress={onSubmitResults} loading={submitResults.isPending} disabled={candidates.length === 0} />
                <SoftButton title="Annuler" onPress={() => setValidating(false)} style={{ marginTop: spacing.sm }} />
              </Card>
            ) : (
              <View style={styles.actions}>
                <PrimaryButton title="Valider les résultats" onPress={() => setValidating(true)} disabled={candidates.length === 0} />
              </View>
            )}
          </RequirePermission>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  sub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 4 },
  notes: { fontSize: font.size.sm, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  infoBox: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md },
  infoText: { fontSize: font.size.xs, color: '#8A6D1E' },
  section: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.sm, marginLeft: 4 },
  empty: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  candRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...cardShadow },
  candName: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  candPos: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  candRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  candVotes: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  voteEntry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  voteField: { width: 70, marginBottom: 0 },
  addCard: { borderRadius: radius.lg, marginTop: spacing.sm },
  addTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  warn: { fontSize: font.size.xs, color: '#8A6D1E', marginBottom: spacing.sm },
  actions: { marginTop: spacing.md },
});
