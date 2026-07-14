import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, IconBubble } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import { notificationsApi } from '../../lib/api/notifications';
import { useAuthStore } from '../../lib/stores/auth-store';
import { logout } from '../../lib/auth/session';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function InfoLine({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
      {hint ? <Text style={styles.infoHint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Sécurité & connexion — volontairement limité à ce que le backend expose.
 * Il n'existe aujourd'hui aucun endpoint de gestion des sessions/appareils
 * connectés : on ne prétend donc pas les afficher.
 */
export default function SecurityScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);

  const prefsQ = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: notificationsApi.preferences,
  });
  const pushOn = prefsQ.data?.push_enabled;

  const confirmLogout = () => {
    Alert.alert('Se déconnecter', 'Vous devrez saisir à nouveau votre mot de passe.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Identifiants</Text>
        <Card style={styles.card}>
          <InfoLine
            label="Téléphone"
            value={user?.telephone ?? '—'}
            hint="Identifie votre compte. Non modifiable."
          />
          <View style={styles.divider} />
          <InfoLine
            label="Email"
            value={user?.email || 'Non renseigné'}
            hint={
              user?.email
                ? 'Peut servir de canal de secours pour recevoir un code.'
                : "Ajoutez un email dans « Modifier mon profil » pour disposer d'un canal de secours."
            }
          />
        </Card>

        <Text style={styles.sectionLabel}>Mot de passe</Text>
        <Card style={styles.card}>
          <Pressable style={styles.row} onPress={() => navigation.navigate('ChangePassword')}>
            <IconBubble icon="lock-closed" tint="white" size={36} />
            <Text style={styles.rowLabel}>Changer le mot de passe</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </Pressable>
        </Card>

        <Text style={styles.sectionLabel}>Cet appareil</Text>
        <Card style={styles.card}>
          <View style={styles.row}>
            <IconBubble icon="notifications-outline" tint="white" size={36} />
            <Text style={styles.rowLabel}>Notifications push</Text>
            <Text style={styles.rowValue}>
              {prefsQ.isLoading ? '…' : pushOn ? 'Activées' : 'Désactivées'}
            </Text>
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={confirmLogout}>
            <IconBubble icon="log-out-outline" tint="danger" size={36} />
            <Text style={[styles.rowLabel, styles.dangerLabel]}>Se déconnecter de cet appareil</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </Pressable>
        </Card>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={16} color={colors.textMuted} />
          <Text style={styles.noteText}>
            La liste des appareils connectés et l'historique de connexion ne sont pas encore
            disponibles.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.x5 },
  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
    marginBottom: -6,
  },
  card: { borderRadius: radius.lg, paddingVertical: 4, ...cardShadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowLabel: { flex: 1, fontSize: font.size.md, fontWeight: font.medium, color: colors.text },
  rowValue: { fontSize: font.size.sm, color: colors.textMuted },
  dangerLabel: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.surfaceAlt },
  infoLine: { paddingVertical: 12 },
  infoLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  infoValue: { fontSize: font.size.base, fontWeight: font.bold, color: colors.text, marginTop: 2 },
  infoHint: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  noteText: { flex: 1, fontSize: font.size.xs, color: colors.textMuted, lineHeight: 16 },
});
