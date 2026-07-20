import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import SearchBar from '../../components/bureau/SearchBar';
import SearchCapNotice from '../../components/bureau/SearchCapNotice';
import { useClientSearch } from '../../lib/search/use-client-search';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { eventsApi, EVENT_TYPE_LABEL, type AppEvent } from '../../lib/api/events';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauEvents'>;

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  planned: { label: 'Planifié', tone: 'info' },
  confirmed: { label: 'Confirmé', tone: 'success' },
  in_progress: { label: 'En cours', tone: 'warning' },
  completed: { label: 'Terminé', tone: 'muted' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};
const STATUS_FILTERS = [
  { key: 'all', label: 'Tous statuts' },
  { key: 'planned', label: 'Planifié' },
  { key: 'confirmed', label: 'Confirmé' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'completed', label: 'Terminé' },
  { key: 'cancelled', label: 'Annulé' },
];

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

function hhmm(t?: string | null) {
  if (!t) return '';
  return t.slice(0, 5);
}

export default function BureauEventsScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const q = useQuery({ queryKey: ['bureau', 'events'], queryFn: () => eventsApi.list() });

  const removeMut = useMutation({
    mutationFn: (id: string) => eventsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'events'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const confirmRemove = (e: AppEvent) =>
    Alert.alert('Supprimer l’événement', `Supprimer « ${e.title} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeMut.mutate(e.id) },
    ]);

  const events = q.data ?? [];
  const { query, setQuery, filtered: searched, capped } = useClientSearch(events, (e) => [
    e.title,
    e.description,
    e.location,
    EVENT_TYPE_LABEL[e.event_type] ?? e.event_type,
    STATUS[e.status]?.label,
  ]);
  const filtered = useMemo(
    () => (statusFilter === 'all' ? searched : searched.filter((e) => e.status === statusFilter)),
    [searched, statusFilter],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        <RequirePermission bureau>
          <Pressable style={styles.addBtn} onPress={() => navigation.navigate('BureauEventForm')}>
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.addBtnText}>Nouvel événement</Text>
          </Pressable>
        </RequirePermission>

        <SearchBar value={query} onChangeText={setQuery} placeholder="Rechercher un événement…" />
        <SearchCapNotice visible={capped} />

        <View style={styles.filters}>
          {STATUS_FILTERS.map((f) => {
            const on = statusFilter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setStatusFilter(f.key)} style={[styles.filterChip, on && styles.filterChipOn]}>
                <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {q.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <IconBubble icon="calendar-outline" tint="lime" size={56} />
            <Text style={styles.emptyText}>
              {query.trim() ? `Aucun événement pour « ${query.trim()} ».` : 'Aucun événement.'}
            </Text>
          </View>
        ) : (
          filtered.map((e) => {
            const st = STATUS[e.status] ?? STATUS.planned;
            const audience = e.audience_mode === 'all'
              ? `Tous les membres (${e.invitees_count ?? 0})`
              : `${e.invitees_count ?? 0} invité${(e.invitees_count ?? 0) > 1 ? 's' : ''}`;
            return (
              <View key={e.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.title} numberOfLines={1}>{e.title}</Text>
                  <View style={styles.typeTag}>
                    <Text style={styles.typeTagText}>{EVENT_TYPE_LABEL[e.event_type] ?? e.event_type}</Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <StatusChip label={st.label} tone={st.tone} />
                </View>
                {e.description ? <Text style={styles.desc} numberOfLines={3}>{e.description}</Text> : null}
                <View style={styles.info}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.infoText}>{formatDateFr(e.date, false)}</Text>
                  {e.start_time ? (
                    <>
                      <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginLeft: spacing.md }} />
                      <Text style={styles.infoText}>{hhmm(e.start_time)}{e.end_time ? ` – ${hhmm(e.end_time)}` : ''}</Text>
                    </>
                  ) : null}
                </View>
                {e.location ? (
                  <View style={styles.info}>
                    <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.infoText}>{e.location}</Text>
                  </View>
                ) : null}
                <View style={styles.info}>
                  <Ionicons name="people-outline" size={14} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.primary, fontWeight: font.semibold }]}>{audience}</Text>
                </View>

                <RequirePermission bureau>
                  <View style={styles.actions}>
                    <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('BureauEventForm', { id: e.id })}>
                      <Ionicons name="create-outline" size={15} color={colors.primary} />
                      <Text style={styles.actionText}>Modifier</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => confirmRemove(e)}>
                      <Ionicons name="trash-outline" size={15} color={colors.danger} />
                      <Text style={[styles.actionText, styles.actionTextDanger]}>Supprimer</Text>
                    </Pressable>
                  </View>
                </RequirePermission>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 12 },
  addBtnText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },

  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.xs },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  filterChipOn: { backgroundColor: colors.primary },
  filterText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  filterTextOn: { color: colors.white },

  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  typeTag: { backgroundColor: '#EDE7FB', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  typeTagText: { fontSize: font.size.xs, fontWeight: font.semibold, color: '#6D4FB0' },
  metaRow: { flexDirection: 'row' },
  desc: { fontSize: font.size.sm, color: colors.textMuted, lineHeight: 20 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { fontSize: font.size.sm, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm, marginTop: 2 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.greenBg },
  actionBtnDanger: { backgroundColor: colors.dangerSoft },
  actionText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },
  actionTextDanger: { color: colors.danger },

  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
