import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, IconBubble, PrimaryButton, OutlineButton } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import type { BureauStackParamList } from '../../navigation/types';
import { cyclesApi } from '../../lib/api/cycles';
import { sessionsApi } from '../../lib/api/sessions';
import { useApprovalAction } from '../../lib/hooks/use-approval-action';
import { cycleStatus, sessionStatus } from '../../lib/bureau/cycle-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauCycleDetail'>;
type Rt = RouteProp<BureauStackParamList, 'BureauCycleDetail'>;

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauCycleDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { id } = useRoute<Rt>().params;
  const qc = useQueryClient();

  const cycleQ = useQuery({ queryKey: ['bureau', 'cycle', id], queryFn: () => cyclesApi.get(id) });
  const statsQ = useQuery({
    queryKey: ['bureau', 'cycle', id, 'stats'],
    queryFn: () => cyclesApi.sessionsStats(id),
    retry: false,
  });
  const sessionsQ = useQuery({
    queryKey: ['bureau', 'cycle', id, 'sessions'],
    queryFn: () => sessionsApi.list({ cycle: id }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bureau', 'cycle', id] });
    qc.invalidateQueries({ queryKey: ['bureau', 'cycles'] });
  };

  const generateMut = useMutation({
    mutationFn: () => cyclesApi.generateSessions(id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['bureau', 'cycle', id, 'sessions'] });
      Alert.alert('Séances générées', `${r.created} créée(s), ${r.skipped} ignorée(s).`);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const closeMut = useApprovalAction({
    onSuccess: (req) => {
      invalidate();
      Alert.alert('Demande envoyée', 'La clôture du cycle a été soumise (triple validation).', [
        { text: 'Voir', onPress: () => navigation.navigate('BureauApprovalDetail', { id: req.id }) },
        { text: 'OK' },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  if (cycleQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }
  const c = cycleQ.data;
  if (!c) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.muted}>Cycle introuvable.</Text>
      </SafeAreaView>
    );
  }

  const st = cycleStatus(c.status);
  const stats = statsQ.data;
  const sessions = sessionsQ.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cycleQ.isRefetching || sessionsQ.isRefetching}
            onRefresh={() => {
              cycleQ.refetch();
              statsQ.refetch();
              sessionsQ.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Card style={styles.headCard}>
          <View style={styles.headRow}>
            <IconBubble icon="reload-circle" tint="primary" size={44} />
            <View style={styles.flex}>
              <Text style={styles.title}>{c.name}</Text>
              <Text style={styles.sub}>Début {formatDateFr(c.start_date, false)}</Text>
            </View>
            <StatusChip label={st.label} tone={st.tone} />
          </View>
        </Card>

        {/* Stats */}
        {stats ? (
          <Card style={styles.statsCard}>
            <Stat value={String(stats.total_sessions ?? sessions.length)} label="Séances" />
            <View style={styles.statDivider} />
            <Stat value={String(stats.completed_sessions ?? 0)} label="Terminées" />
            <View style={styles.statDivider} />
            <Stat value={`${Math.round(stats.progress_percent ?? 0)}%`} label="Progression" />
          </Card>
        ) : null}

        {/* Actions cycle */}
        <RequirePermission bureau>
          <View style={{ gap: spacing.sm }}>
            <OutlineButton
              title="Générer les séances"
              onPress={() => generateMut.mutate()}
              loading={generateMut.isPending}
            />
            <OutlineButton
              title="Nouvelle séance"
              onPress={() => navigation.navigate('BureauSessionCreate', { cycleId: id })}
            />
            {c.status === 'active' ? (
              <PrimaryButton
                title="Clôturer le cycle"
                loading={closeMut.isPending}
                onPress={() =>
                  Alert.alert('Clôturer le cycle', 'Soumettre la clôture à validation du bureau ?', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Confirmer',
                      onPress: () =>
                        closeMut.mutate({
                          action: 'cycle.close',
                          targetId: id,
                          reason: 'Clôture du cycle via l’application mobile',
                        }),
                    },
                  ])
                }
              />
            ) : null}
          </View>
        </RequirePermission>

        {/* Séances */}
        <Text style={styles.sectionLabel}>Séances</Text>
        {sessionsQ.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : sessions.length === 0 ? (
          <Text style={styles.muted}>Aucune séance. Utilisez « Générer les séances ».</Text>
        ) : (
          sessions.map((s) => {
            const ss = sessionStatus(s.status);
            return (
              <Pressable key={s.id} style={styles.row} onPress={() => navigation.navigate('BureauSessionDetail', { id: s.id })}>
                <IconBubble icon="calendar" tint="lime" size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>Séance {s.session_number}</Text>
                  <Text style={styles.rowSub}>
                    {formatDateFr(s.date, false)}
                    {s.location ? ` · ${s.location}` : ''}
                  </Text>
                </View>
                <StatusChip label={ss.label} tone={ss.tone} />
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  muted: { color: colors.textMuted, fontSize: font.size.sm, textAlign: 'center', marginTop: spacing.lg },

  headCard: {},
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  sub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },

  statsCard: { flexDirection: 'row', borderRadius: radius.lg, paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.primary },
  statLabel: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.surfaceAlt },

  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    ...cardShadow,
  },
  rowTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
});
