import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import ActionBtn from '../../components/bureau/ActionBtn';
import KpiCard from '../../components/bureau/KpiCard';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { membersApi } from '../../lib/api/members';
import type { MembershipStatus } from '../../lib/types/member';
import { useDebounce } from '../../lib/hooks/use-debounce';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauMembers'>;
type TabKey = 'members' | 'requests' | 'resignations';

const MEMBER_STATUS: Record<MembershipStatus, { label: string; tone: StatusTone }> = {
  active: { label: 'Actif', tone: 'success' },
  pending: { label: 'En attente', tone: 'warning' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  expelled: { label: 'Exclu', tone: 'danger' },
  resigned: { label: 'Démissionnaire', tone: 'muted' },
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'pending', label: 'En attente' },
  { key: 'suspended', label: 'Suspendus' },
  { key: 'resigned', label: 'Démiss.' },
  { key: 'expelled', label: 'Exclus' },
];

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('BureauInvitations')} hitSlop={8}>
          <Ionicons name="person-add" size={22} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation]);

  // Liste filtrée (recherche + statut) affichée dans l'onglet Membres.
  const membersQ = useQuery({
    queryKey: ['bureau', 'members', 'list', debouncedSearch, statusFilter],
    queryFn: () =>
      membersApi.list({
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    enabled: tab === 'members',
  });
  // Tous les membres (sans filtre) pour les KPIs.
  const allMembersQ = useQuery({
    queryKey: ['bureau', 'members', 'all'],
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
  const pendingResignations = (resignationsQ.data ?? []).filter((r) => r.status === 'pending');

  // KPIs (basés sur l'ensemble des membres, sans filtre).
  const stats = useMemo(() => {
    const all = allMembersQ.data ?? [];
    const total = all.length;
    const active = all.filter((m) => m.status === 'active').length;
    const pending = all.filter((m) => m.status === 'pending').length;
    const suspended = all.filter((m) => m.status === 'suspended' || m.status === 'expelled').length;
    const presence = total > 0 ? Math.round((active / total) * 100) : null;
    return { total, active, pending, suspended, presence };
  }, [allMembersQ.data]);

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
  ];

  const refreshing =
    membersQ.isRefetching ||
    requestsQ.isRefetching ||
    resignationsQ.isRefetching;
  const onRefresh = () => {
    membersQ.refetch();
    allMembersQ.refetch();
    requestsQ.refetch();
    resignationsQ.refetch();
  };

  const loading =
    (tab === 'members' && membersQ.isLoading) ||
    (tab === 'requests' && requestsQ.isLoading) ||
    (tab === 'resignations' && resignationsQ.isLoading);

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
        {loading && tab !== 'members' ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x3 }} />
        ) : null}

        {/* ---- Membres ---- */}
        {tab === 'members' ? (
          <>
            {/* KPIs */}
            <View style={styles.kpiGrid}>
              <KpiCard icon="people" tint="lime" label="Membres actifs" value={stats.active} sublabel={`${stats.total} membres total`} />
              <KpiCard icon="checkmark-circle" tint="primary" label="Présence moyenne" value={stats.presence === null ? '—' : `${stats.presence}%`} sublabel="Actifs / total" />
              <KpiCard icon="time" tint="accent" label="Demandes" value={stats.pending} sublabel="À traiter" />
              <KpiCard icon="person-remove" tint="danger" label="Suspendus / exclus" value={stats.suspended} sublabel="Sanctionnés" />
            </View>

            {/* Actions secondaires */}
            <View style={styles.secondaryRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('BureauFeesOverview')}>
                <Ionicons name="cash-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryText}>Frais d'adhésion</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('BureauImport')}>
                <Ionicons name="document-attach-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryText}>Importer</Text>
              </Pressable>
            </View>

            {/* Ajouter un membre */}
            <Pressable style={styles.addBtn} onPress={() => navigation.navigate('BureauInvitations')}>
              <Ionicons name="person-add" size={18} color={colors.white} />
              <Text style={styles.addBtnText}>Ajouter un membre</Text>
            </Pressable>

            {/* Recherche */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher un membre…"
                placeholderTextColor={colors.placeholder}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textLight} />
                </Pressable>
              ) : null}
            </View>

            {/* Filtre statut */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {STATUS_FILTERS.map((f) => {
                const on = statusFilter === f.key;
                return (
                  <Pressable key={f.key || 'all'} onPress={() => setStatusFilter(f.key)} style={[styles.filterChip, on && styles.filterChipOn]}>
                    <Text style={[styles.filterText, on && styles.filterTextOn]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.listCount}>
              {(membersQ.data ?? []).length} membre{(membersQ.data ?? []).length > 1 ? 's' : ''}
            </Text>

            {membersQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
            ) : (membersQ.data ?? []).length === 0 ? (
              <Empty icon="people" text="Aucun membre ne correspond." />
            ) : (
              (membersQ.data ?? []).map((m) => {
                const st = MEMBER_STATUS[m.status] ?? MEMBER_STATUS.pending;
                const role = m.is_founder ? 'Fondateur' : m.bureau_position || 'Membre';
                return (
                  <Pressable
                    key={m.id}
                    style={styles.row}
                    onPress={() => navigation.navigate('BureauMemberDetail', { id: m.id })}
                  >
                    <LinearGradient colors={[colors.green[500], colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(m.user_name)}</Text>
                    </LinearGradient>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>{m.user_name}</Text>
                      <Text style={styles.rowSub}>#{m.member_number}</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <View style={styles.roleChip}>
                        <Text style={styles.roleText} numberOfLines={1}>{role}</Text>
                      </View>
                      <StatusChip label={st.label} tone={st.tone} />
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
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
  rowRight: { alignItems: 'flex-end', gap: 4 },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 50,
    marginTop: spacing.xs,
  },
  addBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.base },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  secondaryText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: font.size.base, color: colors.textStrong, paddingVertical: 8 },
  filterRow: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  filterChipOn: { backgroundColor: colors.primary },
  filterText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  filterTextOn: { color: colors.white },
  listCount: { fontSize: font.size.xs, color: colors.textMuted, marginLeft: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 12, fontWeight: font.bold },
  roleChip: { backgroundColor: colors.greenBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, maxWidth: 130 },
  roleText: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.primary },
});
