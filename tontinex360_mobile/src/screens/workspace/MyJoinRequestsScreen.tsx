import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { WorkspaceStackParamList } from '../../navigation/types';
import type { JoinRequestStatus } from '../../lib/types/auth';
import { membersApi } from '../../lib/api/members';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatDateFr } from '../../lib/utils/format';

type Props = NativeStackScreenProps<WorkspaceStackParamList, 'MyJoinRequests'>;

const STATUS: Record<JoinRequestStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'En attente', bg: colors.goldSoft, fg: '#92702A' },
  approved: { label: 'Approuvée', bg: colors.greenBg, fg: colors.primary },
  rejected: { label: 'Rejetée', bg: colors.dangerSoft, fg: colors.danger },
  cancelled: { label: 'Annulée', bg: colors.surfaceAlt, fg: colors.textMuted },
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function MyJoinRequestsScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-join-requests'], queryFn: () => membersApi.myJoinRequests() });

  const cancelMut = useMutation({
    mutationFn: (id: string) => membersApi.cancelJoinRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-join-requests'] }),
    onError: (e: any) => Alert.alert('Erreur', e?.response?.data?.error ?? 'Annulation impossible.'),
  });

  const items = q.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Mes demandes d'adhésion</Text>
          <Pressable style={styles.joinBtn} onPress={() => navigation.navigate('JoinRequest')}>
            <Ionicons name="search" size={14} color={colors.white} />
            <Text style={styles.joinBtnText}>Rejoindre</Text>
          </Pressable>
        </View>

        {q.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x2 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="documents-outline" size={36} color={colors.textLight} />
            <Text style={styles.emptyText}>Aucune demande envoyée pour le moment.</Text>
            <Pressable onPress={() => navigation.navigate('JoinRequest')}>
              <Text style={styles.emptyLink}>Chercher une association →</Text>
            </Pressable>
          </View>
        ) : (
          items.map((r) => {
            const st = STATUS[r.status] ?? STATUS.pending;
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.logo}><Text style={styles.logoText}>{initials(r.association_name)}</Text></View>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{r.association_name}</Text>
                    <Text style={styles.meta}>Envoyée le {formatDateFr(r.created_at, false)}</Text>
                  </View>
                  <View style={[styles.chip, { backgroundColor: st.bg }]}>
                    <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
                  </View>
                </View>

                {r.review_note ? <Text style={styles.note}>Note du bureau : {r.review_note}</Text> : null}

                {r.status === 'pending' ? (
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() =>
                      Alert.alert('Annuler la demande', `Annuler votre demande à « ${r.association_name} » ?`, [
                        { text: 'Non', style: 'cancel' },
                        { text: 'Annuler la demande', style: 'destructive', onPress: () => cancelMut.mutate(r.id) },
                      ])
                    }
                    disabled={cancelMut.isPending}
                  >
                    {cancelMut.isPending && cancelMut.variables === r.id ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <>
                        <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
                        <Text style={styles.cancelText}>Annuler la demande</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: font.size.sm, color: colors.text, fontWeight: font.semibold },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.heading, flex: 1 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill },
  joinBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.sm },

  empty: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, ...cardShadow },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
  emptyLink: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.semibold },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.green[100], alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.primary },
  name: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  meta: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  chipText: { fontSize: 11, fontWeight: font.bold },
  note: { fontSize: font.size.xs, color: colors.textMuted, fontStyle: 'italic' },

  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.pill, height: 40 },
  cancelText: { color: colors.danger, fontWeight: font.semibold, fontSize: font.size.sm },
});
