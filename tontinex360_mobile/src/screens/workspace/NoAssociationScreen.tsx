import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { WorkspaceStackParamList } from '../../navigation/types';
import { logout } from '../../lib/auth/session';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { IconBubble, GradientBackground } from '../../components/ui';

type Props = NativeStackScreenProps<WorkspaceStackParamList, 'NoAssociation'>;

export default function NoAssociationScreen({ navigation }: Props) {
  const showInviteHelp = () => {
    Alert.alert(
      "Lien d'invitation",
      "Si vous avez reçu une invitation par WhatsApp, e-mail ou SMS, cliquez simplement sur le lien fourni dans le message. Cela ouvrira l'application et vous permettra d'intégrer directement votre tontine.",
      [{ text: "Compris" }]
    );
  };

  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="business" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>Bienvenue sur TontineX360</Text>
          <Text style={styles.subtitle}>
            Vous n'êtes encore membre d'aucune association. Choisissez ce que vous souhaitez faire :
          </Text>
        </View>

        <View style={styles.list}>
          {/* Créer */}
          <Pressable style={styles.tile} onPress={() => navigation.navigate('CreateAssociation')}>
            <IconBubble icon="add" tint="white" size={44} />
            <View style={styles.tileContent}>
              <Text style={styles.tileTitle}>Créer une association</Text>
              <Text style={styles.tileText}>Monter une nouvelle tontine et en devenir le président fondateur.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </Pressable>

          {/* Rejoindre */}
          <Pressable style={styles.tile} onPress={() => navigation.navigate('JoinRequest')}>
            <IconBubble icon="search" tint="white" size={44} />
            <View style={styles.tileContent}>
              <Text style={styles.tileTitle}>Rejoindre une association</Text>
              <Text style={styles.tileText}>Rechercher une tontine existante et lui envoyer une demande d'adhésion.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </Pressable>

          {/* Invitation */}
          <Pressable style={styles.tile} onPress={showInviteHelp}>
            <IconBubble icon="mail-outline" tint="white" size={44} />
            <View style={styles.tileContent}>
              <Text style={styles.tileTitle}>J'ai un lien d'invitation</Text>
              <Text style={styles.tileText}>Rejoindre via le lien reçu par WhatsApp, SMS ou e-mail.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => navigation.navigate('MyJoinRequests')} hitSlop={8} style={styles.linkBtn}>
            <Text style={styles.linkText}>Voir mes demandes d'adhésion →</Text>
          </Pressable>

          <Pressable onPress={() => logout()} hitSlop={8} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.x3, gap: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', gap: spacing.md },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center', ...cardShadow },
  title: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.heading, textAlign: 'center' },
  subtitle: { fontSize: font.size.sm, color: colors.textMuted, textAlign: 'center', lineHeight: font.size.sm * 1.5 },

  list: { gap: spacing.md },
  tile: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.white, 
    borderRadius: radius.lg, 
    padding: spacing.lg, 
    gap: spacing.md, 
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow 
  },
  tileContent: { flex: 1 },
  tileTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  tileText: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 4, lineHeight: font.size.xs * 1.5 },

  footer: { alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  linkBtn: { paddingVertical: spacing.xs },
  linkText: { color: colors.primary, fontWeight: font.semibold, fontSize: font.size.sm },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.xs },
  logoutText: { color: colors.textMuted, fontWeight: font.medium, fontSize: font.size.sm },
});
