import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import { authApi } from '../../lib/api/auth';
import { useAuthStore } from '../../lib/stores/auth-store';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        // '' remis à null côté serveur (UserSerializer.validate) — on envoie
        // la chaîne vide pour permettre de retirer un email.
        email: email.trim() || null,
      }),
    onSuccess: (updated) => {
      setUser(updated);
      Alert.alert('Profil mis à jour', 'Vos informations ont été enregistrées.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: () => setError("Enregistrement impossible. Réessayez dans un instant."),
  });

  const onSubmit = () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('Le prénom et le nom sont obligatoires.');
      return;
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setError('Adresse email invalide.');
      return;
    }
    mut.mutate();
  };

  // Rien à enregistrer tant que rien n'a bougé.
  const dirty = useMemo(
    () =>
      firstName.trim() !== (user?.first_name ?? '') ||
      lastName.trim() !== (user?.last_name ?? '') ||
      email.trim() !== (user?.email ?? ''),
    [firstName, lastName, email, user],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Card style={styles.card}>
            <TextField
              label="Prénom"
              required
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Steve"
              autoCapitalize="words"
            />
            <TextField
              label="Nom"
              required
              value={lastName}
              onChangeText={setLastName}
              placeholder="Kameni"
              autoCapitalize="words"
            />
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="vous@exemple.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              helper="Sert à recevoir un code de vérification par email."
            />

            <View style={styles.phoneBox}>
              <Text style={styles.phoneLabel}>Téléphone</Text>
              <Text style={styles.phoneValue}>{user?.telephone}</Text>
              <Text style={styles.phoneHint}>
                Le numéro identifie votre compte : il ne peut pas être modifié ici.
              </Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton
              title="Enregistrer"
              loading={mut.isPending}
              disabled={!dirty}
              onPress={onSubmit}
              style={styles.cta}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  phoneBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  phoneLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  phoneValue: {
    fontSize: font.size.base,
    fontWeight: font.bold,
    color: colors.text,
    marginTop: 2,
  },
  phoneHint: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 6, lineHeight: 16 },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  cta: { marginTop: spacing.md },
});
