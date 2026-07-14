import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton, OutlineButton } from '../../components/ui';
import ChipSelect, { MultiChipSelect } from '../../components/bureau/ChipSelect';
import { DateField, TimeField } from '../../components/bureau/DateTimeFields';
import type { BureauStackParamList } from '../../navigation/types';
import { cyclesApi } from '../../lib/api/cycles';
import type { Cycle, RecurrenceKind } from '../../lib/types/cycle';
import {
  RECURRENCES,
  RECURRENCE_NTH,
  SESSION_FREQUENCIES,
  WEEKDAYS,
  weekdayLabel,
} from '../../lib/bureau/cycle-labels';
import {
  computeSessionDates,
  formatDateFR,
  parseISODate,
  toISODate,
} from '../../lib/bureau/recurrence-preview';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauCycleCreate'>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const PREVIEW_LIMIT = 12;

const STATUSES: { key: string; label: string }[] = [
  { key: 'draft', label: 'Brouillon' },
  { key: 'active', label: 'Activer maintenant' },
];

/** Modes où le jour de semaine unique ci-dessus pilote la récurrence. */
const USES_SINGLE_WEEKDAY: RecurrenceKind[] = ['nth_weekday', 'every_weekday'];
/** Modes où l'utilisateur choisit plusieurs jours + un intervalle. */
const USES_MULTI_WEEKDAYS: RecurrenceKind[] = ['weekly_multiple', 'daily'];

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    // DRF renvoie { champ: ["message"] } — on remonte le 1er message lisible.
    const first = Object.values(d)[0];
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
    if (typeof d.detail === 'string') return d.detail;
    if (typeof d.error === 'string') return d.error;
  }
  return 'Création impossible pour le moment.';
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
  // Modes flexibles
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [interval, setInterval] = useState('1');
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [draftDate, setDraftDate] = useState('');

  const intervalNum = Math.max(1, Number(interval) || 1);

  const buildPayload = (): Partial<Cycle> => {
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

    if (recurrence === 'fixed_day_of_month') {
      payload.recurrence_day_of_month = Number(dayOfMonth) || 1;
    } else if (recurrence === 'nth_weekday') {
      payload.recurrence_nth = Number(nth) || 1;
      payload.recurrence_weekday = weekday;
    } else if (recurrence === 'every_weekday') {
      payload.recurrence_weekday = weekday;
    } else if (recurrence === 'weekly_multiple' || recurrence === 'daily') {
      payload.recurrence_weekdays = [...weekdays].sort((a, b) => a - b);
      payload.recurrence_interval = intervalNum;
    } else if (recurrence === 'custom_dates') {
      payload.recurrence_custom_dates = [...customDates].sort();
    }
    return payload;
  };

  // Aperçu calculé localement (le cycle n'existe pas encore côté serveur).
  const preview = useMemo(
    () =>
      computeSessionDates(
        {
          start_date: startDate.trim(),
          end_date: endDate.trim() || undefined,
          session_frequency: frequency,
          recurrence_kind: recurrence,
          recurrence_nth: Number(nth) || 1,
          recurrence_weekday: weekday,
          recurrence_day_of_month: Number(dayOfMonth) || 1,
          recurrence_weekdays: weekdays,
          recurrence_custom_dates: customDates,
          recurrence_interval: intervalNum,
        },
        PREVIEW_LIMIT,
      ),
    [
      startDate, endDate, frequency, recurrence, nth, weekday,
      dayOfMonth, weekdays, customDates, intervalNum,
    ],
  );

  const addDraftDate = () => {
    const d = draftDate.trim();
    if (!parseISODate(d)) {
      Alert.alert('Date invalide', 'Utilise le format AAAA-MM-JJ (ex : 2026-02-15).');
      return;
    }
    if (customDates.includes(d)) {
      Alert.alert('Date déjà ajoutée', formatDateFR(parseISODate(d)!));
      return;
    }
    setCustomDates((prev) => [...prev, d].sort());
    setDraftDate('');
  };

  const createMut = useMutation({
    mutationFn: () => cyclesApi.create(buildPayload()),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['bureau', 'cycles'] });
      Alert.alert('Cycle créé', `« ${c.name} » a été créé.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  // Règles alignées sur `CycleSerializer.validate` côté backend.
  const recurrenceError = useMemo(() => {
    if (recurrence === 'weekly_multiple' && weekdays.length === 0) {
      return 'Sélectionne au moins 1 jour de la semaine.';
    }
    if (recurrence === 'custom_dates' && customDates.length === 0) {
      return 'Ajoute au moins 1 date.';
    }
    return null;
  }, [recurrence, weekdays, customDates]);

  const canSubmit =
    !!name.trim() &&
    DATE_RE.test(startDate.trim()) &&
    (!endDate.trim() || DATE_RE.test(endDate.trim())) &&
    !recurrenceError;

  const showsPreview = recurrence !== 'none' && preview.length > 0;
  // `daily` sans date de fin → horizon d'un an, soit ~365 séances générées.
  const unboundedDaily = recurrence === 'daily' && !endDate.trim();

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
          <ChipSelect options={SESSION_FREQUENCIES} value={frequency} onChange={setFrequency} />

          <Text style={styles.label}>Statut</Text>
          <ChipSelect options={STATUSES} value={status} onChange={setStatus} />

          <Text style={styles.label}>Jour de la semaine</Text>
          <ChipSelect options={WEEKDAYS} value={weekday} onChange={setWeekday} />

          <View style={styles.row2}>
            <TimeField containerStyle={styles.flex} label="Heure habituelle" value={time} onChangeText={setTime} />
            <TextField containerStyle={styles.flex} label="Lieu habituel" value={location} onChangeText={setLocation} placeholder="Siège de l'association" />
          </View>

          {/* Pattern d'auto-génération — bloc doré */}
          <View style={styles.patternBox}>
            <Text style={styles.patternTitle}>Pattern d'auto-génération des séances</Text>
            <ChipSelect options={RECURRENCES} value={recurrence} onChange={setRecurrence} />

            {recurrence === 'fixed_day_of_month' ? (
              <TextField label="Jour du mois (1-31)" value={dayOfMonth} onChangeText={setDayOfMonth} placeholder="15" keyboardType="numeric" />
            ) : null}

            {recurrence === 'nth_weekday' ? (
              <>
                <Text style={styles.label}>Quelle occurrence ?</Text>
                <ChipSelect options={RECURRENCE_NTH} value={nth} onChange={setNth} />
              </>
            ) : null}

            {USES_MULTI_WEEKDAYS.includes(recurrence) ? (
              <>
                <Text style={styles.label}>
                  {recurrence === 'daily' ? 'Jours concernés (vide = tous)' : 'Jours de séance *'}
                </Text>
                <MultiChipSelect options={WEEKDAYS} values={weekdays} onChange={setWeekdays} />
                <TextField
                  label={recurrence === 'daily' ? 'Une séance tous les N jours' : 'Une fois toutes les N semaines'}
                  value={interval}
                  onChangeText={setInterval}
                  placeholder="1"
                  keyboardType="numeric"
                  helper={
                    recurrence === 'daily'
                      ? '1 = chaque jour, 2 = un jour sur deux…'
                      : '1 = chaque semaine, 2 = une semaine sur deux…'
                  }
                />
              </>
            ) : null}

            {recurrence === 'custom_dates' ? (
              <>
                <Text style={styles.label}>Dates des séances *</Text>
                <View style={styles.row2}>
                  <DateField containerStyle={styles.flex} label="Ajouter une date" value={draftDate} onChangeText={setDraftDate} />
                  <OutlineButton title="Ajouter" onPress={addDraftDate} style={styles.addBtn} />
                </View>
                {customDates.length ? (
                  <View style={styles.dateList}>
                    {customDates.map((d) => (
                      <Pressable key={d} onPress={() => setCustomDates((p) => p.filter((x) => x !== d))} style={styles.dateChip}>
                        <Text style={styles.dateChipText}>{formatDateFR(parseISODate(d)!)}</Text>
                        <Text style={styles.dateChipX}>✕</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.patternHint}>
                  {customDates.length
                    ? `${customDates.length} date${customDates.length > 1 ? 's' : ''} — touche une date pour la retirer.`
                    : 'Les dates hors de la période du cycle seront ignorées.'}
                </Text>
              </>
            ) : null}

            {USES_SINGLE_WEEKDAY.includes(recurrence) ? (
              <Text style={styles.patternHint}>
                Le jour sélectionné ci-dessus ({weekdayLabel(weekday)}) sera utilisé.
              </Text>
            ) : null}

            {recurrenceError ? <Text style={styles.patternError}>{recurrenceError}</Text> : null}

            {unboundedDaily ? (
              <Text style={styles.patternWarn}>
                Sans date de fin, l'horizon est d'un an — cela peut générer des centaines de séances.
              </Text>
            ) : null}

            {recurrence !== 'none' ? (
              <Text style={styles.patternHint}>
                Les séances seront générées automatiquement à l'activation du cycle.
              </Text>
            ) : null}
          </View>

          {/* Aperçu des prochaines séances */}
          {showsPreview ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Prochaines séances</Text>
              {preview.map((d) => (
                <Text key={toISODate(d)} style={styles.previewItem}>
                  • {formatDateFR(d)}
                </Text>
              ))}
              {preview.length === PREVIEW_LIMIT ? (
                <Text style={styles.previewMore}>… aperçu limité aux {PREVIEW_LIMIT} premières.</Text>
              ) : null}
            </View>
          ) : null}

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
  addBtn: { alignSelf: 'flex-end', marginBottom: 14 },
  dateList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gold.beige,
  },
  dateChipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: '#7A5B10' },
  dateChipX: { fontSize: font.size.xs, color: '#8A6D1E' },
  patternBox: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  patternTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: '#7A5B10', marginBottom: spacing.sm },
  patternHint: { fontSize: font.size.xs, color: '#8A6D1E', marginTop: 2 },
  patternWarn: { fontSize: font.size.xs, fontWeight: font.semibold, color: '#8A6D1E', marginTop: 6 },
  patternError: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.danger, marginTop: 6 },
  previewBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  previewTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text, marginBottom: 6 },
  previewItem: { fontSize: font.size.sm, color: colors.textMuted, lineHeight: 22 },
  previewMore: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
});
