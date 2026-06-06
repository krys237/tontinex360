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
import { ShieldCheck } from 'lucide-react-native';
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
  InfoCard,
  Footer,
} from '../../components/ui';
import { loginWithPassword } from '../../lib/auth/session';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    const telephone = `+237${phone.replace(/\s/g, '')}`;
    setLoading(true);
    try {
      await loginWithPassword(telephone, password);
    } catch (e: any) {
      const detail = JSON.stringify(e?.response?.data ?? '');
      if (/otp|inactif|not active|inactive/i.test(detail)) {
        navigation.navigate('VerifyOtp', { telephone });
      } else {
        setError('Connexion échouée. Vérifiez le numéro et le mot de passe.');
      }
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
            <BrandLogo width={140} />
            <Heading style={styles.heading}>Bienvenue !</Heading>
            <Subtitle>Entrez vos identifiants pour vous connecter</Subtitle>

            <View style={styles.form}>
              <PhoneField
                value={phone}
                onChangeText={setPhone}
                helper="Format international +237 6XX XXX XXX"
              />
              <TextField
                label="Mot de passe"
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoComplete="password"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton
                title="Se connecter"
                withArrow
                loading={loading}
                onPress={onSubmit}
                style={styles.cta}
              />
            </View>

            <Divider label="OU" />

            <Text style={styles.switchLine}>
              Pas encore de compte ?{' '}
              <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
                Créer un compte
              </Text>
            </Text>

            <View style={styles.info}>
              <InfoCard
                variant="green"
                title="Architecture non-custodial"
                icon={<ShieldCheck size={18} color={colors.primary} />}>
                TontineX360 ne détient aucun fonds. Toutes les cotisations restent dans le
                compte bancaire de votre tontine.
              </InfoCard>
            </View>
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
  scroll: { padding: spacing.lg, paddingBottom: spacing.x2, justifyContent: 'center', flexGrow: 1 },
  heading: { marginTop: spacing.md },
  form: { marginTop: spacing.x2 },
  cta: { marginTop: spacing.sm },
  error: { color: colors.danger, marginBottom: 10, textAlign: 'center' },
  switchLine: { textAlign: 'center', color: colors.textMuted, fontSize: font.size.md },
  link: { color: colors.primary, fontWeight: font.bold },
  info: { marginTop: spacing.xl },
  footer: { marginTop: spacing.xl },
});
