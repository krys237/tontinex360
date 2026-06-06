import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Card } from '../../components/ui';
import SubscribeModal from '../../components/tontines/SubscribeModal';
import { tontinesApi } from '../../lib/api/tontines';
import { cyclesApi } from '../../lib/api/cycles';
import { useAuthStore } from '../../lib/stores/auth-store';
import { formatNumber } from '../../lib/utils/format';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

export default function TontinesScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const membership = useAuthStore((s) => s.currentMembership);
  const [modalOpen, setModalOpen] = useState(false);

  const cycleQ = useQuery({ queryKey: ['cycle', 'current'], queryFn: cyclesApi.current });
  const typesQ = useQuery({ queryKey: ['tontines', 'types'], queryFn: () => tontinesApi.types({ is_active: true }) });
  const subsQ = useQuery({ queryKey: ['tontines', 'subs'], queryFn: () => tontinesApi.subscriptions() });

  const cycle = cycleQ.data ?? null;
  const mySubs = (subsQ.data ?? []).filter(
    (s) => (!membership || s.membership === membership.id) && (!cycle || s.cycle === cycle.id),
  );
  const subscribedTypeIds = new Set(mySubs.map((s) => s.tontine_type));
  const availableTypes = (typesQ.data ?? []).filter((t) => !subscribedTypeIds.has(t.id));
  const canSubscribe = !!cycle && availableTypes.length > 0;

  const refreshing = subsQ.isRefetching || typesQ.isRefetching || cycleQ.isRefetching;
  const onRefresh = () => {
    subsQ.refetch();
    typesQ.refetch();
    cycleQ.refetch();
  };

  const onSubscribed = () => qc.invalidateQueries({ queryKey: ['tontines', 'subs'] });
  const loading = subsQ.isLoading || cycleQ.isLoading || typesQ.isLoading;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <Text style={styles.subtitle}>Souscrivez aux tontines de l'association et suivez vos parts.</Text>

        {/* Subscribe button */}
        <Pressable
          onPress={() => setModalOpen(true)}
          disabled={!canSubscribe}
          style={({ pressed }) => [styles.subBtn, !canSubscribe && styles.subBtnDisabled, pressed && styles.pressed]}>
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.subBtnText}>Souscrire à une tontine</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : mySubs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="albums-outline" size={28} color={colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>Vous n'êtes encore inscrit à aucune tontine.</Text>
            <Text style={styles.emptyText}>
              {canSubscribe
                ? 'Cliquez sur « Souscrire » pour rejoindre une tontine du cycle en cours.'
                : "Aucune tontine n'est disponible pour le moment."}
            </Text>
          </Card>
        ) : (
          mySubs.map((s) => (
            <Card key={s.id} style={styles.subCard}>
              <View style={styles.subHead}>
                <View style={styles.subIcon}>
                  <Ionicons name="albums" size={20} color={colors.green[500]} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.subName}>{s.tontine_name}</Text>
                  <Text style={styles.subCycle}>Cycle : {cycle?.name ?? '—'}</Text>
                </View>
              </View>

              <View style={styles.subRow}>
                <Text style={styles.subRowLabel}>Parts</Text>
                <Text style={styles.subRowValue}>{s.num_shares}</Text>
              </View>
              <View style={styles.subRow}>
                <Text style={styles.subRowLabel}>Par séance</Text>
                <Text style={styles.subRowValueStrong}>{formatNumber(s.amount_per_session ?? 0)} XAF</Text>
              </View>
              <Text style={styles.subRate}>Taux par part : {formatNumber(s.rate_per_share)} XAF</Text>

              <Pressable
                style={({ pressed }) => [styles.cotiserBtn, pressed && styles.pressed]}
                onPress={() => {
                  if (!membership || !cycle) return;
                  navigation.navigate('Cotiser', {
                    membershipId: membership.id,
                    tontineTypeId: s.tontine_type,
                    tontineName: s.tontine_name ?? 'Tontine',
                    cycleId: cycle.id,
                    numShares: Number(s.num_shares) || 1,
                    ratePerShare: Number(s.rate_per_share) || 0,
                    amountPerSession: Number(s.amount_per_session) || Number(s.num_shares) * Number(s.rate_per_share) || 0,
                  });
                }}>
                <Ionicons name="card-outline" size={18} color={colors.white} />
                <Text style={styles.cotiserText}>Cotiser</Text>
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>

      <SubscribeModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubscribed={onSubscribed}
        cycle={cycle}
        types={availableTypes}
        membershipId={membership?.id}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: spacing.sm, gap: 12 },
  title: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text },
  subtitle: { marginTop: 2, fontSize: font.size.sm, color: colors.textMuted, lineHeight: font.size.sm * 1.4 },

  subBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 50,
    alignSelf: 'flex-start',
    paddingHorizontal: 22,
  },
  subBtnDisabled: { opacity: 0.5 },
  subBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.md },
  pressed: { opacity: 0.85 },

  loader: { marginTop: spacing.x3 },

  emptyCard: { borderRadius: radius.lg, alignItems: 'center', paddingVertical: spacing.x2, ...cardShadow },
  emptyIcon: { marginBottom: spacing.md },
  emptyTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, textAlign: 'center' },
  emptyText: { marginTop: 6, fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', lineHeight: font.size.sm * 1.4, paddingHorizontal: 8 },

  subCard: { borderRadius: radius.lg, ...cardShadow },
  subHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  subIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  subName: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  subCycle: { fontSize: font.size.sm, color: colors.green[500], fontWeight: font.medium, marginTop: 1 },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  subRowLabel: { fontSize: font.size.sm, color: colors.textMuted },
  subRowValue: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  subRowValueStrong: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  subRate: { fontSize: font.size.xs, color: colors.textLight, marginTop: 2 },
  cotiserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 44,
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    marginTop: 12,
  },
  cotiserText: { color: colors.white, fontWeight: font.semibold, fontSize: font.size.sm },
});
