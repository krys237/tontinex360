import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton, OutlineButton } from '../../components/ui';
import { DateField, TimeField } from '../../components/bureau/DateTimeFields';
import type { BureauStackParamList } from '../../navigation/types';
import { sessionsApi } from '../../lib/api/sessions';
import { cyclesApi } from '../../lib/api/cycles';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauSessionCreate'>;
type Rt = RouteProp<BureauStackParamList, 'BureauSessionCreate'>;

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Création impossible pour le moment.';
}

export default function BureauSessionCreateScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const preCycle = useRoute<Rt>().params?.cycleId;

  const [cycle, setCycle] = useState(preCycle ?? '');
  const [num, setNum] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const cyclesQ = useQuery({ queryKey: ['bureau', 'cycles', 'active'], queryFn: () => cyclesApi.list({ status: 'active' }), retry: false });

  const createMut = useMutation({
    mutationFn: () =>
      sessionsApi.create({
        cycle,
        session_number: num ? Number(num) : undefined,
        date: date.trim(),
        start_time: start.trim() || undefined,
        end_time: end.trim() || undefined,
        location: location.trim(),
        notes: notes.trim(),
        status: 'scheduled',
      } as any),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['bureau', 'sessions', 'all'] });
      qc.invalidateQueries({ queryKey: ['bureau', 'sessions'] });
      navigation.replace('BureauSessionDetail', { id: s.id });
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const cycles = cyclesQ.data ?? [];
  const valid = !!cycle && /^\d{4}-\d{2}-\d{2}$/.test(date.trim());

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          {/* Cycle */}
          <Text style={styles.label}>Cycle *</Text>
          {cycles.length === 0 ? (
            <Text style={styles.warn}>Aucun cycle actif. Créez d'abord un cycle.</Text>
          ) : (
            <View style={styles.chips}>
              {cycles.map((c) => {
                const on = cycle === c.id;
                return (
                  <Pressable key={c.id} onPress={() => setCycle(c.id)} style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.rowFields}>
            <View style={styles.flex}>
              <TextField label="N° séance" value={num} onChangeText={setNum} placeholder="Auto si vide" keyboardType="numeric" />
            </View>
            <View style={styles.flex}>
              <DateField label="Date *" value={date} onChangeText={setDate} />
            </View>
          </View>

          <View style={styles.rowFields}>
            <View style={styles.flex}>
              <TimeField label="Heure début" value={start} onChangeText={setStart} />
            </View>
            <View style={styles.flex}>
              <TimeField label="Heure fin" value={end} onChangeText={setEnd} />
            </View>
          </View>

          <TextField label="Lieu" value={location} onChangeText={setLocation} placeholder="Siège de l'association" />
          <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Notes (optionnel)" multiline />

          <View style={styles.actions}>
            <OutlineButton title="Annuler" onPress={() => navigation.goBack()} style={styles.flex} />
            <PrimaryButton title="Créer la séance" onPress={() => createMut.mutate()} loading={createMut.isPending} disabled={!valid} style={styles.flex} />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg, gap: 2 },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  warn: { fontSize: font.size.sm, color: colors.goldAccent, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  chipTextOn: { color: colors.white },
  rowFields: { flexDirection: 'row', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
