import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, Chip, IconBubble } from '../../components/ui';
import type { AppTabsParamList, AppStackParamList } from '../../navigation/types';
import { BubbleTint } from '../../components/ui/IconBubble';
import { tontinesApi } from '../../lib/api/tontines';
import { membersApi } from '../../lib/api/members';
import { notificationsApi, type NotificationPreference } from '../../lib/api/notifications';
import SignatureModal from '../../components/bureau/SignatureModal';
import { useAuthStore } from '../../lib/stores/auth-store';
import { logout } from '../../lib/auth/session';
import { usePermissions } from '../../lib/hooks/use-permissions';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={[styles.switch, { backgroundColor: on ? colors.green[500] : colors.surfaceMuted, alignItems: on ? 'flex-end' : 'flex-start' }]}>
      <View style={styles.knob} />
    </Pressable>
  );
}

function Row({
  icon,
  tint,
  label,
  value,
  right,
  first,
  onPress,
}: {
  icon: IoniconName;
  tint?: BubbleTint;
  label: string;
  value?: string;
  right?: React.ReactNode;
  first?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.row, !first && styles.rowDivider]}>
      <IconBubble icon={icon} tint={tint ?? 'white'} size={36} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right ?? <Ionicons name="chevron-forward" size={16} color={colors.textLight} />}
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabsParamList, 'Profil'>,
  NativeStackNavigationProp<AppStackParamList>
