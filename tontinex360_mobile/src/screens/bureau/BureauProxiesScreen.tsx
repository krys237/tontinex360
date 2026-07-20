import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import ActionBtn from '../../components/bureau/ActionBtn';
import SearchBar from '../../components/bureau/SearchBar';
import SearchCapNotice from '../../components/bureau/SearchCapNotice';
import { useClientSearch } from '../../lib/search/use-client-search';
import { IconBubble } from '../../components/ui';
import { proxiesApi, type ProxyStatus } from '../../lib/api/proxies';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr } from '../../lib/utils/format';

const STATUS: Record<ProxyStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  approved: { label: 'Approuvée', tone: 'success' },
  rejected: { label: 'Rejetée', tone: 'danger' },
  used: { label: 'Utilisée', tone: 'info' },
  cancelled: { label: 'Annulée', tone: 'muted' },
};

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauProxiesScreen() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bureau', 'proxies'], queryFn: () => proxiesApi.list() });
  const { query, setQuery, filtered, capped, hasQuery } = useClientSearch(q.data, (p) => [
    p.grantor_name,
    p.proxy_name,
    p.tontine_name,
    p.session_number,
    STATUS[(p.status ?? 'pending') as ProxyStatus]?.label,
  ]);

  const approveMut = useMutation({
    mutationFn: (id: string) => proxiesApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'proxies'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => proxiesApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'proxies'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {!q.isLoading && (q.data ?? []).length > 0 ? (
          <>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Rechercher une procuration…" />
            <SearchCapNotice visible={capped} />
          </>
        ) : null}

        {q.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x3 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <IconBubble icon="document-text-outline" tint="lime" size={56} />
            <Text style={styles.emptyText}>
              {hasQuery ? `Aucune procuration pour « ${query.trim()} ».` : 'Aucune procuration.'}
            </Text>
          </View>
        ) : (
          filtered.map((p) => {
            const status = (p.status ?? 'pending') as ProxyStatus;
            const st = STATUS[status] ?? STATUS.pending;
            const isPending = status === 'pending';
            return (
              <View key={p.id} style={styles.row}>
                <IconBubble icon="people" tint="primary" size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {p.grantor_name ?? 'Mandant'} → {p.proxy_name ?? 'Mandataire'}
                  </Text>
                  <Text style={styles.rowSub}>
                    {p.session_date ? formatDateFr(p.session_date, false) : `Séance ${p.session_number ?? ''}`}
                    {p.tontine_name ? ` · ${p.tontine_name}` : ''}
                  </Text>
                </View>
                {isPending ? (
                  <>
                    <ActionBtn icon="checkmark" tone="success" loading={approveMut.isPending && approveMut.variables === p.id} onPress={() => approveMut.mutate(p.id)} />
                    <ActionBtn icon="close" tone="danger" loading={rejectMut.isPending && rejectMut.variables === p.id} onPress={() => rejectMut.mutate(p.id)} />
                  </>
                ) : (
                  <StatusChip label={st.label} tone={st.tone} />
                )}
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
  flex: { flex: 1 },
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
