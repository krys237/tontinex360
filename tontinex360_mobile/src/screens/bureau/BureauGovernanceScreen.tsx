import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import ActionBtn from '../../components/bureau/ActionBtn';
import RequirePermission from '../../components/bureau/RequirePermission';
import { IconBubble } from '../../components/ui';
import type { BubbleTint } from '../../components/ui/IconBubble';
import type { BureauStackParamList } from '../../navigation/types';
import { governanceApi, type PollStatus } from '../../lib/api/governance';
import { membersApi } from '../../lib/api/members';
import { approvalsApi } from '../../lib/api/approvals';
import { sanctionsApi } from '../../lib/api/sanctions';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { timeAgo } from '../../lib/utils/format';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauGovernance'>;
type TabKey = 'announcements' | 'polls' | 'elections' | 'documents' | 'moderation';

const POLL_TONE: Record<PollStatus, StatusTone> = { draft: 'muted', open: 'success', closed: 'info', cancelled: 'danger' };
const ELECTION_TONE: Record<string, StatusTone> = { planned: 'muted', in_progress: 'warning', completed: 'success', cancelled: 'danger' };

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauGovernanceScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('announcements');

  // Données natives (partagées avec les onglets via les mêmes queryKeys)
  const annQ = useQuery({ queryKey: ['bureau', 'announcements'], queryFn: () => governanceApi.announcements(), enabled: tab === 'announcements' });
  const pollsQ = useQuery({ queryKey: ['bureau', 'polls'], queryFn: () => governanceApi.polls() });
  const elecQ = useQuery({ queryKey: ['bureau', 'elections'], queryFn: () => governanceApi.elections() });
  const docsQ = useQuery({ queryKey: ['bureau', 'documents'], queryFn: () => governanceApi.documents(), enabled: tab === 'documents' });

  // Données « à traiter »
  const requestsQ = useQuery({ queryKey: ['bureau', 'membership-requests', 'pending'], queryFn: () => membersApi.membershipRequests({ status: 'pending' }), retry: false });
  const resignQ = useQuery({ queryKey: ['bureau', 'resignations'], queryFn: () => membersApi.resignations(), retry: false });
  const approvalsQ = useQuery({ queryKey: ['bureau', 'approvals', 'pending'], queryFn: () => approvalsApi.list({ status: 'pending' }), retry: false });
  const sanctionsQ = useQuery({ queryKey: ['bureau', 'sanctions'], queryFn: () => sanctionsApi.list(), retry: false });

  const pendingResignations = (resignQ.data ?? []).filter((r) => r.status === 'pending');
  const pendingSanctions = (sanctionsQ.data ?? []).filter((s) => s.status === 'pending');
  const openPolls = (pollsQ.data ?? []).filter((p) => p.status === 'open');
  const runningElections = (elecQ.data ?? []).filter((e) => e.status === 'in_progress');

  const counters = useMemo(
    () => [
      { key: 'admissions', icon: 'person-add' as IoniconName, tint: 'lime' as BubbleTint, label: 'Admissions', value: requestsQ.data?.length ?? 0, onPress: () => setTab('moderation') },
      { key: 'resignations', icon: 'exit' as IoniconName, tint: 'accent' as BubbleTint, label: 'Démissions', value: pendingResignations.length, onPress: () => setTab('moderation') },
      { key: 'approvals', icon: 'checkmark-done-circle' as IoniconName, tint: 'primary' as BubbleTint, label: 'Approbations', value: approvalsQ.data?.length ?? 0, onPress: () => navigation.navigate('BureauApprovals') },
      { key: 'sanctions', icon: 'warning' as IoniconName, tint: 'danger' as BubbleTint, label: 'Sanctions', value: pendingSanctions.length, onPress: () => navigation.navigate('BureauSanctions') },
      { key: 'polls', icon: 'bar-chart' as IoniconName, tint: 'info' as BubbleTint, label: 'Sondages ouverts', value: openPolls.length, onPress: () => setTab('polls') },
      { key: 'elections', icon: 'podium' as IoniconName, tint: 'lime' as BubbleTint, label: 'Élections en cours', value: runningElections.length, onPress: () => setTab('elections') },
    ],
    [requestsQ.data, pendingResignations.length, approvalsQ.data, pendingSanctions.length, openPolls.length, runningElections.length],
  );

  // Mutations modération
  const approveReq = useMutation({ mutationFn: (id: string) => membersApi.approveMembershipRequest(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'membership-requests', 'pending'] }), onError: (e) => Alert.alert('Erreur', errMsg(e)) });
  const rejectReq = useMutation({ mutationFn: (id: string) => membersApi.rejectMembershipRequest(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'membership-requests', 'pending'] }), onError: (e) => Alert.alert('Erreur', errMsg(e)) });
  const approveResign = useMutation({ mutationFn: (id: string) => membersApi.approveResignation(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'resignations'] }), onError: (e) => Alert.alert('Erreur', errMsg(e)) });
  const rejectResign = useMutation({ mutationFn: (id: string) => membersApi.rejectResignation(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'resignations'] }), onError: (e) => Alert.alert('Erreur', errMsg(e)) });
  const deleteDoc = useMutation({ mutationFn: (id: string) => governanceApi.removeDocument(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'documents'] }), onError: (e) => Alert.alert('Erreur', errMsg(e)) });

  const tabs = [
    { key: 'announcements', label: 'Annonces' },
    { key: 'polls', label: 'Sondages' },
    { key: 'elections', label: 'Élections' },
    { key: 'documents', label: 'Documents' },
    { key: 'moderation', label: 'Modération' },
  ];
  const activeQ = tab === 'announcements' ? annQ : tab === 'polls' ? pollsQ : tab === 'elections' ? elecQ : tab === 'documents' ? docsQ : requestsQ;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={activeQ.isRefetching} onRefresh={() => activeQ.refetch()} tintColor={colors.primary} />}
      >
        {/* Hero */}
        <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTitle}>Gouvernance de la réunion</Text>
          <Text style={styles.heroSub}>Pilotez admissions, démissions, élections, sondages, annonces, documents et approbations depuis un seul endroit.</Text>
        </LinearGradient>

        {/* Centre « À traiter » */}
        <Text style={styles.sectionTitle}>À traiter</Text>
        <View style={styles.counterGrid}>
          {counters.map((c) => (
            <Pressable key={c.key} style={styles.counter} onPress={c.onPress}>
              <View style={styles.counterTop}>
                <IconBubble icon={c.icon} tint={c.tint} size={32} />
                <Text style={styles.counterValue}>{c.value}</Text>
              </View>
              <Text style={styles.counterLabel}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Onglets */}
        <View style={styles.tabsInline}>
          <TabsRow tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
        </View>

        {/* ---- Annonces ---- */}
        {tab === 'announcements' ? (
          <>
            <RequirePermission bureau>
              <AddBtn label="Publier une annonce" onPress={() => navigation.navigate('BureauAnnouncementForm')} />
            </RequirePermission>
            {annQ.isLoading ? <Loader /> : (annQ.data ?? []).length === 0 ? <Empty icon="megaphone-outline" text="Aucune annonce." /> :
              (annQ.data ?? []).map((a) => (
                <Pressable key={a.id} style={styles.row} onPress={() => navigation.navigate('BureauAnnouncementDetail', { id: a.id })}>
                  <IconBubble icon="megaphone" tint={a.is_pinned ? 'accent' : 'lime'} size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>{a.content}</Text>
                  </View>
                  <Text style={styles.meta}>{timeAgo(a.created_at)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </Pressable>
              ))}
          </>
        ) : null}

        {/* ---- Sondages ---- */}
        {tab === 'polls' ? (
          <>
            <RequirePermission bureau>
              <AddBtn label="Nouveau sondage" onPress={() => navigation.navigate('BureauPollForm')} />
            </RequirePermission>
            {pollsQ.isLoading ? <Loader /> : (pollsQ.data ?? []).length === 0 ? <Empty icon="bar-chart-outline" text="Aucun sondage." /> :
              (pollsQ.data ?? []).map((p) => (
                <Pressable key={p.id} style={styles.row} onPress={() => navigation.navigate('BureauPollDetail', { id: p.id })}>
                  <IconBubble icon="bar-chart" tint="info" size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.rowSub}>{p.total_votes ?? 0} vote(s)</Text>
                  </View>
                  <StatusChip label={p.status_display ?? p.status} tone={POLL_TONE[p.status] ?? 'muted'} />
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </Pressable>
              ))}
          </>
        ) : null}

        {/* ---- Élections ---- */}
        {tab === 'elections' ? (
          <>
            <RequirePermission bureau>
              <AddBtn label="Nouvelle élection" onPress={() => navigation.navigate('BureauElectionForm')} />
            </RequirePermission>
            {elecQ.isLoading ? <Loader /> : (elecQ.data ?? []).length === 0 ? <Empty icon="podium-outline" text="Aucune élection." /> :
              (elecQ.data ?? []).map((e) => (
                <Pressable key={e.id} style={styles.row} onPress={() => navigation.navigate('BureauElectionDetail', { id: e.id })}>
                  <IconBubble icon="podium" tint="lime" size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.rowSub}>{e.method === 'secret' ? 'Scrutin secret' : e.method}</Text>
                  </View>
                  <StatusChip label={e.status} tone={ELECTION_TONE[e.status] ?? 'muted'} />
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </Pressable>
              ))}
          </>
        ) : null}

        {/* ---- Documents ---- */}
        {tab === 'documents' ? (
          <>
            <RequirePermission bureau>
              <AddBtn label="Nouveau document" onPress={() => navigation.navigate('BureauDocumentForm')} />
            </RequirePermission>
            {docsQ.isLoading ? <Loader /> : (docsQ.data ?? []).length === 0 ? <Empty icon="folder-open-outline" text="Aucun document." /> :
              (docsQ.data ?? []).map((d) => (
                <Pressable key={d.id} style={styles.row} onPress={() => navigation.navigate('BureauDocumentDetail', { id: d.id })}>
                  <IconBubble icon="document-text" tint="accent" size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{d.title}</Text>
                    <Text style={styles.rowSub}>{d.doc_type} · v{d.version || '1'}</Text>
                  </View>
                  <RequirePermission bureau>
                    <ActionBtn icon="trash" tone="danger" loading={deleteDoc.isPending && deleteDoc.variables === d.id} onPress={() => deleteDoc.mutate(d.id)} />
                  </RequirePermission>
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </Pressable>
              ))}
          </>
        ) : null}

        {/* ---- Modération (admissions + démissions) ---- */}
        {tab === 'moderation' ? (
          <>
            <Text style={styles.subSection}>Demandes d'admission</Text>
            {requestsQ.isLoading ? <Loader /> : (requestsQ.data ?? []).length === 0 ? <Empty icon="person-add-outline" text="Aucune demande en attente." /> :
              (requestsQ.data ?? []).map((r) => (
                <View key={r.id} style={styles.modCard}>
                  <View style={styles.modHead}>
                    <IconBubble icon="person-add" tint="lime" size={36} />
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{r.user.first_name} {r.user.last_name}</Text>
                      {r.motivation ? <Text style={styles.rowSub} numberOfLines={2}>{r.motivation}</Text> : null}
                    </View>
                  </View>
                  <RequirePermission bureau>
                    <View style={styles.modActions}>
                      <SmallBtn label="Approuver" tone="primary" loading={approveReq.isPending && approveReq.variables === r.id} onPress={() => approveReq.mutate(r.id)} />
                      <SmallBtn label="Rejeter" tone="danger" loading={rejectReq.isPending && rejectReq.variables === r.id} onPress={() => rejectReq.mutate(r.id)} />
                    </View>
                  </RequirePermission>
                </View>
              ))}

            <Text style={[styles.subSection, { marginTop: spacing.md }]}>Démissions</Text>
            {resignQ.isLoading ? <Loader /> : pendingResignations.length === 0 ? <Empty icon="exit-outline" text="Aucune démission en attente." /> :
              pendingResignations.map((r) => (
                <View key={r.id} style={styles.modCard}>
                  <View style={styles.modHead}>
                    <IconBubble icon="exit" tint="accent" size={36} />
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{r.membership.user_name}</Text>
                      {r.reason ? <Text style={styles.rowSub} numberOfLines={2}>{r.reason}</Text> : null}
                    </View>
                  </View>
                  <RequirePermission bureau>
                    <View style={styles.modActions}>
                      <SmallBtn label="Approuver" tone="primary" loading={approveResign.isPending && approveResign.variables === r.id} onPress={() => approveResign.mutate(r.id)} />
                      <SmallBtn label="Rejeter" tone="danger" loading={rejectResign.isPending && rejectResign.variables === r.id} onPress={() => rejectResign.mutate(r.id)} />
                    </View>
                  </RequirePermission>
                </View>
              ))}
          </>
        ) : null}

        {/* Aller plus loin */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Aller plus loin</Text>
        <LinkRow icon="warning" tint="danger" title="Sanctions" desc="Appliquer & suivre les sanctions" onPress={() => navigation.navigate('BureauSanctions')} />
        <LinkRow icon="checkmark-done-circle" tint="primary" title="Approbations" desc="Valider les actions sensibles" onPress={() => navigation.navigate('BureauApprovals')} />
        <LinkRow icon="people" tint="lime" title="Présences" desc="Émargement par séance" onPress={() => navigation.navigate('BureauSessions')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function AddBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.addBtn} onPress={onPress}>
      <Ionicons name="add" size={18} color={colors.white} />
      <Text style={styles.addBtnText}>{label}</Text>
    </Pressable>
  );
}

