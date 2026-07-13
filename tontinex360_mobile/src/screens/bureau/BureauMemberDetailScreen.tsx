import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, IconBubble } from '../../components/ui';
import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import TabsRow from '../../components/bureau/TabsRow';
import RequirePermission from '../../components/bureau/RequirePermission';
import type { BureauStackParamList } from '../../navigation/types';
import type { MembershipStatus } from '../../lib/types/member';
import type { ApprovalActionType } from '../../lib/types/approval';
import { membersApi } from '../../lib/api/members';
import { approvalsApi } from '../../lib/api/approvals';
import { walletsApi } from '../../lib/api/wallets';
import { financeApi } from '../../lib/api/finance';
import { potsApi } from '../../lib/api/pots';
import { chatApi } from '../../lib/api/chat';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { formatXAF, formatDateFr, timeAgo } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauMemberDetail'>;
type Rt = RouteProp<BureauStackParamList, 'BureauMemberDetail'>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const MEMBER_STATUS: Record<MembershipStatus, { label: string; tone: StatusTone }> = {
  active: { label: 'Actif', tone: 'success' },
  pending: { label: 'En attente', tone: 'warning' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  expelled: { label: 'Exclu', tone: 'danger' },
  resigned: { label: 'Démissionnaire', tone: 'muted' },
};

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

type Activity = { id: string; icon: IoniconName; tint: any; title: string; desc: string; at?: string; badge: { label: string; tone: StatusTone } };

export default function BureauMemberDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { id } = useRoute<Rt>().params;
  const [tab, setTab] = useState<'activity' | 'bureau' | 'profile'>('activity');

  const memberQ = useQuery({ queryKey: ['bureau', 'member', id], queryFn: () => membersApi.get(id) });
  const walletsQ = useQuery({ queryKey: ['bureau', 'wallets'], queryFn: () => walletsApi.list() });
  const contribQ = useQuery({ queryKey: ['bureau', 'member-contributions', id], queryFn: () => financeApi.contributions({ membership: id }) });
  const payoutsQ = useQuery({ queryKey: ['bureau', 'payouts'], queryFn: () => potsApi.payouts() });

  const requestApproval = useMutation({
    mutationFn: (vars: { action: ApprovalActionType; reason: string }) =>
      approvalsApi.request(vars.action, id, {}, vars.reason),
    onSuccess: (req) => {
      Alert.alert('Demande envoyée', 'L’action a été soumise à validation du bureau.', [
        { text: 'Voir', onPress: () => navigation.navigate('BureauApprovalDetail', { id: req.id }) },
        { text: 'OK' },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const messageMut = useMutation({
    mutationFn: () => chatApi.createPrivate(id),
    onSuccess: (conv) => {
      const name = memberQ.data ? `${memberQ.data.user?.first_name ?? ''} ${memberQ.data.user?.last_name ?? ''}`.trim() : 'Membre';
      navigation.getParent()?.navigate('Conversation', { id: conv.id, title: name });
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const confirmAction = (action: ApprovalActionType, label: string) =>
    Alert.alert(label, 'Cette action sera soumise à la double validation du bureau. Confirmer ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', style: 'destructive', onPress: () => requestApproval.mutate({ action, reason: `${label} via l'application mobile` }) },
    ]);

  const m = memberQ.data;

  const wallet = (walletsQ.data ?? []).find((w) => w.membership === id);
  const balance = Number(wallet?.balance ?? 0);

  const activities = useMemo<Activity[]>(() => {
    const out: Activity[] = [];
    (contribQ.data ?? [])
      .filter((c) => c.paid_at || c.status === 'paid' || c.status === 'partial')
      .forEach((c) => out.push({
        id: `c-${c.id}`,
        icon: 'card', tint: 'lime',
        title: 'Cotisation enregistrée',
        desc: `${formatXAF(Number(c.paid_amount ?? 0))}${c.status === 'partial' ? ' (partielle)' : ''}`,
        at: c.paid_at,
        badge: c.status === 'paid' ? { label: 'Payée', tone: 'success' } : { label: 'Partielle', tone: 'warning' },
      }));
    (payoutsQ.data ?? [])
      .filter((p) => p.membership === id)
      .forEach((p) => out.push({
        id: `p-${p.id}`,
        icon: 'cash', tint: 'accent',
        title: 'Versement reçu',
        desc: `${formatXAF(Number(p.amount ?? 0))}${p.tontine_name ? ` · ${p.tontine_name}` : ''}`,
        at: p.paid_at ?? undefined,
        badge: p.status === 'paid' ? { label: 'Versé', tone: 'success' } : { label: 'En attente', tone: 'warning' },
      }));
    return out.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).slice(0, 8);
  }, [contribQ.data, payoutsQ.data, id]);

  if (memberQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }
  if (!m) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.errorText}>Membre introuvable.</Text>
      </SafeAreaView>
    );
  }

  const st = MEMBER_STATUS[m.status] ?? MEMBER_STATUS.pending;
  const fullName = `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.trim();
  const inits = `${m.user?.first_name?.[0] ?? ''}${m.user?.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  const roles = (m.roles ?? []).filter((r) => r.is_active);
  const roleLabel = roles[0]?.role?.name ?? 'Membre';

  const score = (m.status === 'active' ? 60 : 0) + (m.has_signature ? 20 : 0) + (balance >= 0 ? 20 : 0);
  const scoreLabel = score >= 80 ? 'Très engagé' : score >= 60 ? 'Engagé' : score >= 40 ? 'Moyen' : 'À suivre';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identité */}
        <Card style={styles.headCard}>
          <View style={styles.headTop}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{inits}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.name}>{fullName}</Text>
              <Text style={styles.num}>#{m.member_number}</Text>
              <View style={styles.badges}>
                <View style={[styles.badge, styles.badgeGreen]}><Text style={styles.badgeGreenText}>{roleLabel}</Text></View>
                <View style={[styles.badge, styles.badgeStatus]}>
                  <View style={[styles.dot, { backgroundColor: st.tone === 'success' ? colors.success : colors.goldAccent }]} />
                  <Text style={styles.badgeStatusText}>{st.label}</Text>
                </View>
                {m.has_signature ? (
                  <View style={[styles.badge, styles.badgeBlue]}>
                    <Ionicons name="checkmark-circle" size={11} color={colors.info} />
                    <Text style={styles.badgeBlueText}>Signature</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          <View style={styles.divider} />
          <ContactRow icon="call-outline" text={m.user?.telephone || '—'} />
          {m.user?.email ? <ContactRow icon="mail-outline" text={m.user.email} /> : null}
          <ContactRow icon="calendar-outline" text={`Adhésion : ${formatDateFr(m.joined_date, false) || '—'}`} />
        </Card>

        {/* Engagement hero */}
        <LinearGradient colors={[colors.green[500], colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroScore}>{score}</Text>
            <Text style={styles.heroScoreLabel}>{scoreLabel}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>WALLET</Text>
            <Text style={styles.heroStatValue}>{formatXAF(balance)}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>STATUT</Text>
            <Text style={styles.heroStatValue}>{st.label}</Text>
          </View>
        </LinearGradient>

        {/* Onglets */}
        <View style={styles.tabsWrap}>
          <TabsRow
            tabs={[
              { key: 'activity', label: 'Activité' },
              { key: 'bureau', label: 'Bureau' },
              { key: 'profile', label: 'Profil', badge: roles.length || undefined },
            ]}
            active={tab}
            onChange={(k) => setTab(k as typeof tab)}
          />
        </View>

        {tab === 'activity' ? (
        <>
        {/* Actions Rapides */}
        <Card style={styles.card}>
          <View style={styles.sectionHead}>
            <Ionicons name="flash" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Actions Rapides</Text>
          </View>
          <View style={styles.qaGrid}>
            <QuickAction category="FINANCE" label="Ajouter une contribution" icon="add" variant="filled" onPress={() => navigation.navigate('BureauFinance')} />
            <QuickAction category="WALLET" label="Ajuster le solde" icon="wallet-outline" variant="outline" onPress={() => navigation.navigate('BureauWallets')} />
            <QuickAction category="COMMUNICATION" label="Envoyer message" icon="chatbubble-outline" variant="filled" loading={messageMut.isPending} onPress={() => messageMut.mutate()} />
            {m.status !== 'suspended' ? (
              <QuickAction category="ADMINISTRATION" label="Suspendre le membre" icon="ban-outline" variant="danger" onPress={() => confirmAction('member.suspend', 'Suspension du membre')} />
            ) : null}
          </View>
        </Card>

        {/* Activité Temps Réel */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Activité Temps Réel</Text>
          {contribQ.isLoading || payoutsQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : activities.length === 0 ? (
            <Text style={styles.muted}>Aucune activité récente.</Text>
          ) : (
            activities.map((a, i) => (
              <View key={a.id} style={[styles.actRow, i > 0 && styles.actDivider]}>
                <IconBubble icon={a.icon} tint={a.tint} size={36} />
                <View style={styles.flex}>
                  <Text style={styles.actTitle}>{a.title}</Text>
                  <Text style={styles.actDesc} numberOfLines={1}>{a.desc}</Text>
                </View>
                <View style={styles.actRight}>
                  {a.at ? <Text style={styles.actTime}>{timeAgo(a.at)}</Text> : null}
                  <StatusChip label={a.badge.label} tone={a.badge.tone} />
                </View>
              </View>
            ))
          )}
        </Card>
        </>
        ) : null}

        {tab === 'bureau' ? (
        /* Actions bureau */
        <RequirePermission bureau>
          <Card style={styles.card}>
            <View style={styles.sectionHead}>
              <Ionicons name="shield-checkmark" size={16} color={colors.goldAccent} />
              <Text style={styles.sectionTitle}>Actions bureau (double validation)</Text>
            </View>
            <Text style={styles.muted}>Ces actions nécessitent l'approbation du Président + un autre membre du bureau.</Text>
            <View style={styles.qaGrid}>
              {m.status !== 'expelled' ? (
                <BureauAction category="SANCTION" label="Expulser" icon="person-remove-outline" color={colors.danger} onPress={() => confirmAction('member.expel', 'Exclusion du membre')} />
              ) : null}
              {m.status !== 'suspended' ? (
                <BureauAction category="DISCIPLINE" label="Suspendre" icon="pause-circle-outline" color={colors.goldAccent} onPress={() => confirmAction('member.suspend', 'Suspension du membre')} />
              ) : null}
              <BureauAction category="STATUT" label="Transférer fondateur" icon="ribbon-outline" color="#6D4FB0" onPress={() => confirmAction('member.transfer_founder', 'Transfert du statut de fondateur')} />
              <BureauAction category="BUREAU" label="Désigner au bureau" icon="people-outline" color={colors.info} onPress={() => confirmAction('member.designate_bureau', 'Désignation au bureau')} />
            </View>
          </Card>
        </RequirePermission>
        ) : null}

        {tab === 'profile' ? (
        <>
        {/* Signature de référence */}
        <Card style={styles.card}>
          <View style={styles.sectionHead}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Signature de référence</Text>
          </View>
          {m.has_signature && m.signature_reference ? (
            <>
              <Image source={{ uri: m.signature_reference }} style={styles.signature} resizeMode="contain" />
              <Text style={styles.muted}>Enregistrée le {formatDateFr(m.signature_reference_at ?? '', false) || '—'}</Text>
            </>
          ) : (
            <Text style={styles.muted}>Aucune signature de référence enregistrée.</Text>
          )}
        </Card>

        {/* Rôles */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Rôles ({roles.length})</Text>
          {roles.length === 0 ? (
            <Text style={styles.muted}>Aucun rôle actif (membre lambda).</Text>
          ) : (
            roles.map((r, i) => (
              <View key={r.id} style={[styles.roleRow, i > 0 && styles.actDivider]}>
                <View style={styles.flex}>
                  <Text style={styles.roleName}>{r.role?.name}</Text>
                  {r.role?.permissions?.length ? (
                    <Text style={styles.rolePerms} numberOfLines={2}>{r.role.permissions.join(', ')}</Text>
                  ) : null}
                </View>
                {r.role?.is_bureau_role ? <StatusChip label="Bureau" tone="info" /> : null}
              </View>
            ))
          )}
        </Card>
        </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({ icon, text }: { icon: IoniconName; text: string }) {
  return (
    <View style={styles.contactRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.contactText}>{text}</Text>
    </View>
  );
}

function QuickAction({
  category, label, icon, variant, loading, onPress,
}: { category: string; label: string; icon: IoniconName; variant: 'filled' | 'outline' | 'danger'; loading?: boolean; onPress: () => void }) {
  const isFilled = variant === 'filled';
  const isDanger = variant === 'danger';
  return (
    <View style={styles.qaCell}>
      <Text style={styles.qaCategory}>{category}</Text>
      <Pressable
        style={[styles.qaBtn, isFilled && styles.qaFilled, isDanger && styles.qaDanger, variant === 'outline' && styles.qaOutline]}
        onPress={loading ? undefined : onPress}>
        {loading ? (
          <ActivityIndicator size="small" color={isFilled ? colors.white : colors.primary} />
        ) : (
          <>
            <Ionicons name={icon} size={15} color={isFilled ? colors.white : isDanger ? colors.danger : colors.primary} />
            <Text style={[styles.qaLabel, isFilled && styles.qaLabelFilled, isDanger && styles.qaLabelDanger]} numberOfLines={2}>{label}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function BureauAction({ category, label, icon, color, onPress }: { category: string; label: string; icon: IoniconName; color: string; onPress: () => void }) {
  return (
    <View style={styles.qaCell}>
      <Text style={styles.qaCategory}>{category}</Text>
      <Pressable style={[styles.qaBtn, styles.qaOutline, { borderColor: color }]} onPress={onPress}>
        <Ionicons name={icon} size={15} color={color} />
        <Text style={[styles.qaLabel, { color }]} numberOfLines={2}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  errorText: { textAlign: 'center', marginTop: spacing.x4, color: colors.textMuted },

  headCard: { borderRadius: radius.lg, gap: spacing.sm },
  headTop: { flexDirection: 'row', gap: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: font.bold },
  name: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  num: { fontSize: font.size.sm, color: colors.textLight, marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  badgeGreen: { backgroundColor: colors.greenBg },
  badgeGreenText: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.primary },
  badgeStatus: { backgroundColor: colors.greenBgDeep },
  badgeStatusText: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.text },
  badgeBlue: { backgroundColor: colors.blue[100] },
  badgeBlueText: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.info },
  dot: { width: 6, height: 6, borderRadius: 3 },
  divider: { height: 1, backgroundColor: colors.surfaceAlt },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  contactText: { fontSize: font.size.sm, color: colors.text },

  hero: { borderRadius: radius.hero, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.primary, ...cardShadow },
  heroTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  heroScore: { fontSize: 40, fontWeight: font.bold, color: colors.white, lineHeight: 44 },
  heroScoreLabel: { fontSize: font.size.md, fontWeight: font.semibold, color: 'rgba(255,255,255,0.9)' },
  heroStat: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  heroStatLabel: { fontSize: 10, fontWeight: font.bold, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
  heroStatValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white, marginTop: 1 },

  tabsWrap: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg },
  card: { borderRadius: radius.lg, gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  cardTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginBottom: 2 },
  muted: { fontSize: font.size.sm, color: colors.textMuted },

  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  qaCell: { width: '47%', flexGrow: 1, gap: 4 },
  qaCategory: { fontSize: 10, fontWeight: font.semibold, color: colors.textLight, letterSpacing: 0.4 },
  qaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.md, minHeight: 58 },
  qaFilled: { backgroundColor: colors.primary },
  qaOutline: { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  qaDanger: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.white },
  qaLabel: { flexShrink: 1, fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary, lineHeight: 17 },
  qaLabelFilled: { color: colors.white },
  qaLabelDanger: { color: colors.danger },

  actRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  actDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  actTitle: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  actDesc: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  actRight: { alignItems: 'flex-end', gap: 3 },
  actTime: { fontSize: 10, color: colors.textLight },


  signature: { width: '100%', height: 120, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },

  roleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  roleName: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rolePerms: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 2 },
});
