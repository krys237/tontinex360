import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import { Card, SoftButton } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { governanceApi, type Announcement } from '../../lib/api/governance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauAnnouncementDetail'>;
type Rt = RouteProp<BureauStackParamList, 'BureauAnnouncementDetail'>;

const PRIORITY: Record<Announcement['priority'], { label: string; tone: StatusTone }> = {
  low: { label: 'Basse', tone: 'muted' },
  normal: { label: 'Normale', tone: 'info' },
  high: { label: 'Haute', tone: 'warning' },
  urgent: { label: 'Urgente', tone: 'danger' },
};
const AUDIENCE: Record<Announcement['audience'], string> = {
  all: 'Tous les membres', active: 'Membres actifs', bureau: 'Bureau',
};

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauAnnouncementDetailScreen() {
  const id = useRoute<Rt>().params.id;
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['bureau', 'announcement', id], queryFn: () => governanceApi.getAnnouncement(id) });

  const removeMut = useMutation({
    mutationFn: () => governanceApi.removeAnnouncement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'announcements'] });
      navigation.goBack();
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const confirmRemove = () =>
    Alert.alert('Supprimer l’annonce', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeMut.mutate() },
    ]);

  const a = q.data;
  if (q.isLoading || !a) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }
  const prio = PRIORITY[a.priority] ?? PRIORITY.normal;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        <Card style={styles.card}>
          <View style={styles.head}>
            <StatusChip label={prio.label} tone={prio.tone} />
            {a.is_pinned ? (
              <View style={styles.pin}>
                <Ionicons name="pin" size={12} color={colors.goldAccent} />
                <Text style={styles.pinText}>Épinglée</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.title}>{a.title}</Text>
          <Text style={styles.meta}>
            {a.author_name ? `${a.author_name} · ` : ''}{formatDateFr(a.created_at, false)} · {AUDIENCE[a.audience] ?? ''}
          </Text>
          <Text style={styles.content}>{a.content}</Text>
        </Card>

        <RequirePermission bureau>
          <SoftButton title="Modifier l'annonce" onPress={() => navigation.navigate('BureauAnnouncementForm', { id })} />
          <SoftButton title="Supprimer l'annonce" onPress={confirmRemove} disabled={removeMut.isPending} style={styles.delBtn} />
        </RequirePermission>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pinText: { fontSize: font.size.xs, color: colors.goldAccent, fontWeight: font.semibold },
  title: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  meta: { fontSize: font.size.xs, color: colors.textLight, marginTop: 4 },
  content: { fontSize: font.size.md, color: colors.text, lineHeight: 22, marginTop: spacing.md },
  delBtn: { borderColor: colors.danger },
});
