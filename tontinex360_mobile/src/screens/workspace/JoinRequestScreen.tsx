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
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type Props = NativeStackScreenProps<WorkspaceStackParamList, 'JoinRequest'>;

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function JoinRequestScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

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
