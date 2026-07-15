import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { IconBubble } from '../../components/ui';
import type { AppStackParamList } from '../../navigation/types';
import type { Association } from '../../lib/types/auth';
import { useAuthStore } from '../../lib/stores/auth-store';
import { switchAssociation } from '../../lib/auth/session';
import { apiErrorMessage } from '../../lib/utils/errors';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

/**
 * Switcher d'associations, non destructif, ouvert depuis « Mon adhésion ».
 *
 * Basculer appelle `switchAssociation`, qui change `activeAssociation.slug` :
 * `RootNavigator` étant clefé sur ce slug, tout AppStack se remonte à neuf sur
 * l'Accueil du nouveau tenant — inutile (et impossible) de faire un goBack ici,
 * l'écran est démonté par le remontage.
 */
export default function MyAssociationsScreen() {
  const navigation = useNavigation<Nav>();
  const associations = useAuthStore((s) => s.associations);
  const active = useAuthStore((s) => s.activeAssociation);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const onSelect = async (a: Association) => {
    if (a.slug === active?.slug) {
      navigation.goBack();
      return;
    }
    setLoadingSlug(a.slug);
    try {
      // Ne rien enchaîner après : le remontage d'AppStack (key=slug) prend le relais.
      await switchAssociation(a);
    } catch (e) {
      Alert.alert(
        'Impossible de basculer',
        apiErrorMessage(e, 'Impossible de basculer vers cette association. Réessayez.'),
      );
      setLoadingSlug(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>
          {associations.length > 1 ? 'Basculer d’association' : 'Mon association'}
        </Text>

        {associations.map((a) => {
          const on = a.slug === active?.slug;
          return (
            <Pressable
              key={a.id}
              style={[styles.assoCard, on && styles.assoCardActive]}
              onPress={() => onSelect(a)}
              disabled={!!loadingSlug}>
              <View style={styles.assoLogo}>
                <Text style={styles.assoLogoText}>{initials(a.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.assoName}>{a.name}</Text>
                <Text style={styles.assoMeta}>
                  {[a.city, a.slug].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              {loadingSlug === a.slug ? (
                <ActivityIndicator color={colors.primary} />
              ) : on ? (
                <View style={styles.activeBadge}>
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                </View>
              ) : (
                <Ionicons name="swap-horizontal" size={18} color={colors.textLight} />
              )}
            </Pressable>
          );
        })}

        <Text style={styles.sectionLabel}>Autres actions</Text>
        <ActionRow icon="add" label="Créer une association" onPress={() => navigation.navigate('CreateAssociation')} />
        <ActionRow icon="search" label="Rejoindre une association" onPress={() => navigation.navigate('JoinRequest')} />
        <ActionRow icon="documents-outline" label="Mes demandes d'adhésion" onPress={() => navigation.navigate('MyJoinRequests')} />

        <Text style={styles.hint}>
          Basculer d'association recharge l'application sur l'espace de la nouvelle association.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionRow({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <IconBubble icon={icon} tint="white" size={36} />
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textLight} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.x5 },

  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.md,
    marginBottom: 2,
    marginLeft: 4,
  },

  assoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs, ...cardShadow },
  assoCardActive: { borderWidth: 1, borderColor: colors.primary },
  assoLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assoLogoText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  assoName: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  assoMeta: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },
  activeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  actionLabel: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  chevron: { marginLeft: 'auto' },

  hint: { fontSize: font.size.xs, color: colors.textMuted, marginTop: spacing.md, marginHorizontal: 4, lineHeight: 16 },
});
