import React, { useEffect, useMemo, useState } from 'react';
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

import TabsRow from '../../components/bureau/TabsRow';
import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import MemberPicker from '../../components/bureau/MemberPicker';
import ChipSelect from '../../components/bureau/ChipSelect';
import SearchBar from '../../components/bureau/SearchBar';
import SearchCapNotice from '../../components/bureau/SearchCapNotice';
import { useClientSearch } from '../../lib/search/use-client-search';
import RequirePermission from '../../components/bureau/RequirePermission';
import { Card, TextField, PrimaryButton, IconBubble } from '../../components/ui';
import { walletsApi } from '../../lib/api/wallets';
import { cyclesApi } from '../../lib/api/cycles';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF } from '../../lib/utils/format';

type TabKey = 'all' | 'recap' | 'adjust';

type Settlement = {
  wallet_id: string;
  membership_id: string;
  member_name: string;
  credits: number | string;
  debits: number | string;
  net: number | string;
  direction: 'pay_to_member' | 'owed_by_member' | 'balanced';
};

type SettlementResponse = {
  cycle_id: string;
  cycle_name: string;
  rows: Settlement[];
  totals: { credits: number | string; debits: number | string; net: number | string };
};

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

function initials(name?: string): string {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?';
}

function netColor(n: number): string {
  if (n > 0) return colors.primary;
  if (n < 0) return colors.danger;
  return colors.text;
}

/** Petit avatar à initiales (cercle vert), comme la maquette web. */
function Avatar({ name }: { name?: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials(name)}</Text>
    </View>
  );
}

