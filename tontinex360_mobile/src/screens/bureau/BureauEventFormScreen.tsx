import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import ChipSelect from '../../components/bureau/ChipSelect';
import { DateField, TimeField } from '../../components/bureau/DateTimeFields';
import type { BureauStackParamList } from '../../navigation/types';
import { eventsApi, type AppEvent } from '../../lib/api/events';
import { cyclesApi } from '../../lib/api/cycles';
import { membersApi } from '../../lib/api/members';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauEventForm'>;
type Rt = RouteProp<BureauStackParamList, 'BureauEventForm'>;

const TYPES = [
  { key: 'meeting', label: 'Réunion' },
  { key: 'ag', label: 'Assemblée Générale' },
  { key: 'age', label: 'AG Extraordinaire' },
  { key: 'celebration', label: 'Fête / Célébration' },
  { key: 'workshop', label: 'Atelier / Formation' },
  { key: 'other', label: 'Autre' },
];
const STATUSES = [
  { key: 'planned', label: 'Planifié' },
  { key: 'confirmed', label: 'Confirmé' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'completed', label: 'Terminé' },
  { key: 'cancelled', label: 'Annulé' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    const first = Object.values(d)[0];
    if (Array.isArray(first)) return String(first[0]);
    return d.detail ?? d.error ?? JSON.stringify(d);
  }
  return 'Action impossible pour le moment.';
}

