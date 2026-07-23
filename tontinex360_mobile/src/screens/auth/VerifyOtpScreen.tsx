import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
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
  OtpInput,
  ChannelChooser,
  TextField,
  PrimaryButton,
  OutlineButton,
  Divider,
  Footer,
  OtpChannel,
} from '../../components/ui';
import { authApi } from '../../lib/api/auth';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyOtp'>;

const CHANNEL_LABEL: Record<OtpChannel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
};

export default function VerifyOtpScreen({ navigation, route }: Props) {
  const telephone = route.params?.telephone ?? '';
  const [code, setCode] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('sms');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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

  const onValidate = async () => {
    if (code.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.validateOtp({ telephone, otp: code });
      navigation.navigate('Login');
    } catch {
      setError('Code invalide ou expiré. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(null);
    setInfo(null);

    const trimmedEmail = email.trim();
    if (channel === 'email' && trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Adresse email invalide.');
      return;
    }

    setResending(true);
    try {
      await authApi.resendOtp(telephone, {
        channel,
        // Sur le canal email, on transmet l'adresse saisie afin que les comptes
        // créés sans email puissent quand même recevoir le code.
        ...(channel === 'email' && trimmedEmail ? { email: trimmedEmail } : {}),
      });
      setCooldown(30);
      setInfo(`Code renvoyé par ${CHANNEL_LABEL[channel]}.`);
    } catch (e: any) {
      // Le backend renvoie un message métier précis (ex. pas d'email au compte,
      // rate limit). On le montre plutôt qu'un message générique.
      const backendMsg = e?.response?.data?.error;
      const status = e?.response?.status;
      if (backendMsg) {
        setError(backendMsg);
      } else if (status === 429) {
        setError('Trop de tentatives. Patientez une minute avant de réessayer.');
      } else {
        setError("Impossible de renvoyer le code pour l'instant.");
      }
    } finally {
      setResending(false);
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

          <View style={styles.titleRow}>
            <ShieldCheck size={24} color={colors.heading} />
            <Heading style={styles.heading}>Vérification du compte</Heading>
          </View>

          <Subtitle>
            Un code à 6 chiffres a été envoyé au numéro{' '}
            <Text style={styles.phone}>{telephone}</Text>.
          </Subtitle>

          <Text style={styles.label}>Code de vérification</Text>
          <OtpInput value={code} onChange={setCode} autoFocus />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            title="Valider"
            loading={loading}
            disabled={code.length < 6}
            onPress={onValidate}
            style={styles.cta}
          />

          <Text style={styles.resendHint}>
            Vous n'avez pas reçu le code ? Choisissez un canal :
          </Text>
          <ChannelChooser
            value={channel}
            onChange={(c) => {
              setChannel(c);
              setError(null);
              setInfo(null);
            }}
          />

          {channel === 'email' ? (
            <TextField
              label="Adresse email"
              placeholder="jean@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              helper="Laissez vide pour utiliser l'email de votre compte."
              containerStyle={styles.emailField}
            />
          ) : null}

          {info ? <Text style={styles.info}>{info}</Text> : null}

          <OutlineButton
            title={
              cooldown > 0
                ? `Renvoyer par ${CHANNEL_LABEL[channel]} (${cooldown}s)`
                : `Renvoyer par ${CHANNEL_LABEL[channel]}`
            }
            loading={resending}
            disabled={cooldown > 0 || resending}
            onPress={onResend}
            style={styles.resendBtn}
          />

          <Divider />

          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
            <Text style={styles.backLink}>Retour à la connexion</Text>
          </Pressable>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.md },
  heading: { fontSize: font.size.xl },
  phone: { fontWeight: font.bold, color: colors.text },
  label: {
    marginTop: spacing.x2,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: font.size.md,
    fontWeight: font.semibold,
    color: colors.text,
  },
  error: { color: colors.danger, textAlign: 'center', marginTop: 12 },
  info: { color: colors.primary, textAlign: 'center', marginTop: 12 },
  emailField: { marginTop: spacing.md },
  cta: { marginTop: spacing.xl },
  resendHint: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: font.size.sm,
    color: colors.textMuted,
  },
  resendBtn: { marginTop: spacing.md },
  backLink: { textAlign: 'center', color: colors.heading, fontWeight: font.bold },
  footer: { marginTop: spacing.xl },
});
