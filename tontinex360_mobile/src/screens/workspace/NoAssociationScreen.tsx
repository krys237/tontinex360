import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Building2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WorkspaceStackParamList } from '../../navigation/types';
import { GradientBackground, Card, PrimaryButton, SoftButton } from '../../components/ui';
import { logout } from '../../lib/auth/session';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<WorkspaceStackParamList, 'NoAssociation'>;

export default function NoAssociationScreen({ navigation }: Props) {
  return (
    <GradientBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <View style={styles.iconCircle}>
            <Building2 size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>Aucune association</Text>
          <Text style={styles.text}>
            Vous n'êtes membre d'aucune association. Vous pouvez en créer une (vous en serez
            fondateur et président) ou rejoindre une association existante.
          </Text>

          <PrimaryButton
            title="＋ Créer une association"
            onPress={() => navigation.navigate('CreateAssociation')}
            style={styles.cta}
          />
          <SoftButton
            title="Rejoindre une association"
            onPress={() => navigation.navigate('JoinRequest')}
            style={styles.cta2}
          />

          <Text style={styles.note}>
            Vous avez reçu une invitation par e-mail / SMS ? Cliquez sur le lien d'invitation
            pour rejoindre l'association.
          </Text>
        </Card>

        <Pressable onPress={() => logout()} hitSlop={8} style={styles.logout}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  iconCircle: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: font.size.xl,
    fontWeight: font.bold,
    color: colors.heading,
    textAlign: 'center',
  },
  text: {
    marginTop: spacing.md,
    fontSize: font.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: font.size.md * 1.5,
  },
  cta: { marginTop: spacing.xl },
  cta2: { marginTop: spacing.md },
  note: {
    marginTop: spacing.xl,
    fontSize: font.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: font.size.sm * 1.5,
  },
  logout: { marginTop: spacing.xl, alignItems: 'center' },
  logoutText: { color: colors.textMuted, fontWeight: font.semibold },
});