function SmallBtn({ label, tone, loading, onPress }: { label: string; tone: 'primary' | 'danger'; loading?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.smallBtn, tone === 'danger' ? styles.smallBtnDanger : styles.smallBtnPrimary]} onPress={loading ? undefined : onPress}>
      {loading ? <ActivityIndicator size="small" color={tone === 'danger' ? colors.danger : colors.white} /> : (
        <Text style={[styles.smallBtnText, tone === 'danger' ? styles.smallBtnTextDanger : styles.smallBtnTextPrimary]}>{label}</Text>
      )}
    </Pressable>
  );
}

function LinkRow({ icon, tint, title, desc, onPress }: { icon: IoniconName; tint: BubbleTint; title: string; desc: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <IconBubble icon={icon} tint={tint} size={40} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
    </Pressable>
  );
}

function Loader() {
  return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />;
}
function Empty({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.empty}>
      <IconBubble icon={icon} tint="lime" size={56} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },

  hero: { borderRadius: radius.hero, padding: spacing.xl, gap: 4, backgroundColor: colors.primary, ...cardShadow },
  heroTitle: { color: colors.white, fontSize: font.size.xl, fontWeight: font.bold },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.size.sm },

  sectionTitle: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 4, marginTop: spacing.xs },
  counterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  counter: { width: '31%', flexGrow: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, ...cardShadow },
  counterTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counterValue: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.text },
  counterLabel: { fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.semibold },

  tabsInline: { marginTop: spacing.md, marginBottom: spacing.xs },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 12, marginBottom: spacing.sm },
  addBtnText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...cardShadow },
  rowTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  meta: { fontSize: font.size.xs, color: colors.textLight },

  subSection: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text, marginLeft: 4 },
  modCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  modHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  modActions: { flexDirection: 'row', gap: spacing.sm },
  smallBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.pill, minHeight: 38 },
  smallBtnPrimary: { backgroundColor: colors.primary },
  smallBtnDanger: { backgroundColor: colors.dangerSoft },
  smallBtnText: { fontSize: font.size.sm, fontWeight: font.bold },
  smallBtnTextPrimary: { color: colors.white },
  smallBtnTextDanger: { color: colors.danger },

  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
