import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import ChipSelect from '../../components/bureau/ChipSelect';
import { DateField } from '../../components/bureau/DateTimeFields';
import type { BureauStackParamList } from '../../navigation/types';
import { governanceApi, type Election } from '../../lib/api/governance';
import { cyclesApi } from '../../lib/api/cycles';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauElectionForm'>;

const METHODS = [
  { key: 'secret' as const, label: 'Bulletin secret' },
  { key: 'open' as const, label: 'Main levée' },
  { key: 'consensus' as const, label: 'Consensus' },
  { key: 'designation' as const, label: 'Désignation' },
  { key: 'other' as const, label: 'Autre' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (typeof d === 'string') return d;
  return d?.detail ?? d?.error ?? (d ? JSON.stringify(d) : 'Action impossible pour le moment.');
}

export default function BureauElectionFormScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [cycle, setCycle] = useState<string>('');
  const [method, setMethod] = useState<Election['method']>('secret');
  const [date, setDate] = useState('');
  const [session, setSession] = useState<string>('');
  const [notes, setNotes] = useState('');

  const cyclesQ = useQuery({ queryKey: ['bureau', 'cycles'], queryFn: () => cyclesApi.list() });
  const sessionsQ = useQuery({
    queryKey: ['bureau', 'sessions', 'by-cycle', cycle],
    queryFn: () => cyclesApi.sessions({ cycle }),
    enabled: !!cycle,
  });

  const cycleOptions = (cyclesQ.data ?? []).map((c) => ({ key: c.id, label: c.name }));

  const createMut = useMutation({
    mutationFn: () =>
      governanceApi.createElection({
        title: title.trim(),
        cycle,
        method,
        date: date.trim() || undefined,
        session: session || null,
        notes: notes.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'elections'] });
      Alert.alert('Élection créée', 'Tous les membres actifs seront notifiés.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const canSubmit = !!title.trim() && !!cycle && DATE_RE.test(date.trim());

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <TextField label="Titre *" value={title} onChangeText={setTitle} placeholder="Renouvellement du bureau 2026" />

          <Text style={styles.label}>Cycle *</Text>
          {cycleOptions.length ? (
            <ChipSelect options={cycleOptions} value={cycle} onChange={setCycle} />
          ) : (
            <Text style={styles.hint}>Aucun cycle. Créez un cycle d'abord.</Text>
          )}

          <Text style={styles.label}>Méthode</Text>
          <ChipSelect options={METHODS} value={method} onChange={setMethod} />

          <DateField label="Date *" value={date} onChangeText={setDate} />

          <Text style={styles.label}>Séance liée (optionnel)</Text>
          <ChipSelect
            options={[{ key: '', label: 'Aucune' }, ...(sessionsQ.data ?? []).map((s) => ({ key: s.id, label: `N°${s.session_number ?? '–'} · ${formatDateFr(s.date, false)}` }))]}
            value={session}
            onChange={setSession}
          />

          <TextField label="Notes / informations aux membres" value={notes} onChangeText={setNotes} placeholder="Postes à pourvoir, modalités…" multiline />

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>🔔 Tous les membres actifs seront notifiés de la création de cette élection.</Text>
          </View>

          <PrimaryButton
            title="Créer & notifier"
            onPress={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!canSubmit}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  hint: { fontSize: font.size.sm, color: colors.textMuted, marginBottom: 14 },
  infoBox: { backgroundColor: colors.blue[100], borderRadius: radius.md, padding: spacing.md, marginTop: 4 },
  infoText: { fontSize: font.size.sm, color: colors.blue[600] },
});