export default function BureauEventFormScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const editId = useRoute<Rt>().params?.id;
  const isEdit = !!editId;

  const [title, setTitle] = useState('');
  const [type, setType] = useState('meeting');
  const [status, setStatus] = useState('planned');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [cycle, setCycle] = useState<string>('');
  const [audience, setAudience] = useState<'all' | 'specific'>('all');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Modifier l'événement" : 'Nouvel événement' });
  }, [navigation, isEdit]);

  const cyclesQ = useQuery({ queryKey: ['bureau', 'cycles'], queryFn: () => cyclesApi.list() });
  const membersQ = useQuery({ queryKey: ['bureau', 'members', 'list'], queryFn: () => membersApi.list() });
  const eventQ = useQuery({ queryKey: ['bureau', 'event', editId], queryFn: () => eventsApi.get(editId!), enabled: isEdit });

  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (eventQ.data && !loaded) {
      const e = eventQ.data;
      setTitle(e.title ?? '');
      setType(e.event_type ?? 'meeting');
      setStatus(e.status ?? 'planned');
      setDescription(e.description ?? '');
      setDate(e.date ?? '');
      setStartTime(e.start_time ?? '');
      setEndTime(e.end_time ?? '');
      setLocation(e.location ?? '');
      setCycle(e.cycle ?? '');
      setAudience(e.audience_mode ?? 'all');
      const inv: Record<string, string> = {};
      (e.invitee_names ?? []).forEach((m) => { inv[m.id] = m.name; });
      (e.invitees ?? []).forEach((id) => { if (!inv[id]) inv[id] = 'Membre'; });
      setSelected(inv);
      setLoaded(true);
    }
  }, [eventQ.data, loaded]);

  const members = membersQ.data ?? [];
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.user_name?.toLowerCase().includes(q));
  }, [query, members]);

  const selectedIds = Object.keys(selected);
  const toggle = (id: string, nm: string) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = nm;
      return next;
    });
  const selectAll = () => setSelected(Object.fromEntries(members.map((m) => [m.id, m.user_name])));
  const clearAll = () => setSelected({});

  const cycleOptions = [{ key: '', label: 'Aucun cycle' }, ...(cyclesQ.data ?? []).map((c) => ({ key: c.id, label: c.name }))];

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Partial<AppEvent> = {
        title: title.trim(),
        event_type: type,
        status: status as AppEvent['status'],
        description: description.trim(),
        date: date.trim(),
        start_time: TIME_RE.test(startTime.trim()) ? startTime.trim() : null,
        end_time: TIME_RE.test(endTime.trim()) ? endTime.trim() : null,
        location: location.trim(),
        cycle: cycle || null,
        audience_mode: audience,
        invitees: audience === 'specific' ? selectedIds : [],
      };
      return isEdit ? eventsApi.update(editId!, payload) : eventsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'events'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['bureau', 'event', editId] });
      Alert.alert(isEdit ? 'Événement modifié' : 'Événement créé', 'Les modifications ont été enregistrées.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const error = useMemo(() => {
    if (!title.trim()) return 'Le titre est requis.';
    if (!DATE_RE.test(date.trim())) return 'La date est requise (AAAA-MM-JJ).';
    if (audience === 'specific' && selectedIds.length === 0) return 'Sélectionnez au moins un membre.';
    return null;
  }, [title, date, audience, selectedIds.length]);

  if (isEdit && eventQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <TextField label="Titre *" value={title} onChangeText={setTitle} placeholder="Assemblée générale 2026" />

          <Text style={styles.label}>Type *</Text>
          <ChipSelect options={TYPES} value={type} onChange={setType} />

          <Text style={styles.label}>Statut</Text>
          <ChipSelect options={STATUSES} value={status} onChange={setStatus} />

          <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Ordre du jour, informations importantes…" multiline />

          <DateField label="Date *" value={date} onChangeText={setDate} />
          <View style={styles.row2}>
            <TimeField containerStyle={styles.flex} label="Heure début" value={startTime} onChangeText={setStartTime} />
            <TimeField containerStyle={styles.flex} label="Heure fin" value={endTime} onChangeText={setEndTime} />
          </View>
          <TextField label="Lieu" value={location} onChangeText={setLocation} placeholder="Salle des fêtes, etc." />

          <Text style={styles.label}>Cycle (optionnel)</Text>
          <ChipSelect options={cycleOptions} value={cycle} onChange={setCycle} />

          {/* Audience — bloc doré */}
          <View style={styles.goldBox}>
            <Text style={styles.goldTitle}>Qui est concerné par cet événement ?</Text>
            <View style={styles.segments}>
              <Pressable onPress={() => setAudience('all')} style={[styles.segment, audience === 'all' && styles.segmentOn]}>
                <Ionicons name="people" size={15} color={audience === 'all' ? colors.primary : colors.textMuted} />
                <Text style={[styles.segmentText, audience === 'all' && styles.segmentTextOn]}>Tous les membres</Text>
              </Pressable>
              <Pressable onPress={() => setAudience('specific')} style={[styles.segment, audience === 'specific' && styles.segmentOn]}>
                <Ionicons name="person-add" size={15} color={audience === 'specific' ? colors.primary : colors.textMuted} />
                <Text style={[styles.segmentText, audience === 'specific' && styles.segmentTextOn]}>Membres sélectionnés</Text>
              </Pressable>
            </View>

            {audience === 'all' ? (
              <Text style={styles.goldHint}>
                Tous les membres actifs recevront une notification et seront listés dans le pointage de présence.
              </Text>
            ) : (
              <>
                <View style={styles.selRow}>
                  <Text style={styles.selCount}>{selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}</Text>
                  <View style={styles.selActions}>
                    <Pressable onPress={selectAll}><Text style={styles.selLink}>Tout sélectionner</Text></Pressable>
                    <Pressable onPress={clearAll}><Text style={styles.selLink}>Tout désélectionner</Text></Pressable>
                  </View>
                </View>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={16} color={colors.textMuted} />
                  <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Rechercher…" placeholderTextColor={colors.placeholder} />
                </View>
                {membersQ.isLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
                ) : (
                  results.map((m) => {
                    const on = !!selected[m.id];
                    return (
                      <Pressable key={m.id} style={styles.memberRow} onPress={() => toggle(m.id, m.user_name)}>
                        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.primary : colors.textMuted} />
                        <Text style={styles.memberName} numberOfLines={1}>{m.user_name}</Text>
                        <Text style={styles.memberNum}>#{m.member_number}</Text>
                      </Pressable>
                    );
                  })
                )}
              </>
            )}
          </View>

          {error ? <Text style={styles.errText}>{error}</Text> : null}
          <PrimaryButton
            title={isEdit ? 'Enregistrer' : 'Créer'}
            onPress={() => saveMut.mutate()}
            loading={saveMut.isPending}
            disabled={!!error}
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

  goldBox: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md, marginTop: 4, marginBottom: spacing.sm },
  goldTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: '#7A5B10', marginBottom: spacing.sm },
  segments: { gap: spacing.sm },
  segment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  segmentOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  segmentText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  segmentTextOn: { color: colors.primary },
  goldHint: { fontSize: font.size.xs, color: '#8A6D1E', marginTop: spacing.sm },

  selRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.sm },
  selCount: { fontSize: font.size.xs, color: '#7A5B10', fontWeight: font.semibold },
  selActions: { flexDirection: 'row', gap: spacing.md },
  selLink: { fontSize: font.size.xs, color: colors.primary, fontWeight: font.semibold },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 46, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontSize: font.size.base, color: colors.textStrong, paddingVertical: 9 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  memberName: { flex: 1, fontSize: font.size.sm, color: colors.text },
  memberNum: { fontSize: font.size.xs, color: colors.textLight },
  errText: { fontSize: font.size.sm, color: colors.danger, marginTop: 4 },
});