>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const assoc = useAuthStore((s) => s.activeAssociation);
  const membership = useAuthStore((s) => s.currentMembership);
  const setCurrentMembership = useAuthStore((s) => s.setCurrentMembership);
  const { isPresident, isBureau } = usePermissions();
  const qc = useQueryClient();

  const [signVisible, setSignVisible] = React.useState(false);
  const hasSignature = !!(membership?.has_signature || membership?.signature_reference);

  // Préférences de notification (le toggle reflète push_enabled côté serveur).
  const prefsQ = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: notificationsApi.preferences,
  });
  const prefsMut = useMutation({
    mutationFn: (push_enabled: boolean) => notificationsApi.updatePreferences({ push_enabled }),
    onMutate: async (push_enabled) => {
      await qc.cancelQueries({ queryKey: ['notifications', 'preferences'] });
      const prev = qc.getQueryData<NotificationPreference>(['notifications', 'preferences']);
      qc.setQueryData<NotificationPreference>(
        ['notifications', 'preferences'],
        (old) => (old ? { ...old, push_enabled } : old),
      );
      return { prev };
    },
    onError: (_err, _val, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications', 'preferences'], ctx.prev);
      Alert.alert('Erreur', "Impossible de mettre à jour vos préférences de notification.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications', 'preferences'] }),
  });
  const notif = prefsQ.data?.push_enabled ?? true;
  const toggleNotif = () => {
    if (prefsQ.isLoading || prefsMut.isPending) return;
    prefsMut.mutate(!notif);
  };

  const subsQ = useQuery({ queryKey: ['tontines', 'subs'], queryFn: () => tontinesApi.subscriptions() });
  const tontinesCount = (subsQ.data ?? []).filter((s) => !membership || s.membership === membership.id).length;

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  const roleLabel = isPresident ? 'Président' : isBureau ? 'Bureau' : 'Membre';
  const joined = membership?.joined_date ? new Date(membership.joined_date) : null;
  const joinedLabel = joined ? `${MONTHS_FR[joined.getMonth()]} ${joined.getFullYear()}` : '—';

  const soon = (t: string) => Alert.alert(t, 'Cette fonctionnalité arrive bientôt.');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
          <Pressable onPress={() => navigation.navigate('EditProfile')} hitSlop={8} style={styles.editBtn}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {/* Hero */}
        <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>
                {user?.first_name} {user?.last_name}
              </Text>
              <Text style={styles.phone}>{user?.telephone}</Text>
              <View style={styles.chipWrap}>
                <Chip label={roleLabel} tint="green" />
              </View>
            </View>
          </View>

          <View style={styles.miniRow}>
            <View style={styles.miniCol}>
              <Text style={styles.miniValue}>{tontinesCount}</Text>
              <Text style={styles.miniLabel}>Tontines</Text>
            </View>
            <View style={styles.miniDivider} />
            <View style={styles.miniCol}>
              <Text style={styles.miniValueDark}>{membership?.member_number ?? '—'}</Text>
              <Text style={styles.miniLabel}>N° membre</Text>
            </View>
            <View style={styles.miniDivider} />
            <View style={styles.miniCol}>
              <Text style={styles.miniValueDark}>{joinedLabel}</Text>
              <Text style={styles.miniLabel}>Membre depuis</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Espace Bureau (réservé aux membres du bureau) */}
        {isBureau ? (
          <Pressable onPress={() => navigation.navigate('Bureau', { screen: 'BureauDashboard' })}>
            <View style={styles.bureauCard}>
              <View style={styles.bureauIcon}>
                <Ionicons name="briefcase" size={22} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.bureauTitle}>Espace Bureau</Text>
                <Text style={styles.bureauSub}>Gérer la tontine — {roleLabel}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </View>
          </Pressable>
        ) : null}

        {/* Compte */}
        <SectionLabel>Compte</SectionLabel>
        <Card style={styles.card}>
          <Row icon="create-outline" tint="white" label="Modifier mon profil" first onPress={() => navigation.navigate('EditProfile')} />
          <Row icon="lock-closed" tint="white" label="Changer le mot de passe" onPress={() => navigation.navigate('ChangePassword')} />
          <Row icon="shield-checkmark" tint="white" label="Sécurité & connexion" onPress={() => navigation.navigate('Security')} />
        </Card>

        {/* Préférences */}
        <SectionLabel>Préférences</SectionLabel>
        <Card style={styles.card}>
          <Row
            icon="notifications-outline"
            tint="white"
            label="Notifications"
            first
            right={<Switch on={notif} onToggle={toggleNotif} />}
            onPress={toggleNotif}
          />
          <Row icon="globe" tint="white" label="Langue" value="Français" onPress={() => soon('Langue')} />
        </Card>

        {/* Mon association */}
        <SectionLabel>Mon association</SectionLabel>
        <Card style={styles.card}>
          <Row icon="business" tint="white" label="Mon adhésion" value={assoc?.name} first onPress={() => navigation.navigate('MyAssociations')} />
          <Row icon="document-text" tint="white" label="Mes procurations" onPress={() => navigation.navigate('Procurations')} />
          {membership ? (
            <Row
              icon="create-outline"
              tint="white"
              label="Ma signature"
              value={hasSignature ? 'Enregistrée' : 'À ajouter'}
              onPress={() => setSignVisible(true)}
            />
          ) : null}
        </Card>

        {/* Support */}
        <SectionLabel>Support</SectionLabel>
        <Card style={styles.card}>
          <Row icon="help-circle" tint="white" label="Aide & FAQ" first onPress={() => soon('Aide & FAQ')} />
          <Row icon="document-text" tint="white" label="Conditions d'utilisation" onPress={() => soon("Conditions d'utilisation")} />
          <Row icon="information-circle" tint="white" label="À propos" value="v1.0.0" onPress={() => soon('À propos')} />
        </Card>

        {/* Logout */}
        <Pressable style={styles.logout} onPress={() => logout()}>
          <Ionicons name="log-out-outline" size={18} color="#7A4044" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>

        <Text style={styles.footer}>TontineX360 · TIM SARL · Douala</Text>
      </ScrollView>

      {membership ? (
        <SignatureModal
          visible={signVisible}
          onClose={() => setSignVisible(false)}
          subject={{
            title: hasSignature ? 'Modifier ma signature' : 'Enregistrer ma signature',
            memberName: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Ma signature',
            contextLine: 'Signature de référence — servira à valider vos bordereaux.',
          }}
          referenceSignatureUrl={membership.signature_reference ?? null}
          showReference={false}
          note="Dessinez votre signature. Elle sera enregistrée comme référence et comparée lors de la signature de vos reçus."
          primaryLabel="Enregistrer"
          signFn={async (sig) => {
            const updated = await membersApi.setSignature(membership.id, sig);
            setCurrentMembership(updated);
            qc.invalidateQueries({ queryKey: ['members'] });
          }}
          onSigned={() => setSignVisible(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  title: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text },
  editBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...cardShadow },

  hero: { borderRadius: radius.hero, padding: 20, ...cardShadow },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  avatarText: { color: colors.primary, fontWeight: font.bold, fontSize: 24 },
  name: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.white },
  phone: { fontSize: font.size.sm, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  chipWrap: { marginTop: 8 },

  miniRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 16, padding: 14, marginTop: 16, ...cardShadow },
  miniCol: { flex: 1, alignItems: 'center' },
  miniDivider: { width: 1, backgroundColor: colors.surfaceAlt },
  miniValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  miniValueDark: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  miniLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  bureauCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.greenBg, ...cardShadow },
  bureauIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  bureauTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  bureauSub: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },

  sectionLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginLeft: 4, marginBottom: -6 },
  card: { borderRadius: radius.lg, paddingVertical: 4, ...cardShadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  rowLabel: { flex: 1, fontSize: font.size.md, fontWeight: font.medium, color: colors.text },
  rowValue: { fontSize: font.size.sm, color: colors.textMuted },

  switch: { width: 46, height: 28, borderRadius: 999, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  logoutText: { color: '#7A4044', fontWeight: font.semibold, fontSize: font.size.base },
  footer: { textAlign: 'center', fontSize: font.size.xs, color: colors.textLight, paddingBottom: 4 },
});
