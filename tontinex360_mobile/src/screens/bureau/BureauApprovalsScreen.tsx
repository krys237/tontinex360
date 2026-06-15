import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip from '../../components/bureau/StatusChip';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { approvalsApi } from '../../lib/api/approvals';
import { actionLabel, approvalStatus } from '../../lib/bureau/approval-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { countdown, timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauApprovals'>;
type FilterKey = 'pending' | 'approved' | 'rejected' | 'all';

export default function BureauApprovalsScreen() {
  const navigation = useNavigation<Nav>();
  const [filter, setFilter] = useState<FilterKey>('pending');

  const q = useQuery({
    queryKey: ['bureau', 'approvals', filter],
    queryFn: () => approvalsApi.list(filter === 'all' ? undefined : { status: filter }),
  });

  const pendingQ = useQuery({
    queryKey: ['bureau', 'approvals', 'pending'],
    queryFn: () => approvalsApi.list({ status: 'pending' }),
    retry: false,
  });

  const tabs = [
    { key: 'pending', label: 'En attente', badge: pendingQ.data?.length ?? 0 },
    { key: 'approved', label: 'Approuvées' },
    { key: 'rejected', label: 'Rejetées' },
    { key: 'all', label: 'Toutes' },
  ];

  const items = q.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabsWrap}>
        <TabsRow tabs={tabs} active={filter} onChange={(k) => setFilter(k as FilterKey)} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />
        }
      >
        {q.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x3 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <IconBubble icon="checkmark-done-circle-outline" tint="lime" size={56} />
            <Text style={styles.emptyText}>Aucune demande dans cette catégorie.</Text>
          </View>
        ) : (
          items.map((a) => {
            const st = approvalStatus(a.status);
            const isPending = a.status === 'pending' || a.status === 'pres_approved' || a.status === 'bureau_approved';
            return (
              <Pressable
                key={a.id}
                style={styles.row}
                onPress={() => navigation.navigate('BureauApprovalDetail', { id: a.id })}
              >
                <IconBubble
                  icon={a.requires_triple ? 'shield-checkmark' : 'checkmark-circle'}
                  tint={a.requires_triple ? 'accent' : 'primary'}
                  size={40}
                />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{actionLabel(a.action_type)}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {a.summary?.trim() ? a.summary : `Demandé par ${a.requested_by_name ?? '—'}`}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {isPending && a.expires_at
                      ? `Expire dans ${countdown(a.expires_at)}`
                      : timeAgo(a.created_at)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <StatusChip label={st.label} tone={st.tone} />
                  <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
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
  rowMeta: { fontSize: font.size.xs, color: colors.textLight, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
