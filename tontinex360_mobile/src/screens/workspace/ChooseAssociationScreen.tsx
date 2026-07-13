import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { WorkspaceStackParamList } from '../../navigation/types';
import type { Association } from '../../lib/types/auth';
import { useAuthStore } from '../../lib/stores/auth-store';
import { switchAssociation, logout } from '../../lib/auth/session';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { IconBubble } from '../../components/ui';

type Props = NativeStackScreenProps<WorkspaceStackParamList, 'ChooseAssociation'>;

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function ChooseAssociationScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const associations = useAuthStore((s) => s.associations);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const onEnter = async (a: Association) => {
    setLoadingSlug(a.slug);
    try {
      await switchAssociation(a); // active association set -> RootNavigator switches to App
    } catch {
      Alert.alert('Erreur', "Impossible d'entrer dans cette association. Réessayez.");
      setLoadingSlug(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={[colors.primary, colors.green[600]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.hello}>Bonjour {user?.first_name ?? ''}</Text>
          <Text style={styles.heroTitle}>
            Vous appartenez à {associations.length} association{associations.length > 1 ? 's' : ''}
          </Text>
          <Text style={styles.heroSub}>
            Choisissez celle dans laquelle vous voulez entrer. Vous pouvez aussi en créer une nouvelle ou en rejoindre une autre.
          </Text>
        </LinearGradient>

        {/* Liste des associations */}
        {associations.map((a) => (
          <Pressable key={a.id} style={styles.assoCard} onPress={() => onEnter(a)} disabled={!!loadingSlug}>
            <View style={styles.assoLogo}><Text style={styles.assoLogoText}>{initials(a.name)}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.assoName}>{a.name}</Text>
              <Text style={styles.assoMeta}>{[a.city, a.slug].filter(Boolean).join(' · ')}</Text>
            </View>
            {loadingSlug === a.slug ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="arrow-forward" size={18} color={colors.textLight} />
            )}
          </Pressable>
        ))}

        {/* Autres actions */}
        <Text style={styles.sectionLabel}>Autres actions</Text>
        <ActionRow icon="add" label="Créer une association" onPress={() => navigation.navigate('CreateAssociation')} />
        <ActionRow icon="search" label="Rejoindre une association" onPress={() => navigation.navigate('JoinRequest')} />
        <ActionRow icon="documents-outline" label="Mes demandes" onPress={() => navigation.navigate('MyJoinRequests')} />

        <Pressable onPress={() => logout()} hitSlop={8} style={styles.logout}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
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

  hero: { 
    borderRadius: radius.hero, 
    padding: 24, 
    gap: 10, 
    backgroundColor: colors.primary, 
    ...cardShadow 
  },
  hello: { 
    color: 'rgba(255, 255, 255, 0.9)', 
    fontSize: font.size.base, 
    fontWeight: font.medium 
  },
  heroTitle: { 
    color: colors.white, 
    fontSize: 24, 
    fontWeight: font.bold, 
    lineHeight: 30 
  },
  heroSub: { 
    color: 'rgba(255, 255, 255, 0.85)', 
    fontSize: font.size.sm, 
    lineHeight: 18, 
    marginTop: 2 
  },

  assoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs, ...cardShadow },
  assoLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  assoLogoText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.primary },
  assoName: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  assoMeta: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },

  sectionLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing.lg, marginBottom: 2, marginLeft: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  actionLabel: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  chevron: { marginLeft: 'auto' },

  logout: { marginTop: spacing.xl, alignItems: 'center' },
  logoutText: { color: colors.textMuted, fontWeight: font.semibold },
});
