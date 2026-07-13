import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import { DateField, TimeField } from '../../components/bureau/DateTimeFields';
import type { BureauStackParamList } from '../../navigation/types';
import { cyclesApi } from '../../lib/api/cycles';
import type { Cycle, RecurrenceKind } from '../../lib/types/cycle';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauCycleCreate'>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const FREQUENCIES: { key: string; label: string }[] = [
  { key: 'weekly', label: 'Hebdo' },
  { key: 'biweekly', label: 'Bimensuel' },
  { key: 'monthly', label: 'Mensuel' },
  { key: 'quarterly', label: 'Trimestriel' },
  { key: 'custom', label: 'Personnalisé' },
];

const STATUSES: { key: string; label: string }[] = [
  { key: 'draft', label: 'Brouillon' },
  { key: 'active', label: 'Activer maintenant' },
];

const WEEKDAYS: { key: number; label: string }[] = [
  { key: 0, label: 'Lun' },
  { key: 1, label: 'Mar' },
  { key: 2, label: 'Mer' },
  { key: 3, label: 'Jeu' },
  { key: 4, label: 'Ven' },
  { key: 5, label: 'Sam' },
  { key: 6, label: 'Dim' },
];

const RECURRENCES: { key: RecurrenceKind; label: string }[] = [
  { key: 'none', label: 'Aucun (séances manuelles)' },
  { key: 'fixed_day_of_month', label: 'Jour fixe du mois' },
  { key: 'nth_weekday', label: 'Nième jour de semaine' },
  { key: 'every_weekday', label: 'Chaque semaine' },
];

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (typeof d === 'string') return d;
  return d?.detail ?? d?.error ?? (d ? JSON.stringify(d) : 'Création impossible pour le moment.');
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={String(o.key)} onPress={() => onChange(o.key)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function BureauCycleCreateScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [status, setStatus] = useState('draft');
  const [weekday, setWeekday] = useState<number>(5); // Samedi par défaut
  const [time, setTime] = useState('18:00');
  const [location, setLocation] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceKind>('none');
  const [nth, setNth] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('15');

  const createMut = useMutation({
    mutationFn: () => {
      const payload: Partial<Cycle> = {
        name: name.trim(),
        start_date: startDate.trim(),
        status: status as Cycle['status'],
        session_frequency: frequency,
        default_session_day: weekday,
        default_session_location: location.trim() || undefined,
        recurrence_kind: recurrence,
      };
      if (endDate.trim()) payload.end_date = endDate.trim();
      if (TIME_RE.test(time.trim())) payload.default_session_time = time.trim();
      // Champs de récurrence selon le pattern choisi
      if (recurrence === 'fixed_day_of_month') {
        payload.recurrence_day_of_month = Number(dayOfMonth) || 1;
      } else if (recurrence === 'nth_weekday') {
        payload.recurrence_nth = Number(nth) || 1;
        payload.recurrence_weekday = weekday;
      } else if (recurrence === 'every_weekday') {
        payload.recurrence_weekday = weekday;
      }
      return cyclesApi.create(payload);
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['bureau', 'cycles'] });
      Alert.alert('Cycle créé', `« ${c.name} » a été créé.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const canSubmit = useMemo(
    () => !!name.trim() && DATE_RE.test(startDate.trim()) && (!endDate.trim() || DATE_RE.test(endDate.trim())),
    [name, startDate, endDate],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <TextField label="Nom *" value={name} onChangeText={setName} placeholder="Ex : Cycle 2026" />
          <View style={styles.row2}>
            <DateField containerStyle={styles.flex} label="Début *" value={startDate} onChangeText={setStartDate} />
            <DateField containerStyle={styles.flex} label="Fin" value={endDate} onChangeText={setEndDate} />
          </View>

          <Text style={styles.label}>Fréquence</Text>
          <Chips options={FREQUENCIES} value={frequency} onChange={setFrequency} />

          <Text style={styles.label}>Statut</Text>
          <Chips options={STATUSES} value={status} onChange={setStatus} />

          <Text style={styles.label}>Jour de la semaine</Text>
          <Chips options={WEEKDAYS} value={weekday} onChange={setWeekday} />

          <View style={styles.row2}>
            <TimeField containerStyle={styles.flex} label="Heure habituelle" value={time} onChangeText={setTime} />
            <TextField containerStyle={styles.flex} label="Lieu habituel" value={location} onChangeText={setLocation} placeholder="Siège de l'association" />
          </View>

          {/* Pattern d'auto-génération — bloc doré */}
          <View style={styles.patternBox}>
            <Text style={styles.patternTitle}>Pattern d'auto-génération des séances</Text>
            <Chips options={RECURRENCES} value={recurrence} onChange={setRecurrence} />

            {recurrence === 'fixed_day_of_month' ? (
              <TextField label="Jour du mois (1-31)" value={dayOfMonth} onChangeText={setDayOfMonth} placeholder="15" keyboardType="numeric" />
            ) : null}
            {recurrence === 'nth_weekday' ? (
              <>
                <Text style={styles.label}>Quelle occurrence ?</Text>
                <Chips
                  options={[
                    { key: '1', label: '1er' },
                    { key: '2', label: '2e' },
                    { key: '3', label: '3e' },
                    { key: '4', label: '4e' },
                    { key: '5', label: 'Dernier' },
                  ]}
                  value={nth}
                  onChange={setNth}
                />
                <Text style={styles.patternHint}>Le jour de semaine sélectionné ci-dessus sera utilisé.</Text>
              </>
            ) : null}
            {recurrence === 'every_weekday' ? (
              <Text style={styles.patternHint}>Une séance chaque semaine, le jour de semaine sélectionné ci-dessus.</Text>
            ) : null}
            {recurrence !== 'none' ? (
              <Text style={styles.patternHint}>
                Les séances seront générées automatiquement à l'activation du cycle.
              </Text>
            ) : null}
          </View>

          <PrimaryButton
            title="Créer le cycle"
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
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  row2: { flexDirection: 'row', gap: spacing.sm },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  chipTextOn: { color: colors.white },
  patternBox: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  patternTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: '#7A5B10', marginBottom: spacing.sm },
  patternHint: { fontSize: font.size.xs, color: '#8A6D1E', marginTop: 2 },
});