export default function BureauWalletsScreen() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('all');
  const [cycleId, setCycleId] = useState<string>('');

  // Ajustement
  const [member, setMember] = useState<{ id: string; name: string } | null>(null);
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const walletsQ = useQuery({ queryKey: ['bureau', 'wallets'], queryFn: () => walletsApi.list(), enabled: tab === 'all' });
  const cyclesQ = useQuery({ queryKey: ['bureau', 'cycles'], queryFn: () => cyclesApi.list(), enabled: tab === 'recap' });
  const settlementQ = useQuery({
    queryKey: ['bureau', 'cycle-settlement', cycleId],
    queryFn: () => walletsApi.cycleSettlement(cycleId) as Promise<SettlementResponse>,
    enabled: tab === 'recap' && !!cycleId,
  });

  // Sélectionne le cycle actif/le plus récent par défaut.
  const cycles = cyclesQ.data ?? [];
  useEffect(() => {
    if (tab === 'recap' && !cycleId && cycles.length > 0) {
      const def = cycles.find((c) => c.status === 'active') ?? cycles[0];
      if (def) setCycleId(def.id);
    }
  }, [tab, cycleId, cycles]);

  const recomputeMut = useMutation({
    mutationFn: (id: string) => walletsApi.recompute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'wallets'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const adjustMut = useMutation({
    mutationFn: () =>
      walletsApi.manualAdjustment({
        membership_id: member!.id,
        direction,
        amount: Number(amount),
        description: description.trim(),
        cycle_id: cycleId || undefined,
      }),
    onSuccess: () => {
      setMember(null); setAmount(''); setDescription('');
      Alert.alert('Demande envoyée', 'L’ajustement a été soumis à la validation du bureau.');
      setTab('all');
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const wallets = walletsQ.data ?? [];
  const walletSearch = useClientSearch(walletsQ.data, (w) => [w.member_name, w.member_number]);
  const settlement = settlementQ.data?.rows ?? [];
  const totals = useMemo(() => {
    const t = settlementQ.data?.totals;
    if (t) return { credits: Number(t.credits) || 0, debits: Number(t.debits) || 0, net: Number(t.net) || 0 };
    let credits = 0, debits = 0;
    settlement.forEach((s) => { credits += Number(s.credits) || 0; debits += Number(s.debits) || 0; });
    return { credits, debits, net: credits - debits };
  }, [settlementQ.data, settlement]);

  const tabs = [
    { key: 'all', label: 'Tous les wallets' },
    { key: 'recap', label: 'Récap fin de cycle' },
    { key: 'adjust', label: 'Ajustement' },
  ];
  const cycleOptions = cycles.map((c) => ({ key: c.id, label: c.name }));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabsWrap}>
        <TabsRow tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={walletsQ.isRefetching || settlementQ.isRefetching} onRefresh={() => (tab === 'recap' ? settlementQ.refetch() : walletsQ.refetch())} tintColor={colors.primary} />}
      >
        {/* ---- Tous les wallets ---- */}
        {tab === 'all' ? (
          walletsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : wallets.length === 0 ? (
            <Empty icon="wallet-outline" text="Aucun portefeuille." />
          ) : (
            <>
            <SearchBar value={walletSearch.query} onChangeText={walletSearch.setQuery} placeholder="Rechercher un membre…" />
            <SearchCapNotice visible={walletSearch.capped} />
            {walletSearch.filtered.length === 0 ? (
              <Empty icon="wallet-outline" text={`Aucun portefeuille pour « ${walletSearch.query.trim()} ».`} />
            ) : null}
            {walletSearch.filtered.map((w) => {
              const net = Number(w.balance) || 0;
              return (
                <View key={w.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Avatar name={w.member_name} />
                    <View style={styles.flex}>
                      <Text style={styles.name} numberOfLines={1}>{w.member_name}</Text>
                      {w.member_number ? <Text style={styles.num}>#{w.member_number}</Text> : null}
                    </View>
                    <StatusChip label={w.is_frozen ? 'Gelé' : 'Actif'} tone={w.is_frozen ? 'danger' : 'success'} />
                    <RequirePermission bureau>
                      <Pressable onPress={() => recomputeMut.mutate(w.id)} hitSlop={8} style={styles.refreshBtn}>
                        {recomputeMut.isPending && recomputeMut.variables === w.id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Ionicons name="refresh" size={16} color={colors.primary} />
                        )}
                      </Pressable>
                    </RequirePermission>
                  </View>
                  <View style={styles.statsRow}>
                    <Stat label="Crédits" value={`+${formatXAF(w.total_credits)}`} color={colors.primary} />
                    <Stat label="Débits" value={`-${formatXAF(w.total_debits)}`} color={colors.danger} />
                    <Stat label="Solde net" value={formatXAF(net)} color={netColor(net)} strong />
                  </View>
                </View>
              );
            })}
            </>
          )
        ) : null}

        {/* ---- Récap fin de cycle ---- */}
        {tab === 'recap' ? (
          <>
            <Text style={styles.label}>Cycle</Text>
            {cyclesQ.isLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
            ) : cycleOptions.length === 0 ? (
              <Empty icon="reload-circle-outline" text="Aucun cycle." />
            ) : (
              <ChipSelect options={cycleOptions} value={cycleId} onChange={setCycleId} />
            )}

            {cycleId ? (
              settlementQ.isLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
              ) : (
                <>
                  <View style={styles.totalsRow}>
                    <TotalCard label="Total crédits" value={`+${formatXAF(totals.credits)}`} color={colors.primary} />
                    <TotalCard label="Total débits" value={`-${formatXAF(totals.debits)}`} color={colors.danger} />
                    <TotalCard label="Solde net" value={formatXAF(totals.net)} color={netColor(totals.net)} />
                  </View>

                  <Text style={styles.section}>Récap par membre</Text>
                  {settlement.length === 0 ? (
                    <Empty icon="people-outline" text="Aucune donnée pour ce cycle." />
                  ) : (
                    settlement.map((s) => {
                      const net = Number(s.net) || 0;
                      const chip = settleChip(s.direction);
                      return (
                        <View key={s.wallet_id} style={styles.card}>
                          <View style={styles.cardHead}>
                            <Avatar name={s.member_name} />
                            <Text style={[styles.name, styles.flex]} numberOfLines={1}>{s.member_name}</Text>
                            <StatusChip label={chip.label} tone={chip.tone} />
                          </View>
                          <View style={styles.statsRow}>
                            <Stat label="Crédits" value={`+${formatXAF(s.credits)}`} color={colors.primary} />
                            <Stat label="Débits" value={`-${formatXAF(s.debits)}`} color={colors.danger} />
                            <Stat label="Net" value={formatXAF(net)} color={netColor(net)} strong />
                          </View>
                        </View>
                      );
                    })
                  )}
                </>
              )
            ) : null}
          </>
        ) : null}

        {/* ---- Ajustement ---- */}
        {tab === 'adjust' ? (
          <RequirePermission bureau fallback={<Empty icon="lock-closed-outline" text="Action réservée au bureau." />}>
            <Card style={styles.formCard}>
              <Text style={styles.formTitle}>Ajustement manuel</Text>
              <MemberPicker value={member} onChange={setMember} />
              <Text style={styles.fieldLabel}>Sens</Text>
              <View style={styles.dirRow}>
                <Pressable onPress={() => setDirection('credit')} style={[styles.dirBtn, direction === 'credit' && styles.dirOnCredit]}>
                  <Text style={[styles.dirText, direction === 'credit' && styles.dirTextOn]}>Crédit (+)</Text>
                </Pressable>
                <Pressable onPress={() => setDirection('debit')} style={[styles.dirBtn, direction === 'debit' && styles.dirOnDebit]}>
                  <Text style={[styles.dirText, direction === 'debit' && styles.dirTextOn]}>Débit (−)</Text>
                </Pressable>
              </View>
              <TextField label="Montant" value={amount} onChangeText={setAmount} placeholder="Ex : 5000" keyboardType="numeric" />
              <TextField label="Description / motif" value={description} onChangeText={setDescription} placeholder="Raison de l'ajustement" multiline />
              <PrimaryButton
                title="Soumettre l'ajustement"
                onPress={() => adjustMut.mutate()}
                loading={adjustMut.isPending}
                disabled={!member || !Number(amount) || !description.trim()}
              />
              <Text style={styles.hint}>L’ajustement nécessite la validation du bureau (double approbation).</Text>
            </Card>
          </RequirePermission>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function settleChip(direction: Settlement['direction']): { label: string; tone: StatusTone } {
  if (direction === 'owed_by_member') return { label: 'À encaisser', tone: 'danger' };
  if (direction === 'pay_to_member') return { label: 'À verser', tone: 'warning' };
  return { label: 'Soldé', tone: 'muted' };
}

function Stat({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }, strong && styles.statStrong]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function TotalCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.totalCard}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
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

  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: font.size.sm, fontWeight: font.bold },

  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  num: { fontSize: font.size.xs, color: colors.textLight, marginTop: 1 },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.surfaceAlt, paddingTop: spacing.sm },
  stat: { flex: 1 },
  statLabel: { fontSize: font.size.xs, color: colors.textMuted },
  statValue: { fontSize: font.size.sm, fontWeight: font.semibold, marginTop: 2 },
  statStrong: { fontWeight: font.bold },

  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  totalsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  totalCard: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...cardShadow },
  totalLabel: { fontSize: font.size.xs, color: colors.textMuted },
  totalValue: { fontSize: font.size.md, fontWeight: font.bold, marginTop: 4 },
  section: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.sm, marginLeft: 4 },

  formCard: { borderRadius: radius.lg, gap: 2 },
  formTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
  fieldLabel: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  dirRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 14 },
  dirBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  dirOnCredit: { backgroundColor: colors.greenBgDeep },
  dirOnDebit: { backgroundColor: colors.dangerSoft },
  dirText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  dirTextOn: { color: colors.text },
  hint: { fontSize: font.size.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },

  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
