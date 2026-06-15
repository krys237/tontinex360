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
import { notificationsApi, type NotificationPreference } from '../../lib/api/notifications';
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
      <IconBubble icon={icon} tint={tint ?? 'lime'} size={36} />
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
  const { isPresident, isBureau } = usePermissions();
  const qc = useQueryClient();

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
          <Pressable onPress={() => soon('Modifier mon profil')} hitSlop={8} style={styles.editBtn}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {/* Hero */}
        <LinearGradient colors={[colors.greenBg, colors.greenBgDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroRow}>
            <LinearGradient colors={[colors.green[500], colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </LinearGradient>
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
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bureauCard}
            >
              <View style={styles.bureauIcon}>
                <Ionicons name="briefcase" size={22} color={colors.white} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.bureauTitle}>Espace Bureau</Text>
                <Text style={styles.bureauSub}>Gérer la tontine — {roleLabel}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.white} />
            </LinearGradient>
          </Pressable>
        ) : null}

        {/* Compte */}
        <SectionLabel>Compte</SectionLabel>
        <Card style={styles.card}>
          <Row icon="create-outline" tint="lime" label="Modifier mon profil" first onPress={() => soon('Modifier mon profil')} />
          <Row icon="lock-closed" tint="primary" label="Changer le mot de passe" onPress={() => soon('Changer le mot de passe')} />
          <Row icon="shield-checkmark" tint="accent" label="Sécurité & connexion" onPress={() => soon('Sécurité')} />
        </Card>

        {/* Préférences */}
        <SectionLabel>Préférences</SectionLabel>
        <Card style={styles.card}>
          <Row
            icon="notifications-outline"
            tint="primary"
            label="Notifications"
            first
            right={<Switch on={notif} onToggle={toggleNotif} />}
            onPress={toggleNotif}
          />
          <Row icon="globe" tint="info" label="Langue" value="Français" onPress={() => soon('Langue')} />
        </Card>

        {/* Mon association */}
        <SectionLabel>Mon association</SectionLabel>
        <Card style={styles.card}>
          <Row icon="business" tint="lime" label="Mon adhésion" value={assoc?.name} first onPress={() => soon('Mon adhésion')} />
          <Row icon="document-text" tint="primary" label="Mes procurations" onPress={() => navigation.navigate('Procurations')} />
        </Card>

        {/* Support */}
        <SectionLabel>Support</SectionLabel>
        <Card style={styles.card}>
          <Row icon="help-circle" tint="lime" label="Aide & FAQ" first onPress={() => soon('Aide & FAQ')} />
          <Row icon="document-text" tint="primary" label="Conditions d'utilisation" onPress={() => soon("Conditions d'utilisation")} />
          <Row icon="information-circle" tint="info" label="À propos" value="v1.0.0" onPress={() => soon('À propos')} />
        </Card>

        {/* Logout */}
        <Pressable style={styles.logout} onPress={() => logout()}>
          <Ionicons name="log-out-outline" size={18} color="#7A4044" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>

        <Text style={styles.footer}>TontineX360 · TIM SARL · Douala</Text>
      </ScrollView>
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
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: font.bold, fontSize: 24 },
  name: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  phone: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  chipWrap: { marginTop: 8 },

  miniRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 16, padding: 14, marginTop: 16, ...cardShadow },
  miniCol: { flex: 1, alignItems: 'center' },
  miniDivider: { width: 1, backgroundColor: colors.surfaceAlt },
  miniValue: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  miniValueDark: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  miniLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  bureauCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: spacing.lg, ...cardShadow },
  bureauIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  bureauTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  bureauSub: { fontSize: font.size.xs, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

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
