import React, { useMemo, useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import { Card, IconBubble } from '../../components/ui';
import type { BubbleTint } from '../../components/ui/IconBubble';
import type { BureauStackParamList } from '../../navigation/types';
import { invitationsApi } from '../../lib/api/invitations';
import type { InvitationChannel, InvitationStatus } from '../../lib/types/invitation';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauInvitationsOverview'>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const STATUS: Record<InvitationStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  accepted: { label: 'Acceptée', tone: 'success' },
  declined: { label: 'Refusée', tone: 'danger' },
  expired: { label: 'Expirée', tone: 'muted' },
  revoked: { label: 'Révoquée', tone: 'muted' },
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'accepted', label: 'Acceptées' },
  { key: 'expired', label: 'Expirées' },
  { key: 'revoked', label: 'Révoquées' },
];

const METHODS: { channel: InvitationChannel; name: string; icon: IoniconName; tint: BubbleTint; desc: string; metric: string; cta: string }[] = [
  { channel: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', tint: 'lime', desc: "Partage rapide via lien d'invitation sécurisé.", metric: 'Taux de conversion', cta: 'Inviter via WhatsApp' },
  { channel: 'sms', name: 'SMS', icon: 'chatbubble-ellipses', tint: 'info', desc: 'Accessible même sans smartphone ni Internet.', metric: 'Taux de lecture', cta: 'Envoyer un SMS' },
  { channel: 'email', name: 'Email', icon: 'mail', tint: 'accent', desc: "Email pro avec détails complets de l'association.", metric: 'Ouverture moyenne', cta: 'Envoyer un email' },
];

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauInvitationsOverviewScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const q = useQuery({ queryKey: ['bureau', 'invitations'], queryFn: () => invitationsApi.list() });
  const invitations = q.data ?? [];

  const resendMut = useMutation({
    mutationFn: (id: string) => invitationsApi.resend(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'invitations'] });
      Alert.alert('Invitation relancée', 'Le lien a été renvoyé au destinataire.');
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => invitationsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bureau', 'invitations'] }),
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const stats = useMemo(() => {
    const total = invitations.length;
    const accepted = invitations.filter((i) => i.status === 'accepted').length;
    const pending = invitations.filter((i) => i.status === 'pending').length;
    const expired = invitations.filter((i) => i.status === 'expired' || i.status === 'revoked').length;
    const byChannel: Record<string, { total: number; accepted: number }> = {};
    invitations.forEach((i) => {
      const c = (byChannel[i.channel] ??= { total: 0, accepted: 0 });
      c.total += 1;
      if (i.status === 'accepted') c.accepted += 1;
    });
    return { total, accepted, pending, expired, byChannel };
  }, [invitations]);

  const channelRate = (c: InvitationChannel) => {
    const s = stats.byChannel[c];
    if (!s || s.total === 0) return '—';
    return `${Math.round((s.accepted / s.total) * 100)}%`;
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return invitations.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (s) {
        const hay = [inv.name, inv.email, inv.phone].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [invitations, search, statusFilter]);

  const goInvite = (channel?: InvitationChannel) => navigation.navigate('BureauInvitations', channel ? { channel } : undefined);

  const scrollRef = useRef<ScrollView>(null);
  const tableYRef = useRef(0);
  const scrollToStats = () => scrollRef.current?.scrollTo({ y: Math.max(0, tableYRef.current - 8), animated: true });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        {/* Titre */}
        <View>
          <Text style={styles.breadcrumb}>Communauté</Text>
          <Text style={styles.pageTitle}>Invitations & Onboarding</Text>
          <Text style={styles.pageSub}>Invitez de nouveaux membres et suivez les acceptations.</Text>
        </View>

        {/* Hero + stats */}
        <LinearGradient colors={[colors.primary, colors.green[500]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTitle}>Gérez vos invitations intelligemment</Text>
          <Text style={styles.heroSub}>Suivi en temps réel des validations, expirations et adhésions.</Text>
          <View style={styles.heroBtnsCol}>
            <Pressable style={styles.heroBtnFull} onPress={() => goInvite()}>
              <Ionicons name="paper-plane" size={16} color={colors.primary} />
              <Text style={styles.heroBtnText}>Envoyer une invitation</Text>
            </Pressable>
            <Pressable style={styles.heroOutlineFull} onPress={scrollToStats}>
              <Ionicons name="stats-chart" size={16} color={colors.white} />
              <Text style={styles.heroOutlineText}>Voir les statistiques</Text>
            </Pressable>
          </View>
          <View style={styles.heroStats}>
            <Text style={styles.heroStatsTitle}>PERFORMANCE INVITATIONS</Text>
            <View style={styles.heroGrid}>
              <HeroStat label="Total envoyées" value={stats.total} />
              <HeroStat label="Acceptées" value={stats.accepted} />
              <HeroStat label="En attente" value={stats.pending} />
              <HeroStat label="Expirées" value={stats.expired} />
            </View>
          </View>
        </LinearGradient>

        {/* Méthodes d'invitation */}
        <Text style={styles.sectionTitle}>Méthodes d'invitation</Text>
        {METHODS.map((m) => (
          <Card key={m.channel} style={styles.methodCard}>
            <View style={styles.methodHead}>
              <IconBubble icon={m.icon} tint={m.tint} size={40} />
              <View style={styles.flex}>
                <Text style={styles.methodName}>{m.name}</Text>
                <Text style={styles.methodDesc} numberOfLines={2}>{m.desc}</Text>
              </View>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>{m.metric}</Text>
              <Text style={styles.metricValue}>{channelRate(m.channel)}</Text>
            </View>
            <Pressable style={styles.methodBtn} onPress={() => goInvite(m.channel)}>
              <Text style={styles.methodBtnText}>{m.cta}</Text>
            </Pressable>
          </Card>
        ))}

        {/* Invitations récentes */}
        <Text
          style={styles.sectionTitle}
          onLayout={(e) => {
            tableYRef.current = e.nativeEvent.layout.y;
          }}
        >
          Invitations récentes
        </Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Rechercher…" placeholderTextColor={colors.placeholder} />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textLight} />
            </Pressable>
          ) : null}
        </View>
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

        {q.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <IconBubble icon="paper-plane-outline" tint="lime" size={56} />
            <Text style={styles.emptyText}>Aucune invitation.</Text>
          </View>
        ) : (
          filtered.map((inv) => {
            const st = STATUS[inv.status] ?? STATUS.pending;
            const canManage = inv.status === 'pending' || inv.status === 'expired';
            const isExpired = inv.status === 'expired' || inv.is_expired;
            return (
              <View key={inv.id} style={styles.row}>
                <View style={styles.rowHead}>
                  <View style={styles.flex}>
                    <Text style={styles.invName}>{inv.name || inv.email || inv.phone || 'Sans nom'}</Text>
                    <Text style={styles.invContact} numberOfLines={1}>{inv.email || inv.phone || '—'}</Text>
                  </View>
                  <StatusChip label={st.label} tone={st.tone} />
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaStrong}>{inv.channel}</Text> · {timeAgo(inv.created_at)}
                  </Text>
                  <View style={styles.actions}>
                    {canManage ? (
                      <>
                        <Pressable
                          onPress={() => resendMut.mutate(inv.id)}
                          disabled={resendMut.isPending}
                          hitSlop={6}
                          style={styles.actionBtn}
                        >
                          <Ionicons name="refresh" size={13} color={colors.primary} />
                          <Text style={styles.actionPrimary}>{isExpired ? 'Régénérer' : 'Relancer'}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            Alert.alert('Annuler', 'Le lien deviendra invalide. Continuer ?', [
                              { text: 'Non', style: 'cancel' },
                              { text: 'Oui', style: 'destructive', onPress: () => cancelMut.mutate(inv.id) },
                            ])
                          }
                          disabled={cancelMut.isPending}
                          hitSlop={6}
                        >
                          <Text style={styles.actionDanger}>Annuler</Text>
                        </Pressable>
                      </>
                    ) : inv.status === 'accepted' && inv.resulting_membership ? (
                      <Pressable onPress={() => navigation.navigate('BureauMemberDetail', { id: inv.resulting_membership! })} hitSlop={6}>
                        <Text style={styles.actionPrimary}>Voir le profil</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },

  breadcrumb: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.semibold },
  pageTitle: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.primary, marginTop: 2 },
  pageSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 2 },

  hero: { borderRadius: radius.hero, padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.primary, ...cardShadow },
  heroTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.white },
  heroSub: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.9)' },
  heroBtnsCol: { gap: spacing.sm, marginTop: spacing.xs },
  heroBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white, paddingVertical: 12, borderRadius: radius.pill },
  heroOutlineFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  heroBtnText: { color: colors.primary, fontWeight: font.bold, fontSize: font.size.sm },
  heroOutlineText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.sm },
  heroStats: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs },
  heroStatsTitle: { fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6, fontWeight: font.bold, marginBottom: spacing.sm },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  heroStat: { width: '50%', marginBottom: spacing.sm },
  heroStatLabel: { fontSize: font.size.xs, color: 'rgba(255,255,255,0.85)' },
  heroStatValue: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.white, marginTop: 1 },

  sectionTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginTop: spacing.xs },
  methodCard: { borderRadius: radius.lg, gap: spacing.sm },
  methodHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  methodName: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  methodDesc: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  metricBox: { backgroundColor: colors.greenBg, borderRadius: radius.md, padding: spacing.sm },
  metricLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  metricValue: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.primary, marginTop: 1 },
  methodBtn: { backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', paddingVertical: spacing.sm },
  methodBtnText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.sm },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 46 },
  searchInput: { flex: 1, fontSize: font.size.base, color: colors.textStrong, paddingVertical: 8 },
  filterRow: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  filterChipOn: { backgroundColor: colors.primary },
  filterText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  filterTextOn: { color: colors.white },

  row: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  invName: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  invContact: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaText: { fontSize: font.size.xs, color: colors.textMuted },
  metaStrong: { textTransform: 'capitalize', fontWeight: font.semibold, color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionPrimary: { fontSize: font.size.sm, color: colors.primary, fontWeight: font.semibold },
  actionDanger: { fontSize: font.size.sm, color: colors.danger, fontWeight: font.semibold },

  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
