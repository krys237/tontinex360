import React, { useState } from 'react';
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

const MIN_PASSWORD = 8;

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);

  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    // Le backend ré-authentifie l'utilisateur : il attend `telephone` en plus
    // de l'ancien mot de passe.
    mutationFn: () =>
      authApi.changePassword({
        telephone: user?.telephone ?? '',
        old_password: oldPassword,
        new_password: password,
      }),
    onSuccess: () => {
      Alert.alert('Mot de passe modifié', 'Votre nouveau mot de passe est actif.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e: any) => {
      // 401 = ancien mot de passe incorrect (seul cas métier renvoyé par la vue).
      setError(
        e?.response?.status === 401
          ? 'Mot de passe actuel incorrect.'
          : 'Modification impossible. Réessayez dans un instant.',
      );
    },
  });

  const onSubmit = () => {
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password === oldPassword) {
      setError("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }
    mut.mutate();
  };

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
              label="Mot de passe actuel"
              required
              placeholder="••••••••"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
              autoComplete="current-password"
            />
            <TextField
              label="Nouveau mot de passe"
              required
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              helper={`${MIN_PASSWORD} caractères minimum`}
            />
            <TextField
              label="Confirmer le nouveau mot de passe"
              required
              placeholder="••••••••"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              autoComplete="new-password"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton
              title="Modifier le mot de passe"
              loading={mut.isPending}
              disabled={!oldPassword || !password || !confirm}
              onPress={onSubmit}
              style={styles.cta}
            />
          </Card>

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              Vous avez oublié votre mot de passe actuel ? Déconnectez-vous, puis utilisez
              « Mot de passe oublié ? » sur l'écran de connexion pour le réinitialiser par code.
            </Text>
          </View>
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
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  cta: { marginTop: spacing.md },
  hintBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  hintText: { fontSize: font.size.xs, color: colors.textMuted, lineHeight: 18 },
});
