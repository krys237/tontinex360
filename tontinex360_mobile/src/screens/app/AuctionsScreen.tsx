import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '../../components/ui';
import { potsApi } from '../../lib/api/pots';
import { useAuthStore } from '../../lib/stores/auth-store';
import type { SessionPot } from '../../lib/types/pot';
import { formatXAF } from '../../lib/utils/format';
import { apiErrorMessage } from '../../lib/utils/errors';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

/** Fractional shares in French: "1", "1,5", "0,25" + " nom"/" noms". */
function formatShares(v: number | string | null | undefined): string {
  const n = Number(v) || 0;
  const str = n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
  const unit = n > 1 ? 'noms' : 'nom';
  return `${str} ${unit}`;
}

export default function AuctionsScreen() {
  const membership = useAuthStore((s) => s.currentMembership);
  const myId = membership?.id;

  const potsQ = useQuery({
    queryKey: ['pots', 'open-auctions'],
    queryFn: () => potsApi.list({ is_closed: false }),
  });

  const auctionPots = useMemo(
    () => (potsQ.data ?? []).filter((p) => p.effective_method === 'auction'),
    [potsQ.data],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={potsQ.isRefetching}
            onRefresh={() => potsQ.refetch()}
            tintColor={colors.primary}
          />
        }>
        {potsQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : auctionPots.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="hammer-outline" size={28} color={colors.textLight} />
            <Text style={styles.empty}>Aucune enchère ouverte pour le moment.</Text>
          </Card>
        ) : (
          auctionPots.map((pot) => (
            <AuctionPotCard key={pot.id} pot={pot} myId={myId} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AuctionPotCard({ pot, myId }: { pot: SessionPot; myId?: string }) {
  const qc = useQueryClient();

  const bidsQ = useQuery({
    queryKey: ['pot', pot.id, 'bids'],
    queryFn: () => potsApi.bids(pot.id),
  });

  const sortedBids = useMemo(
    () => [...(bidsQ.data ?? [])].sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount)),
    [bidsQ.data],
  );
  const highestBid = sortedBids[0];
  const myBid = sortedBids.find((b) => b.membership === myId && b.status === 'active');

  const lotPerShare = Number(pot.lot_per_share) || 0;
  const sharesOffered = Number(pot.shares_offered) || 0;
  const isOpen = !!pot.is_bidding_open && sharesOffered > 0;

  const sharesCap = Math.min(
    sharesOffered,
    Number(pot.shares_remaining ?? sharesOffered) || sharesOffered,
  );

  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('1');
  const [error, setError] = useState('');

  const sharesNum = Number(shares.replace(',', '.')) || 0;
  const amountNum = Number(amount.replace(',', '.')) || 0;
  const targetLot = sharesNum * lotPerShare;

  const placeBid = useMutation({
    mutationFn: () =>
      potsApi.placeBid({
        pot: pot.id,
        membership: myId!,
        bid_amount: amountNum,
        shares_requested: sharesNum,
      }),
    onSuccess: () => {
      setAmount('');
      setShares('1');
      setError('');
      qc.invalidateQueries({ queryKey: ['pot', pot.id, 'bids'] });
      qc.invalidateQueries({ queryKey: ['pots', 'open-auctions'] });
      Alert.alert('Enchère placée', 'Votre enchère a bien été enregistrée.');
    },
    onError: (e: any) => {
      Alert.alert('Enchère refusée', apiErrorMessage(e));
    },
  });

  function validate(): boolean {
    if (!(amountNum > 0)) {
      setError('Entrez un montant valide.');
      return false;
    }
    if (!(sharesNum > 0) || Math.round(sharesNum / 0.25) * 0.25 !== sharesNum) {
      setError('Le nombre de noms doit être un multiple de 0,25.');
      return false;
    }
    if (sharesNum > sharesCap) {
      setError(`Maximum ${formatShares(sharesCap)} en jeu.`);
      return false;
    }
    if (amountNum > targetLot) {
      setError('Votre mise ne peut pas dépasser le lot visé.');
      return false;
    }
    setError('');
    return true;
  }

  function onSubmit() {
    if (!validate()) return;
    placeBid.mutate();
  }

  const outbid = !!myBid && highestBid?.membership !== myId;

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.cardHead}>
        <Ionicons name="hammer-outline" size={18} color={colors.goldAccent} />
        <Text style={styles.cardTitle} numberOfLines={1}>
          {pot.tontine_name}
        </Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>ENCHÈRE</Text>
        </View>
      </View>

      {!isOpen ? (
        <View style={styles.infoBanner}>
          <Ionicons name="pause-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoBannerText}>Enchères pas encore ouvertes</Text>
        </View>
      ) : (
        <>
          {/* Lot mis aux enchères */}
          <View style={styles.amberBanner}>
            <Text style={styles.amberLabel}>Lot mis aux enchères</Text>
            <View style={styles.amberRow}>
              <Text style={styles.amberShares}>{formatShares(sharesOffered)}</Text>
              <Text style={styles.amberLot}>{formatXAF(sharesOffered * lotPerShare)}</Text>
            </View>
          </View>

          {/* Statut des enchères */}
          {bidsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.miniLoader} />
          ) : (
            <View style={styles.statusBox}>
              {highestBid ? (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>
                    <Ionicons name="trophy-outline" size={12} color={colors.goldAccent} />{' '}
                    Meilleure enchère
                  </Text>
                  <Text style={styles.statusValue}>
                    {highestBid.member_name ? `${highestBid.member_name} · ` : ''}
                    {formatXAF(highestBid.bid_amount)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.statusEmpty}>
                  Aucune enchère pour l'instant. Soyez le premier !
                </Text>
              )}

              {myBid && (
                <View style={styles.myBidRow}>
                  <Text style={styles.myBidText}>
                    Votre enchère : {formatXAF(myBid.bid_amount)}
                  </Text>
                  {outbid && <Text style={styles.outbidText}>Vous êtes dépassé</Text>}
                </View>
              )}
            </View>
          )}

          {/* Formulaire d'enchère */}
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Nombre de noms (pas de 0,25)</Text>
            <TextInput
              style={styles.input}
              value={shares}
              onChangeText={(t) => {
                setShares(t);
                setError('');
              }}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={styles.hint}>Lot visé : {formatXAF(targetLot)}</Text>

            <Text style={[styles.fieldLabel, styles.fieldSpacer]}>Votre mise (FCFA)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(t) => {
                setAmount(t);
                setError('');
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={placeBid.isPending || !myId}
              style={({ pressed }) => [
                styles.submitBtn,
                (placeBid.isPending || !myId) && styles.submitDisabled,
                pressed && styles.pressed,
              ]}>
              {placeBid.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="hammer" size={16} color={colors.white} />
                  <Text style={styles.submitText}>Placer mon enchère</Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x3 },
  loader: { marginTop: spacing.x2 },
  miniLoader: { marginVertical: spacing.sm },

  emptyCard: {
    borderRadius: radius.lg,
    alignItems: 'center',
    paddingVertical: spacing.x3,
    gap: spacing.sm,
    ...cardShadow,
  },
  empty: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },

  card: { borderRadius: radius.lg, gap: spacing.md, ...cardShadow },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: { flex: 1, fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  tag: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { fontSize: 10, fontWeight: font.bold, color: colors.goldAccent },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  infoBannerText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.medium },

  amberBanner: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  amberLabel: {
    fontSize: 10,
    fontWeight: font.bold,
    letterSpacing: 0.5,
    color: colors.goldAccent,
    textTransform: 'uppercase',
  },
  amberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  amberShares: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  amberLot: { fontSize: font.size.md, fontWeight: font.bold, color: colors.goldAccent },

  statusBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: font.size.xs, color: colors.textMuted },
  statusValue: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.primary },
  statusEmpty: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },
  myBidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  myBidText: { fontSize: font.size.sm, color: colors.text, fontWeight: font.semibold },
  outbidText: { fontSize: font.size.xs, color: colors.danger, fontWeight: font.bold },

  form: { gap: spacing.xs },
  fieldLabel: { fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.medium },
  fieldSpacer: { marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: font.size.md,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  hint: { fontSize: font.size.xs, color: colors.primary, fontWeight: font.medium },
  errorText: { fontSize: font.size.xs, color: colors.danger, marginTop: 2 },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    minHeight: 48,
    marginTop: spacing.sm,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.base },
  pressed: { opacity: 0.85 },
});
