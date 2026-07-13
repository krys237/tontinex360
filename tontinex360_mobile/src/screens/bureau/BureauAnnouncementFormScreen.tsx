import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import ChipSelect from '../../components/bureau/ChipSelect';
import { DateTimeField } from '../../components/bureau/DateTimeFields';
import type { BureauStackParamList } from '../../navigation/types';
import { governanceApi, type Announcement } from '../../lib/api/governance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauAnnouncementForm'>;
type Rt = RouteProp<BureauStackParamList, 'BureauAnnouncementForm'>;

const PRIORITIES = [
  { key: 'low' as const, label: 'Basse' },
  { key: 'normal' as const, label: 'Normale' },
  { key: 'high' as const, label: 'Importante' },
  { key: 'urgent' as const, label: 'Urgente' },
];
const AUDIENCES = [
  { key: 'all' as const, label: 'Tous les membres' },
  { key: 'active' as const, label: 'Membres actifs' },
  { key: 'bureau' as const, label: 'Bureau' },
];

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

export default function BureauAnnouncementFormScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const editId = useRoute<Rt>().params?.id;
  const isEdit = !!editId;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Announcement['priority']>('normal');
  const [audience, setAudience] = useState<Announcement['audience']>('all');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [pinned, setPinned] = useState(false);
  const [published, setPublished] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Modifier l'annonce" : 'Nouvelle annonce' });
  }, [navigation, isEdit]);

  const annQ = useQuery({
    queryKey: ['bureau', 'announcement', editId],
    queryFn: () => governanceApi.getAnnouncement(editId!),
    enabled: isEdit,
  });

  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (annQ.data && !loaded) {
      const a = annQ.data;
      setTitle(a.title ?? '');
      setContent(a.content ?? '');
      setPriority(a.priority ?? 'normal');
      setAudience(a.audience ?? 'all');
      setStartsAt(a.starts_at ?? '');
      setEndsAt(a.ends_at ?? '');
      setPinned(a.is_pinned ?? false);
      setPublished(a.is_published ?? true);
      setLoaded(true);
    }
  }, [annQ.data, loaded]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Partial<Announcement> = {
        title: title.trim(),
        content: content.trim(),
        priority,
        audience,
        starts_at: startsAt.trim() || null,
        ends_at: endsAt.trim() || null,
        is_pinned: pinned,
        is_published: published,
      };
      return isEdit ? governanceApi.updateAnnouncement(editId!, payload) : governanceApi.createAnnouncement(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'announcements'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['bureau', 'announcement', editId] });
      Alert.alert(isEdit ? 'Annonce modifiée' : 'Annonce enregistrée', published ? 'L’annonce est publiée.' : 'L’annonce est enregistrée en brouillon.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  if (isEdit && annQ.isLoading) {
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
          <TextField label="Titre *" value={title} onChangeText={setTitle} placeholder="Réunion exceptionnelle…" />
          <TextField label="Message *" value={content} onChangeText={setContent} placeholder="Détails de l'annonce…" multiline />

          <Text style={styles.label}>Priorité</Text>
          <ChipSelect options={PRIORITIES} value={priority} onChange={setPriority} />

          <Text style={styles.label}>Public</Text>
          <ChipSelect options={AUDIENCES} value={audience} onChange={setAudience} />

          <DateTimeField label="Publication (optionnel)" value={startsAt} onChangeText={setStartsAt} />
          <DateTimeField label="Expiration (optionnel)" value={endsAt} onChangeText={setEndsAt} />

          <Check on={pinned} label="Épingler en haut" onToggle={() => setPinned((v) => !v)} />
          <Check on={published} label="Publier (sinon brouillon)" onToggle={() => setPublished((v) => !v)} />

          <PrimaryButton
            title={isEdit ? 'Enregistrer' : published ? 'Publier' : 'Enregistrer le brouillon'}
            onPress={() => saveMut.mutate()}
            loading={saveMut.isPending}
            disabled={!title.trim() || !content.trim()}
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
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  checkLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
});
