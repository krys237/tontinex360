import React, { useLayoutEffect, useMemo } from 'react';
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

import KpiCard from '../../components/bureau/KpiCard';
import StatusChip from '../../components/bureau/StatusChip';
import { IconBubble } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { memberFeesApi } from '../../lib/api/member-fees';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauFeesOverview'>;

export default function BureauFeesOverviewScreen() {
  const navigation = useNavigation<Nav>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('BureauFeesConfig')} hitSlop={8} style={styles.headerBtn}>
          <Ionicons name="settings-outline" size={16} color={colors.primary} />
          <Text style={styles.headerBtnText}>Configurer</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const q = useQuery({
    queryKey: ['bureau', 'fees', 'pending-overview'],
    queryFn: () => memberFeesApi.pendingOverview(),
    retry: false,
  });

  const rows = q.data ?? [];
  const totals = useMemo(() => {
    let expected = 0, paid = 0, remaining = 0;
    rows.forEach((r) => {
      expected += Number(r.total_expected) || 0;
      paid += Number(r.total_paid) || 0;
      remaining += Number(r.total_remaining) || 0;
    });
    return { expected, paid, remaining, members: rows.length };
  }, [rows]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.kpiGrid}>
          <KpiCard icon="people" tint="accent" label="Membres en retard" value={totals.members} />
          <KpiCard icon="cash" tint="primary" label="Total attendu" value={formatXAF(totals.expected)} />
          <KpiCard icon="checkmark-circle" tint="lime" label="Total perçu" value={formatXAF(totals.paid)} />
          <KpiCard icon="warning" tint="danger" label="Reste à percevoir" value={formatXAF(totals.remaining)} />
        </View>

        {q.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <IconBubble icon="ribbon-outline" tint="lime" size={56} />
            <Text style={styles.emptyText}>Aucun membre n'a de frais en retard. 🎉</Text>
          </View>
        ) : (
          rows.map((r) => {
            const isPending = r.member_status === 'pending';
            return (
              <Pressable key={r.membership_id} style={styles.row} onPress={() => navigation.navigate('BureauMemberDetail', { id: r.membership_id })}>
                <View style={styles.rowHead}>
                  <Text style={styles.member}>{r.member_name}</Text>
                  <StatusChip label={isPending ? 'En attente' : 'Actif'} tone={isPending ? 'warning' : 'success'} />
                </View>
                <View style={styles.amounts}>
                  <Amount label="Attendu" value={formatXAF(Number(r.total_expected))} color={colors.text} />
                  <Amount label="Payé" value={formatXAF(Number(r.total_paid))} color={colors.primary} />
                  <Amount label="Reste" value={formatXAF(Number(r.total_remaining))} color={colors.danger} />
                </View>
                <View style={styles.feeChips}>
                  {r.fees.map((f) => {
                    const ok = f.status === 'paid' || f.status === 'waived';
                    const partial = f.status === 'partial';
                    return (
                      <View key={f.id} style={[styles.feeChip, ok ? styles.feeOk : partial ? styles.feePartial : styles.feePending]}>
                        <Text style={styles.feeChipText}>
                          {f.fee_type === 'registration' ? '🪙' : '🐷'} {Math.round(f.progress_pct)}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Amount({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.amount}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text style={[styles.amountValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtnText: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.semibold },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  row: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  member: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, flex: 1 },
  amounts: { flexDirection: 'row' },
  amount: { flex: 1 },
  amountLabel: { fontSize: font.size.xs, color: colors.textMuted },
  amountValue: { fontSize: font.size.sm, fontWeight: font.bold, marginTop: 1 },
  feeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  feeChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  feeOk: { backgroundColor: colors.greenBgDeep },
  feePartial: { backgroundColor: colors.blue[100] },
  feePending: { backgroundColor: colors.goldSoft },
  feeChipText: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.text },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
});
