import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import {
  GradientBackground,
  Card,
  BrandLogo,
  Heading,
  Subtitle,
  TextField,
  PhoneField,
  PrimaryButton,
  Footer,
} from '../../components/ui';
import { authApi } from '../../lib/api/auth';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hauteur du clavier (Android) : ajoute de la marge en bas du scroll pour que
  // les champs mot de passe (en bas du formulaire) restent atteignables.
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  const onSubmit = async () => {
    setError(null);
    if (!firstName || !lastName || !phone || !password) {
      setError('Veuillez remplir les champs obligatoires.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    const telephone = `+237${phone.replace(/\s/g, '')}`;
    setLoading(true);
    try {
      await authApi.register({
        telephone,
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
        password,
        password_confirm: confirm,
      });
      navigation.navigate('VerifyOtp', { telephone });
    } catch (e: any) {
      const data = e?.response?.data;
      setError(
        typeof data === 'object'
          ? Object.values(data).flat().join(' ')
          : "L'inscription a échoué. Réessayez.",
      );
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
          contentContainerStyle={[
            styles.scroll,
            Platform.OS === 'android' && { paddingBottom: spacing.lg + kbHeight },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          <Card>
            <BrandLogo width={130} />
            <Heading style={styles.heading}>Créer un compte</Heading>
            <Subtitle>Rejoignez votre tontine en quelques secondes</Subtitle>

            <View style={styles.form}>
              <View style={styles.row}>
                <TextField
                  label="Prénom"
                  placeholder="Jean"
                  value={firstName}
                  onChangeText={setFirstName}
                  containerStyle={styles.col}
                />
                <TextField
                  label="Nom"
                  placeholder="Kamga"
                  value={lastName}
                  onChangeText={setLastName}
                  containerStyle={styles.col}
                />
              </View>

              <PhoneField value={phone} onChangeText={setPhone} />

              <TextField
                label="Email (optionnel)"
                placeholder="jean@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <TextField
                label="Mot de passe"
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

              <PrimaryButton title="S'inscrire" loading={loading} onPress={onSubmit} style={styles.cta} />
            </View>

            <Text style={styles.switchLine}>
              Déjà un compte ?{' '}
              <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
                Se connecter
              </Text>
            </Text>
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
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  error: { color: colors.danger, marginBottom: 10, textAlign: 'center' },
  cta: { marginTop: spacing.sm },
  switchLine: { textAlign: 'center', color: colors.textMuted, fontSize: font.size.md, marginTop: spacing.lg },
  link: { color: colors.primary, fontWeight: font.bold },
  footer: { marginTop: spacing.xl },
});
