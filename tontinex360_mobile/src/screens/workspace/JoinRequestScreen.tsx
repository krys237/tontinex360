import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { WorkspaceStackParamList } from '../../navigation/types';
import type { AssociationSearchResult } from '../../lib/types/auth';
import { authApi } from '../../lib/api/auth';
import { membersApi } from '../../lib/api/members';
import { invitationsApi, type InvitationCheck } from '../../lib/api/invitations';
import { refreshWorkspace } from '../../lib/auth/session';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type Props = NativeStackScreenProps<WorkspaceStackParamList, 'JoinRequest'>;

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Extrait le token d'invitation d'un texte collé (token brut ou lien complet). */
function extractToken(raw: string): string {
  const t = raw.trim();
  if (!t.includes('/')) return t;
  const path = t.split('?')[0].split('#')[0];
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

export default function JoinRequestScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  // ── Invitation par code/lien (utilisateur déjà connecté) ──
  const [inviteInput, setInviteInput] = useState('');
  const [checked, setChecked] = useState<InvitationCheck | null>(null);

  const checkMut = useMutation({
    mutationFn: (token: string) => invitationsApi.check(token),
    onSuccess: (res) => setChecked(res),
    onError: (e: any) => {
      setChecked(null);
      const status = e?.response?.status;
      Alert.alert(
        'Invitation invalide',
        status === 410
          ? 'Cette invitation a expiré ou a déjà été utilisée.'
          : status === 404
            ? 'Invitation introuvable — vérifiez le code ou le lien collé.'
            : e?.response?.data?.error ?? 'Vérification impossible pour le moment.',
      );
    },
  });

  const acceptMut = useMutation({
    mutationFn: (token: string) => invitationsApi.accept(token),
    onSuccess: async (res) => {
      setChecked(null);
      setInviteInput('');
      // Resynchronise la liste des associations : la nouvelle adhésion
      // apparaît dans ChooseAssociation sans se reconnecter.
      await refreshWorkspace().catch(() => {});
      Alert.alert('Bienvenue !', res.message ?? 'Invitation acceptée.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e: any) =>
      Alert.alert('Erreur', e?.response?.data?.error ?? e?.response?.data?.detail ?? "Impossible d'accepter l'invitation."),
  });

  const searchQ = useQuery({
    queryKey: ['assoc-search', trimmed],
    queryFn: () => authApi.searchAssociations(trimmed),
    enabled: trimmed.length >= 2,
  });

  const joinMut = useMutation({
    mutationFn: (slug: string) => membersApi.sendJoinRequest({ association_slug: slug }),
    onSuccess: () => {
      Alert.alert('Demande envoyée', "Votre demande d'adhésion a été transmise au bureau.", [
        { text: 'Voir mes demandes', onPress: () => navigation.navigate('MyJoinRequests') },
        { text: 'OK' },
      ]);
    },
    onError: (e: any) => Alert.alert('Erreur', e?.response?.data?.error ?? e?.response?.data?.detail ?? "Impossible d'envoyer la demande."),
  });

  const confirmJoin = (a: AssociationSearchResult) =>
    Alert.alert('Rejoindre', `Envoyer une demande d'adhésion à « ${a.name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Envoyer', onPress: () => joinMut.mutate(a.slug) },
    ]);

  const results = searchQ.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Rejoindre une association</Text>

        {/* Invitation reçue (code ou lien) */}
        <View style={styles.inviteCard}>
          <View style={styles.inviteHead}>
            <Ionicons name="mail-open-outline" size={18} color={colors.primary} />
            <Text style={styles.inviteTitle}>J'ai reçu une invitation</Text>
          </View>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.inviteInput}
              placeholder="Collez le lien ou le code reçu…"
              placeholderTextColor={colors.textLight}
              value={inviteInput}
              onChangeText={(t) => {
                setInviteInput(t);
                setChecked(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[styles.inviteCheckBtn, (!extractToken(inviteInput) || checkMut.isPending) && { opacity: 0.5 }]}
              onPress={() => checkMut.mutate(extractToken(inviteInput))}
              disabled={!extractToken(inviteInput) || checkMut.isPending}>
              {checkMut.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.inviteCheckText}>Vérifier</Text>
              )}
            </Pressable>
          </View>

          {checked ? (
            <View style={styles.invitePreview}>
              <Text style={styles.invitePreviewName}>{checked.invitation.association_name}</Text>
              <Text style={styles.invitePreviewMeta}>
                Invité par {checked.invitation.invited_by} · rôle : {checked.invitation.role_name}
              </Text>
              {checked.invitation.message?.trim() ? (
                <Text style={styles.invitePreviewMsg}>« {checked.invitation.message.trim()} »</Text>
              ) : null}
              <Pressable
                style={[styles.inviteAcceptBtn, acceptMut.isPending && { opacity: 0.6 }]}
                onPress={() => acceptMut.mutate(checked.invitation.token)}
                disabled={acceptMut.isPending}>
                {acceptMut.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.inviteAcceptText}>Accepter l'invitation</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={styles.orLabel}>Ou recherchez une association :</Text>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nom de l'asso ou ville…"
            placeholderTextColor={colors.textLight}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textLight} /></Pressable>
          ) : null}
        </View>

        {trimmed.length < 2 ? (
          <Text style={styles.hint}>Saisissez au moins 2 caractères pour rechercher.</Text>
        ) : searchQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucune association trouvée. Essayez un autre terme.</Text>
          </View>
        ) : (
          results.map((a) => (
            <Pressable key={a.id} style={styles.card} onPress={() => confirmJoin(a)} disabled={joinMut.isPending}>
              <View style={styles.logo}><Text style={styles.logoText}>{initials(a.name)}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.name}>{a.name}</Text>
                {a.city ? <Text style={styles.meta}>{a.city}</Text> : null}
                {a.description ? <Text style={styles.desc} numberOfLines={2}>{a.description}</Text> : null}
              </View>
              {joinMut.isPending && joinMut.variables === a.slug ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: font.size.sm, color: colors.text, fontWeight: font.semibold },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },
  title: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.heading },

  // Invitation par code/lien
  inviteCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, ...cardShadow },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  inviteRow: { flexDirection: 'row', gap: 8 },
  inviteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 44,
    fontSize: font.size.sm,
    color: colors.text,
    backgroundColor: colors.white,
  },
  inviteCheckBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCheckText: { color: colors.white, fontSize: font.size.sm, fontWeight: font.bold },
  invitePreview: { backgroundColor: colors.greenBg, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  invitePreviewName: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  invitePreviewMeta: { fontSize: font.size.xs, color: colors.textMuted },
  invitePreviewMsg: { fontSize: font.size.sm, color: colors.text, fontStyle: 'italic' },
  inviteAcceptBtn: {
    marginTop: 6,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteAcceptText: { color: colors.white, fontSize: font.size.sm, fontWeight: font.bold },
  orLabel: { fontSize: font.size.sm, color: colors.textMuted, marginTop: spacing.xs },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 48, ...cardShadow },
  searchInput: { flex: 1, fontSize: font.size.md, color: colors.text, padding: 0 },
  hint: { fontSize: font.size.sm, color: colors.textLight, marginTop: spacing.sm, textAlign: 'center' },

  empty: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', ...cardShadow },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center' },

  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  logo: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.green[100], alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  name: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  meta: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  desc: { fontSize: font.size.xs, color: colors.textLight, marginTop: 2 },
});
