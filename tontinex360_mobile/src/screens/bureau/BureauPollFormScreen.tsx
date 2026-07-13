import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import { DateField } from '../../components/bureau/DateTimeFields';
import type { BureauStackParamList } from '../../navigation/types';
import { governanceApi, type PollKind } from '../../lib/api/governance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauPollForm'>;

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

function Check({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <Pressable style={styles.check} onPress={onToggle}>
      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.primary : colors.textMuted} />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export default function BureauPollFormScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [kind, setKind] = useState<PollKind>('single_choice');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [endsAt, setEndsAt] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [allowChange, setAllowChange] = useState(false);
  const [resultsBefore, setResultsBefore] = useState(true);

  const validOptions = options.map((o) => o.trim()).filter(Boolean);

  const setOption = (i: number, v: string) => setOptions((arr) => arr.map((o, idx) => (idx === i ? v : o)));
  const addOption = () => setOptions((arr) => [...arr, '']);
  const removeOption = (i: number) => setOptions((arr) => (arr.length <= 2 ? arr : arr.filter((_, idx) => idx !== i)));

  const createMut = useMutation({
    mutationFn: () =>
      governanceApi.createPoll({
        title: title.trim(),
        question: question.trim() || title.trim(),
        kind,
        is_anonymous: anonymous,
        allow_change_vote: allowChange,
        results_visible_before_close: resultsBefore,
        ends_at: endsAt.trim() || null,
        options_input: validOptions.map((label, i) => ({ label, display_order: i })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'polls'] });
      Alert.alert('Sondage créé', 'Le sondage est en brouillon. Ouvrez-le depuis son détail pour notifier les membres.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <TextField label="Titre *" value={title} onChangeText={setTitle} placeholder="Date de la prochaine séance" />
          <TextField label="Question *" value={question} onChangeText={setQuestion} placeholder="Quel jour vous convient le mieux ?" multiline />

          <Text style={styles.label}>Type de vote</Text>
          <View style={styles.segments}>
            <Pressable onPress={() => setKind('single_choice')} style={[styles.segment, kind === 'single_choice' && styles.segmentOn]}>
              <Text style={[styles.segmentText, kind === 'single_choice' && styles.segmentTextOn]}>Un seul choix</Text>
            </Pressable>
            <Pressable onPress={() => setKind('multi_choice')} style={[styles.segment, kind === 'multi_choice' && styles.segmentOn]}>
              <Text style={[styles.segmentText, kind === 'multi_choice' && styles.segmentTextOn]}>Plusieurs choix</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Options du sondage ({validOptions.length} valides)</Text>
          {options.map((o, i) => (
            <View key={i} style={styles.optionRow}>
              <TextField containerStyle={styles.flex} value={o} onChangeText={(v) => setOption(i, v)} placeholder={`Option ${i + 1}`} />
              {options.length > 2 ? (
                <Pressable onPress={() => removeOption(i)} hitSlop={8} style={styles.optionDel}>
                  <Ionicons name="close-circle" size={22} color={colors.textLight} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable onPress={addOption} style={styles.addOption}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addOptionText}>Ajouter une option</Text>
          </Pressable>

          <DateField label="Date de fin (optionnel)" value={endsAt} onChangeText={setEndsAt} />

          <Check on={anonymous} label="Vote anonyme (l'identité n'est pas stockée)" onToggle={() => setAnonymous((v) => !v)} />
          <Check on={allowChange} label="Autoriser le changement de vote tant qu'ouvert" onToggle={() => setAllowChange((v) => !v)} />
          <Check on={resultsBefore} label="Résultats visibles en temps réel" onToggle={() => setResultsBefore((v) => !v)} />

          <PrimaryButton
            title="Créer le sondage"
            onPress={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!title.trim() || validOptions.length < 2}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  segments: { gap: spacing.sm, marginBottom: 14 },
  segment: { alignItems: 'center', paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  segmentOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  segmentText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  segmentTextOn: { color: colors.primary },
  optionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  optionDel: { paddingTop: 14 },
  addOption: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  addOptionText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  checkLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text, flex: 1 },
});
