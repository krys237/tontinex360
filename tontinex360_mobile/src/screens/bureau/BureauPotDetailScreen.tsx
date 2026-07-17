import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { Card, IconBubble, TextField, PrimaryButton, OutlineButton, SoftButton } from '../../components/ui';
import StatusChip from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import type { BureauStackParamList } from '../../navigation/types';
import type { SessionLotCandidate } from '../../lib/types/pot';
import { potsApi } from '../../lib/api/pots';
import { sessionsApi } from '../../lib/api/sessions';
import { payoutStatus } from '../../lib/bureau/cycle-labels';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF } from '../../lib/utils/format';

type Rt = RouteProp<BureauStackParamList, 'BureauPotDetail'>;

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauPotDetailScreen() {
  const { id } = useRoute<Rt>().params;
  const qc = useQueryClient();
  const [bid, setBid] = useState('');
  const [sharesOffered, setSharesOffered] = useState('1');

  const potQ = useQuery({ queryKey: ['bureau', 'pot', id], queryFn: () => potsApi.get(id) });
  const sessionId = potQ.data?.session;
  const tontineTypeId = potQ.data?.tontine_type;
  const isAuction = potQ.data?.effective_method === 'auction';

  const lotsQ = useQuery({
    queryKey: ['bureau', 'session', sessionId, 'lots'],
    queryFn: () => sessionsApi.lots(sessionId!),
    enabled: !!sessionId && !potQ.data?.is_closed,
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bureau', 'pot', id] });
    if (sessionId) {
      qc.invalidateQueries({ queryKey: ['bureau', 'session', sessionId, 'pots'] });
      qc.invalidateQueries({ queryKey: ['bureau', 'session', sessionId, 'lots'] });
    }
    qc.invalidateQueries({ queryKey: ['bureau', 'pots'] });
    qc.invalidateQueries({ queryKey: ['bureau', 'payouts'] });
  };

  const distributeMut = useMutation({
    mutationFn: (c: SessionLotCandidate) =>
      potsApi.distribute(id, { membership_id: c.membership_id, shares_claimed: c.remaining_shares }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const auctionMut = useMutation({
    mutationFn: (c: SessionLotCandidate) =>
      potsApi.processAuction(id, { winner_membership_id: c.membership_id, bid_amount: Number(bid) }),
    onSuccess: () => {
      setBid('');
      invalidate();
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const startBiddingMut = useMutation({
    mutationFn: () => potsApi.startBidding(id, Number(sharesOffered) || 1),
    onSuccess: () => {
      invalidate();
      Alert.alert('Enchères ouvertes', 'Les membres peuvent désormais placer leurs enchères.');
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const closeMut = useMutation({
    mutationFn: () => potsApi.closePot(id),
    onSuccess: (r) => {
      invalidate();
      Alert.alert('Cagnotte clôturée', r?.message ?? `Reliquat : ${formatXAF(r?.remainder)}`);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  if (potQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }
  const p = potQ.data;
  if (!p) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.muted}>Cagnotte introuvable.</Text>
      </SafeAreaView>
    );
  }

  const lotEntry = (lotsQ.data ?? []).find((l) => l.tontine_type_id === tontineTypeId);
  const candidates = (lotEntry?.candidates ?? []).filter((c) => c.is_eligible);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={potQ.isRefetching || lotsQ.isRefetching}
            onRefresh={() => {
              potQ.refetch();
              lotsQ.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* En-tête */}
        <Card style={styles.headCard}>
          <View style={styles.headRow}>
            <IconBubble icon="cube" tint={p.is_closed ? 'lime' : 'accent'} size={44} />
            <View style={styles.flex}>
              <Text style={styles.title}>{p.tontine_name}</Text>
              <Text style={styles.sub}>{p.method_display}</Text>
            </View>
            <StatusChip label={p.is_closed ? 'Fermée' : 'Ouverte'} tone={p.is_closed ? 'muted' : 'success'} />
          </View>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Stat value={formatXAF(p.total_available)} label="Disponible" />
          <View style={styles.statDivider} />
          <Stat value={formatXAF(p.total_distributed)} label="Distribué" />
          <View style={styles.statDivider} />
          <Stat value={formatXAF(p.remainder)} label="Reliquat" />
        </Card>

        {/* Versements déjà effectués */}
        {(p.payouts ?? []).length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Versements</Text>
            {(p.payouts ?? []).map((po) => {
              const st = payoutStatus(po.status);
              return (
                <View key={po.id} style={styles.row}>
                  <IconBubble icon="gift" tint="primary" size={36} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{formatXAF(po.amount)}</Text>
                    <Text style={styles.rowSub}>{po.member_name}</Text>
                  </View>
                  <StatusChip label={st.label} tone={st.tone} />
                </View>
              );
            })}
          </>
        ) : null}

        {/* Ouvrir les enchères (gate) */}
        {isAuction && !p.is_closed && !p.is_bidding_open ? (
          <RequirePermission bureau>
            <Text style={styles.sectionLabel}>Ouvrir les enchères</Text>
            <Text style={styles.muted}>
              Mettez un ou plusieurs « noms » en jeu. Les membres pourront ensuite placer leurs enchères.
            </Text>
            <TextField
              label="Noms mis en jeu"
              value={sharesOffered}
              onChangeText={setSharesOffered}
              placeholder="Ex : 1"
              keyboardType="numeric"
            />
            <PrimaryButton
              title="Ouvrir les enchères"
              onPress={() => startBiddingMut.mutate()}
              loading={startBiddingMut.isPending}
              disabled={!(Number(sharesOffered) > 0)}
              style={{ marginTop: spacing.sm }}
            />
          </RequirePermission>
        ) : null}

        {isAuction && !p.is_closed && p.is_bidding_open ? (
          <View style={styles.openBanner}>
            <IconBubble icon="hammer" tint="accent" size={32} />
            <Text style={styles.openBannerText}>
              Enchères ouvertes · {String(p.shares_offered ?? '')} nom(s) en jeu
            </Text>
          </View>
        ) : null}

        {/* Distribution */}
        {!p.is_closed ? (
          <RequirePermission bureau>
            <Text style={styles.sectionLabel}>{isAuction ? 'Attribuer (enchère)' : 'Distribuer'}</Text>
            {isAuction ? (
              <TextField
                label="Montant de l'enchère gagnante"
                value={bid}
                onChangeText={setBid}
                placeholder="Ex : 15000"
                keyboardType="numeric"
              />
            ) : null}
            {lotsQ.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : candidates.length === 0 ? (
              <Text style={styles.muted}>Aucun bénéficiaire éligible.</Text>
            ) : (
              candidates.map((c) => (
                <View key={c.membership_id} style={styles.row}>
                  <IconBubble icon="person" tint="lime" size={36} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{c.member_name}</Text>
                    <Text style={styles.rowSub}>
                      {c.remaining_shares} nom(s) · {formatXAF(c.computed_lot)}
                    </Text>
                  </View>
                  {isAuction ? (
                    <SoftButton
                      title="Attribuer"
                      onPress={() => auctionMut.mutate(c)}
                      disabled={!Number(bid) || auctionMut.isPending}
                      style={styles.smallBtn}
                    />
                  ) : (
                    <SoftButton
                      title="Distribuer"
                      onPress={() => distributeMut.mutate(c)}
                      disabled={distributeMut.isPending}
                      style={styles.smallBtn}
                    />
                  )}
                </View>
              ))
            )}

            <PrimaryButton
              title="Clôturer la cagnotte"
              onPress={() =>
                Alert.alert('Clôturer', 'Clôturer cette cagnotte et calculer le reliquat ?', [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Clôturer', onPress: () => closeMut.mutate() },
                ])
              }
              loading={closeMut.isPending}
              style={{ marginTop: spacing.sm }}
            />
          </RequirePermission>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  muted: { color: colors.textMuted, fontSize: font.size.sm, textAlign: 'center' },
  openBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.greenBg, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm },
  openBannerText: { flex: 1, fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary },

  headCard: {},
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  sub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },

  statsCard: { flexDirection: 'row', borderRadius: radius.lg, paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  statLabel: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.surfaceAlt },

  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
  },
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
  smallBtn: { minHeight: 40, paddingHorizontal: 16 },
});
