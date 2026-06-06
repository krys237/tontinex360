import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import {
  GradientBackground,
  Card,
  BrandLogo,
  Heading,
  Subtitle,
  PhoneField,
  TextField,
  PrimaryButton,
  Divider,
  Footer,
} from '../../components/ui';
import { authApi } from '../../lib/api/auth';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    const telephone = `+237${phone.replace(/\s/g, '')}`;
    setLoading(true);
    try {
      await authApi.forgotPassword({ telephone, password });
      setDone(true);
    } catch {
      setError('Réinitialisation impossible. Vérifiez le numéro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Card>
            <BrandLogo width={130} />
            <Heading style={styles.heading}>Mot de passe oublié</Heading>
            <Subtitle>Définissez un nouveau mot de passe pour votre compte</Subtitle>

            {done ? (
              <View style={styles.doneBox}>
                <Text style={styles.doneText}>
                  Mot de passe mis à jour. Vous pouvez vous reconnecter.
                </Text>
                <PrimaryButton
                  title="Retour à la connexion"
                  onPress={() => navigation.navigate('Login')}
                  style={styles.cta}
                />
              </View>
            ) : (
              <>
                <View style={styles.form}>
                  <PhoneField value={phone} onChangeText={setPhone} />
                  <TextField
                    label="Nouveau mot de passe"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TextField
                    label="Confirmer le mot de passe"
                    secureTextEntry
                    value={confirm}
                    onChangeText={setConfirm}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <PrimaryButton
                    title="Réinitialiser"
                    loading={loading}
                    onPress={onSubmit}
                    style={styles.cta}
                  />
                </View>

                <Divider />
                <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
                  <Text style={styles.backLink}>Retour à la connexion</Text>
                </Pressable>
              </>
            )}
          </Card>

          <View style={styles.footer}>
            <Footer />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, justifyContent: 'center', flexGrow: 1 },
  heading: { marginTop: spacing.md, fontSize: font.size.xl },
  form: { marginTop: spacing.xl },
  cta: { marginTop: spacing.sm },
  error: { color: colors.danger, marginBottom: 10, textAlign: 'center' },
  backLink: { textAlign: 'center', color: colors.heading, fontWeight: font.bold },
  doneBox: { marginTop: spacing.xl },
  doneText: { textAlign: 'center', color: colors.text, fontSize: font.size.md, lineHeight: font.size.md * 1.5 },
  footer: { marginTop: spacing.xl },
});
