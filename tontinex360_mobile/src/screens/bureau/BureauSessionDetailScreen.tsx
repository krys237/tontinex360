import React, { useState } from 'react';
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

import { Card, TextField, IconBubble, PrimaryButton, OutlineButton, SoftButton } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import TabsRow from '../../components/bureau/TabsRow';
import RequirePermission from '../../components/bureau/RequirePermission';
import type { BureauStackParamList } from '../../navigation/types';
import type { AttendanceStatus, SessionAttendance } from '../../lib/types/cycle';
import { sessionsApi } from '../../lib/api/sessions';
import { potsApi } from '../../lib/api/pots';
import { cyclesApi } from '../../lib/api/cycles';
import { membersApi } from '../../lib/api/members';
import { useApprovalAction } from '../../lib/hooks/use-approval-action';
import { sessionStatus, ATTENDANCE } from '../../lib/bureau/cycle-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr, formatXAF } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauSessionDetail'>;
type Rt = RouteProp<BureauStackParamList, 'BureauSessionDetail'>;
type TabKey = 'attendance' | 'pots' | 'reports';

const QUICK: { status: AttendanceStatus; icon: any }[] = [
  { status: 'present', icon: 'checkmark' },
  { status: 'absent', icon: 'close' },
  { status: 'excused', icon: 'help' },
];

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauSessionDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { id } = useRoute<Rt>().params;
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('attendance');
  const [reportContent, setReportContent] = useState('');

  const sessionQ = useQuery({ queryKey: ['bureau', 'session', id], queryFn: () => sessionsApi.get(id) });
  const membersQ = useQuery({ queryKey: ['bureau', 'members', 'list'], queryFn: () => membersApi.list() });
  const attQ = useQuery({ queryKey: ['bureau', 'session', id, 'attendances'], queryFn: () => sessionsApi.attendances(id) });
  const potsQ = useQuery({ queryKey: ['bureau', 'session', id, 'pots'], queryFn: () => potsApi.list({ session: id }) });
  const reportsQ = useQuery({ queryKey: ['bureau', 'session', id, 'reports'], queryFn: () => sessionsApi.reports(id), enabled: tab === 'reports', retry: false });
  const cycleId = sessionQ.data?.cycle;
  const configsQ = useQuery({ queryKey: ['bureau', 'cycle', cycleId, 'configs'], queryFn: () => cyclesApi.configs(cycleId!), enabled: !!cycleId });

  const attByMember = new Map<string, SessionAttendance>();
  (attQ.data ?? []).forEach((a) => attByMember.set(a.membership, a));
  const presentCount = (attQ.data ?? []).filter((a) => a.status === 'present').length;
  const totalMembers = (membersQ.data ?? []).length;

  const setAtt = useMutation({
    mutationFn: (vars: { membership: string; status: AttendanceStatus }) => {
      const existing = attByMember.get(vars.membership);
      return existing
        ? sessionsApi.updateAttendance(existing.id, { status: vars.status })
        : sessionsApi.setAttendance({ session: id, membership: vars.membership, status: vars.status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'session', id, 'attendances'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const openPotMut = useMutation({
    mutationFn: (tontineTypeId: string) => potsApi.openPot(id, { tontine_type_id: tontineTypeId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'session', id, 'pots'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const createReportMut = useMutation({
    mutationFn: (publish: boolean) => sessionsApi.createReport({ session: id, content: reportContent.trim(), publish }),
    onSuccess: () => {
      setReportContent('');
      qc.invalidateQueries({ queryKey: ['bureau', 'session', id, 'reports'] });
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const togglePublishMut = useMutation({
    mutationFn: (vars: { reportId: string; publish: boolean }) =>
      vars.publish ? sessionsApi.publishReport(vars.reportId) : sessionsApi.unpublishReport(vars.reportId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'session', id, 'reports'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const closeMut = useMutation({
    mutationFn: () => sessionsApi.closeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'session', id] });
      Alert.alert('Séance clôturée', 'Le rapport final a été généré.');
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const cancelMut = useApprovalAction({
    onSuccess: (req) =>
      Alert.alert('Demande envoyée', 'L’annulation de la séance a été soumise (triple validation).', [
        { text: 'Voir', onPress: () => navigation.navigate('BureauApprovalDetail', { id: req.id }) },
        { text: 'OK' },
      ]),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  if (sessionQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }
  const s = sessionQ.data;
  if (!s) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.muted}>Séance introuvable.</Text>
      </SafeAreaView>
    );
  }

  const st = sessionStatus(s.status);
  const openTypeIds = new Set((potsQ.data ?? []).map((p) => p.tontine_type));
  const openableConfigs = (configsQ.data ?? []).filter((cfg) => !openTypeIds.has(cfg.tontine_type));
  const isClosable = s.status === 'scheduled' || s.status === 'in_progress';

  const tabs = [
    { key: 'attendance', label: 'Présences' },
    { key: 'pots', label: 'Cagnottes', badge: (potsQ.data ?? []).length || undefined },
    { key: 'reports', label: 'Procès-verbaux' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={attQ.isRefetching || potsQ.isRefetching}
            onRefresh={() => {
              attQ.refetch();
              potsQ.refetch();
              reportsQ.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* En-tête */}
        <Card style={styles.headCard}>
          <View style={styles.headRow}>
            <View style={styles.flex}>
              <Text style={styles.title}>
                {s.session_number != null ? `Séance n°${s.session_number}` : `Séance du ${formatDateFr(s.date, false)}`}
              </Text>
              <Text style={styles.sub}>📅 {formatDateFr(s.date, false)}{s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ''}</Text>
              {s.location ? <Text style={styles.sub}>📍 {s.location}</Text> : null}
              <Text style={styles.sub}>👥 {presentCount}/{totalMembers} présents</Text>
            </View>
            <StatusChip label={st.label} tone={st.tone} />
          </View>

          {isClosable ? (
            <RequirePermission bureau>
              <View style={styles.actionsRow}>
                <PrimaryButton title="Clôturer" onPress={() => closeMut.mutate()} loading={closeMut.isPending} style={styles.flex} />
                <OutlineButton
                  title="Annuler"
                  loading={cancelMut.isPending}
                  style={styles.flex}
                  onPress={() =>
                    Alert.alert('Annuler la séance', 'Soumettre l’annulation à validation du bureau ?', [
                      { text: 'Non', style: 'cancel' },
                      { text: 'Oui', onPress: () => cancelMut.mutate({ action: 'session.cancel', targetId: id, reason: 'Annulation de la séance via l’application mobile' }) },
                    ])
                  }
                />
              </View>
            </RequirePermission>
          ) : null}
        </Card>

        {/* Onglets */}
        <TabsRow tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />

        {/* ---- Présences ---- */}
        {tab === 'attendance' ? (
          <Card style={styles.attCard}>
            {membersQ.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              (membersQ.data ?? []).map((m, i) => {
                const rec = attByMember.get(m.id);
                const tone = rec ? ATTENDANCE[rec.status]?.tone : 'muted';
                return (
                  <View key={m.id} style={[styles.attRow, i > 0 && styles.divider]}>
                    <View style={styles.flex}>
                      <Text style={styles.attName} numberOfLines={1}>{m.user_name}</Text>
                      <Text style={styles.attNum}>#{m.member_number}</Text>
                    </View>
                    {rec ? <StatusChip label={ATTENDANCE[rec.status]?.label ?? rec.status} tone={tone} /> : null}
                    <View style={styles.quick}>
                      {QUICK.map((q) => {
                        const on = rec?.status === q.status;
                        return (
                          <Pressable key={q.status} onPress={() => setAtt.mutate({ membership: m.id, status: q.status })} style={[styles.quickBtn, on && styles.quickOn]}>
                            <Ionicons name={q.icon} size={15} color={on ? colors.white : colors.textMuted} />
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        ) : null}

        {/* ---- Cagnottes ---- */}
        {tab === 'pots' ? (
          <>
            {(potsQ.data ?? []).map((p) => (
              <Pressable key={p.id} style={styles.row} onPress={() => navigation.navigate('BureauPotDetail', { id: p.id })}>
                <IconBubble icon="cube" tint={p.is_closed ? 'lime' : 'accent'} size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{p.tontine_name}</Text>
                  <Text style={styles.rowSub}>{formatXAF(p.total_available)} · {p.method_display}</Text>
                </View>
                <StatusChip label={p.is_closed ? 'Fermée' : 'Ouverte'} tone={p.is_closed ? 'muted' : 'success'} />
              </Pressable>
            ))}
            <RequirePermission bureau>
              {openableConfigs.map((cfg) => (
                <Pressable key={cfg.id} style={[styles.row, styles.dashed]} onPress={() => openPotMut.mutate(cfg.tontine_type)}>
                  <IconBubble icon="add-circle" tint="lime" size={40} />
                  <Text style={styles.openText}>Ouvrir la cagnotte — {cfg.tontine_name}</Text>
                </Pressable>
              ))}
            </RequirePermission>
            {(potsQ.data ?? []).length === 0 && openableConfigs.length === 0 ? <Text style={styles.muted}>Aucune cagnotte.</Text> : null}
          </>
        ) : null}

        {/* ---- Procès-verbaux ---- */}
        {tab === 'reports' ? (
          <>
            <RequirePermission bureau>
              <Card style={styles.card}>
                <Text style={styles.formTitle}>Nouveau procès-verbal</Text>
                <TextField label="Contenu" value={reportContent} onChangeText={setReportContent} placeholder="Compte-rendu de la séance…" multiline />
                <View style={styles.actionsRow}>
                  <OutlineButton title="Brouillon" onPress={() => createReportMut.mutate(false)} loading={createReportMut.isPending} style={styles.flex} disabled={reportContent.trim().length < 3} />
                  <PrimaryButton title="Publier" onPress={() => createReportMut.mutate(true)} loading={createReportMut.isPending} style={styles.flex} disabled={reportContent.trim().length < 3} />
                </View>
              </Card>
            </RequirePermission>

            {reportsQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
            ) : (reportsQ.data ?? []).length === 0 ? (
              <Text style={styles.muted}>Aucun procès-verbal.</Text>
            ) : (
              (reportsQ.data ?? []).map((r) => (
                <Card key={r.id} style={styles.card}>
                  <View style={styles.reportHead}>
                    <Text style={styles.reportTitle}>{r.title?.trim() ? r.title : `PV — Séance n°${r.session_number}`}</Text>
                    <StatusChip label={r.is_published ? 'Publié' : 'Brouillon'} tone={r.is_published ? 'success' : 'muted'} />
                  </View>
                  <Text style={styles.reportContent} numberOfLines={4}>{r.content}</Text>
                  <Text style={styles.reportMeta}>{r.author_name} · {formatDateFr(r.created_at, false)}</Text>
                  <RequirePermission bureau>
                    <SoftButton
                      title={r.is_published ? 'Dépublier' : 'Publier'}
                      onPress={() => togglePublishMut.mutate({ reportId: r.id, publish: !r.is_published })}
                      style={styles.publishBtn}
                    />
                  </RequirePermission>
                </Card>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  muted: { color: colors.textMuted, fontSize: font.size.sm, textAlign: 'center', paddingVertical: spacing.md },

  headCard: { gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  sub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },

  sectionLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...cardShadow },
  dashed: { borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', shadowOpacity: 0, elevation: 0 },
  openText: { flex: 1, fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },
  rowTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },

  attCard: { borderRadius: radius.lg, paddingVertical: 4 },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  attName: { fontSize: font.size.sm, fontWeight: font.medium, color: colors.text },
  attNum: { fontSize: font.size.xs, color: colors.textLight, marginTop: 1 },
  divider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  quick: { flexDirection: 'row', gap: 6 },
  quickBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  quickOn: { backgroundColor: colors.primary },

  card: { borderRadius: radius.lg, gap: spacing.xs },
  formTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginBottom: spacing.xs },
  reportHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reportTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, flex: 1 },
  reportContent: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 4 },
  reportMeta: { fontSize: font.size.xs, color: colors.textLight, marginTop: 4 },
  publishBtn: { minHeight: 40, marginTop: spacing.sm },
});
