import React, { useLayoutEffect, useState } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import ActionBtn from '../../components/bureau/ActionBtn';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { membersApi } from '../../lib/api/members';
import type { MembershipStatus } from '../../lib/types/member';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauMembers'>;
type TabKey = 'members' | 'requests' | 'resignations' | 'bureau';

const MEMBER_STATUS: Record<MembershipStatus, { label: string; tone: StatusTone }> = {
  active: { label: 'Actif', tone: 'success' },
  pending: { label: 'En attente', tone: 'warning' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  expelled: { label: 'Exclu', tone: 'danger' },
  resigned: { label: 'Démissionnaire', tone: 'muted' },
};

function errMsg(e: any): string {
  return (
    e?.response?.data?.detail ??
    e?.response?.data?.error ??
    'Action impossible pour le moment.'
  );
}

export default function BureauMembersScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('members');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('BureauInvitations')} hitSlop={8}>
          <Ionicons name="person-add" size={22} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  const membersQ = useQuery({
    queryKey: ['bureau', 'members', 'list'],
    queryFn: () => membersApi.list(),
    enabled: tab === 'members',
  });
  const requestsQ = useQuery({
    queryKey: ['bureau', 'membership-requests', 'pending'],
    queryFn: () => membersApi.membershipRequests({ status: 'pending' }),
    retry: false,
  });
  const resignationsQ = useQuery({
    queryKey: ['bureau', 'resignations', 'all'],
    queryFn: () => membersApi.resignations(),
    retry: false,
  });
  const bureauQ = useQuery({
    queryKey: ['bureau', 'bureau-members', 'active'],
    queryFn: () => membersApi.bureauMembers({ is_active: true }),
    enabled: tab === 'bureau',
  });

  const pendingResignations = (resignationsQ.data ?? []).filter((r) => r.status === 'pending');

  // ----- Mutations -----
  const invalidate = (keys: string[][]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const approveReq = useMutation({
    mutationFn: (id: string) => membersApi.approveMembershipRequest(id),
    onSuccess: () =>
      invalidate([
        ['bureau', 'membership-requests', 'pending'],
        ['bureau', 'members', 'list'],
      ]),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const rejectReq = useMutation({
    mutationFn: (id: string) => membersApi.rejectMembershipRequest(id),
    onSuccess: () => invalidate([['bureau', 'membership-requests', 'pending']]),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const approveResig = useMutation({
    mutationFn: (id: string) => membersApi.approveResignation(id),
    onSuccess: () => invalidate([['bureau', 'resignations', 'all']]),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const rejectResig = useMutation({
    mutationFn: (id: string) => membersApi.rejectResignation(id),
    onSuccess: () => invalidate([['bureau', 'resignations', 'all']]),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const tabs = [
    { key: 'members', label: 'Membres' },
    { key: 'requests', label: 'Demandes', badge: requestsQ.data?.length ?? 0 },
    { key: 'resignations', label: 'Démissions', badge: pendingResignations.length },
    { key: 'bureau', label: 'Bureau' },
  ];

  const refreshing =
    membersQ.isRefetching ||
    requestsQ.isRefetching ||
    resignationsQ.isRefetching ||
    bureauQ.isRefetching;
  const onRefresh = () => {
    membersQ.refetch();
    requestsQ.refetch();
    resignationsQ.refetch();
    bureauQ.refetch();
  };

  const loading =
    (tab === 'members' && membersQ.isLoading) ||
    (tab === 'requests' && requestsQ.isLoading) ||
    (tab === 'resignations' && resignationsQ.isLoading) ||
    (tab === 'bureau' && bureauQ.isLoading);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabsWrap}>
        <TabsRow tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x3 }} />
        ) : null}

        {/* ---- Membres ---- */}
        {tab === 'members' && !membersQ.isLoading
          ? (membersQ.data ?? []).map((m) => {
              const st = MEMBER_STATUS[m.status] ?? MEMBER_STATUS.pending;
              return (
                <Pressable
                  key={m.id}
                  style={styles.row}
                  onPress={() => navigation.navigate('BureauMemberDetail', { id: m.id })}
                >
                  <IconBubble icon="person" tint="lime" size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{m.user_name}</Text>
                    <Text style={styles.rowSub}>
                      {m.bureau_position ?? 'Membre'} · #{m.member_number}
                    </Text>
                  </View>
                  <StatusChip label={st.label} tone={st.tone} />
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </Pressable>
              );
            })
          : null}
        {tab === 'members' && !membersQ.isLoading && (membersQ.data ?? []).length === 0 ? (
          <Empty icon="people" text="Aucun membre." />
        ) : null}

        {/* ---- Demandes d'adhésion ---- */}
        {tab === 'requests' && !requestsQ.isLoading
          ? (requestsQ.data ?? []).map((r) => (
              <View key={r.id} style={styles.row}>
                <IconBubble icon="mail-unread" tint="accent" size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>
                    {r.user?.first_name} {r.user?.last_name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {r.motivation?.trim() ? r.motivation : r.contact_phone || 'Demande d’adhésion'}
                  </Text>
                </View>
                <ActionBtn
                  icon="checkmark"
                  tone="success"
                  loading={approveReq.isPending && approveReq.variables === r.id}
                  onPress={() => approveReq.mutate(r.id)}
                />
                <ActionBtn
                  icon="close"
                  tone="danger"
                  loading={rejectReq.isPending && rejectReq.variables === r.id}
                  onPress={() => rejectReq.mutate(r.id)}
                />
              </View>
            ))
          : null}
        {tab === 'requests' && !requestsQ.isLoading && (requestsQ.data ?? []).length === 0 ? (
          <Empty icon="mail-open" text="Aucune demande en attente." />
        ) : null}

        {/* ---- Démissions ---- */}
        {tab === 'resignations' && !resignationsQ.isLoading
          ? (resignationsQ.data ?? []).map((r) => {
              const isPending = r.status === 'pending';
              return (
                <View key={r.id} style={styles.row}>
                  <IconBubble icon="exit" tint="danger" size={40} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{r.membership?.user_name ?? 'Membre'}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {r.reason?.trim() ? r.reason : 'Demande de démission'}
                    </Text>
                  </View>
                  {isPending ? (
                    <>
                      <ActionBtn
                        icon="checkmark"
                        tone="success"
                        loading={approveResig.isPending && approveResig.variables === r.id}
                        onPress={() => approveResig.mutate(r.id)}
                      />
                      <ActionBtn
                        icon="close"
                        tone="danger"
                        loading={rejectResig.isPending && rejectResig.variables === r.id}
                        onPress={() => rejectResig.mutate(r.id)}
                      />
                    </>
                  ) : (
                    <StatusChip
                      label={r.status_display ?? r.status}
                      tone={r.status === 'approved' ? 'success' : 'muted'}
                    />
                  )}
                </View>
              );
            })
          : null}
        {tab === 'resignations' && !resignationsQ.isLoading && (resignationsQ.data ?? []).length === 0 ? (
          <Empty icon="exit-outline" text="Aucune démission." />
        ) : null}

        {/* ---- Bureau ---- */}
        {tab === 'bureau' && !bureauQ.isLoading
          ? (bureauQ.data ?? []).map((b) => (
              <View key={b.id} style={styles.row}>
                <IconBubble icon="ribbon" tint="primary" size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{b.position?.name ?? 'Poste'}</Text>
                  <Text style={styles.rowSub}>
                    {b.membership?.user_name ?? '—'}
                    {b.start_date ? ` · depuis ${timeAgo(b.start_date)}` : ''}
                  </Text>
                </View>
                <StatusChip label="Actif" tone="success" />
              </View>
            ))
          : null}
        {tab === 'bureau' && !bureauQ.isLoading && (bureauQ.data ?? []).length === 0 ? (
          <Empty icon="ribbon-outline" text="Aucun poste attribué pour ce cycle." />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
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
  tabsWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },
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
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
