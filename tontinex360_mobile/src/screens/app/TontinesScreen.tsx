import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [activeIndex, setActiveIndex] = useState(0);
  const { width } = useWindowDimensions();

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

  const safeIndex = Math.min(activeIndex, Math.max(0, mySubs.length - 1));
  const activeSub = mySubs[safeIndex];

  // Carousel layout math: card width is full screen width minus paddings and preview offsets
  const CARD_WIDTH = width - 48;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.subtitle}>Souscrivez aux tontines de l'association et suivez vos parts.</Text>
          </View>
          
          <Pressable
            onPress={() => setModalOpen(true)}
            disabled={!canSubscribe}
            style={({ pressed }) => [styles.subBtn, !canSubscribe && styles.subBtnDisabled, pressed && styles.pressed]}>
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.subBtnText}>Souscrire</Text>
          </Pressable>
        </View>

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
          <View style={styles.dashboard}>
            {/* Horizontal Tontines Carousel */}
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + 16}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContainer}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + 16));
                setActiveIndex(index);
              }}
            >
              {mySubs.map((s) => (
                <LinearGradient
                  key={s.id}
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.tontineCard, { width: CARD_WIDTH }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.flex}>
                      <Text style={styles.cardTontineName} numberOfLines={1}>{s.tontine_name}</Text>
                      <Text style={styles.cardCycleName} numberOfLines={1}>Cycle : {cycle?.name ?? '—'}</Text>
                    </View>
                    <View style={styles.cardLogo}>
                      <Ionicons name="albums" size={20} color={colors.primary} />
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardAmountLabel}>Montant à verser par séance</Text>
                    <Text style={styles.cardAmountValue}>{formatNumber(s.amount_per_session ?? 0)} XAF</Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.cardFooterLabel}>Parts souscrites</Text>
                      <Text style={styles.cardFooterValue}>{s.num_shares} {s.num_shares > 1 ? 'parts' : 'part'}</Text>
                    </View>
                    <View style={styles.cardFooterRight}>
                      <Text style={styles.cardFooterLabel}>Taux par part</Text>
                      <Text style={styles.cardFooterValue}>{formatNumber(s.rate_per_share)} XAF</Text>
                    </View>
                  </View>
                </LinearGradient>
              ))}
            </ScrollView>

            {/* Carousel Dots Indicators */}
            {mySubs.length > 1 && (
              <View style={styles.dots}>
                {mySubs.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === safeIndex ? styles.dotActive : styles.dotInactive,
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Active Subscription Details Card */}
            {activeSub && (
              <Card style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.detailTitle}>Détails de la souscription</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tontine</Text>
                  <Text style={styles.detailValue}>{activeSub.tontine_name}</Text>
                </View>
                
                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nombre de parts</Text>
                  <Text style={styles.detailValue}>{activeSub.num_shares}</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Taux de la part</Text>
                  <Text style={styles.detailValue}>{formatNumber(activeSub.rate_per_share)} XAF</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Versement requis</Text>
                  <Text style={styles.detailValueStrong}>{formatNumber(activeSub.amount_per_session ?? 0)} XAF</Text>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.cotiserBtn, pressed && styles.pressed]}
                  onPress={() => {
                    if (!membership || !cycle) return;
                    navigation.navigate('Cotiser', {
                      membershipId: membership.id,
                      tontineTypeId: activeSub.tontine_type,
                      tontineName: activeSub.tontine_name ?? 'Tontine',
                      cycleId: cycle.id,
                      numShares: Number(activeSub.num_shares) || 1,
                      ratePerShare: Number(activeSub.rate_per_share) || 0,
                      amountPerSession: Number(activeSub.amount_per_session) || Number(activeSub.num_shares) * Number(activeSub.rate_per_share) || 0,
                    });
                  }}>
                  <Ionicons name="card-outline" size={18} color={colors.white} />
                  <Text style={styles.cotiserText}>Effectuer ma cotisation</Text>
                </Pressable>
              </Card>
            )}
          </View>
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
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.x3 },
  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    gap: 12,
    marginBottom: spacing.xs,
  },
  subtitle: { fontSize: font.size.sm, color: colors.textMuted, lineHeight: font.size.sm * 1.4 },

  subBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 38,
    paddingHorizontal: 16,
    ...cardShadow,
  },
  subBtnDisabled: { opacity: 0.5 },
  subBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.sm },
  pressed: { opacity: 0.85 },

  loader: { marginTop: spacing.x3 },

  emptyCard: { borderRadius: radius.lg, alignItems: 'center', paddingVertical: spacing.x2, ...cardShadow },
  emptyIcon: { marginBottom: spacing.md },
  emptyTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, textAlign: 'center' },
  emptyText: { marginTop: 6, fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', lineHeight: font.size.sm * 1.4, paddingHorizontal: 8 },

  dashboard: { gap: spacing.md },
  
  carouselContainer: {
    gap: 16,
    paddingBottom: 4,
  },
  
  tontineCard: {
    borderRadius: radius.hero,
    padding: 20,
    height: 180,
    justifyContent: 'space-between',
    ...cardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTontineName: {
    color: colors.white,
    fontSize: font.size.lg,
    fontWeight: font.bold,
  },
  cardCycleName: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: font.size.xs,
    marginTop: 2,
  },
  cardLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    marginVertical: 4,
  },
  cardAmountLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardAmountValue: {
    color: colors.white,
    fontSize: font.size.xl,
    fontWeight: font.extrabold,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 10,
  },
  cardFooterLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  cardFooterValue: {
    color: colors.white,
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    marginTop: 2,
  },
  cardFooterRight: {
    alignItems: 'flex-end',
  },

  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.textLight,
  },

  detailCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...cardShadow,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  detailTitle: {
    fontSize: font.size.md,
    fontWeight: font.bold,
    color: colors.text,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: font.size.sm,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.text,
  },
  detailValueStrong: {
    fontSize: font.size.md,
    fontWeight: font.bold,
    color: colors.primary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.surfaceAlt,
  },
  cotiserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 48,
    marginTop: spacing.lg,
    width: '100%',
    ...cardShadow,
  },
  cotiserText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.base },
});
