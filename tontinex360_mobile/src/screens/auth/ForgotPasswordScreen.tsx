import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { KeyRound } from 'lucide-react-native';
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
  OtpInput,
  ChannelChooser,
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

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/**
 * Réinitialisation du mot de passe, en 3 étapes :
 *   1. `phone`    — numéro + canal → envoi d'un OTP (`resend-otp`)
 *   2. `otp`      — saisie du code → vérification (`valid-otp`)
 *   3. `password` — nouveau mot de passe (`change-fogot-password`)
 *
 * ⚠️ La vérification OTP n'est PAS opposable côté serveur : l'étape 3 appelle
 * un endpoint public qui ne contrôle pas l'OTP (voir `authApi.forgotPassword`).
 * Le parcours ci-dessous protège l'utilisateur honnête, pas l'attaquant.
 */
type Step = 'phone' | 'otp' | 'password' | 'done';

const CHANNEL_LABEL: Record<OtpChannel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
};

const MIN_PASSWORD = 8;
const RESEND_COOLDOWN = 30;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('phone');

  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('whatsapp');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const telephone = `+237${phone.replace(/\s/g, '')}`;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Étape 1 — demander l'OTP
  const onRequestOtp = async () => {
    setError(null);
    if (phone.replace(/\s/g, '').length < 9) {
      setError('Entrez un numéro de téléphone valide.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resendOtp(telephone, { channel });
      setCooldown(RESEND_COOLDOWN);
      setStep('otp');
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setError("Aucun compte n'est associé à ce numéro.");
      } else if (status === 429) {
        setError('Trop de tentatives. Patientez une minute avant de réessayer.');
      } else {
        setError("Envoi du code impossible. Réessayez dans un instant.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Étape 2 — vérifier l'OTP
  const onVerifyOtp = async () => {
    if (code.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.validateOtp({ telephone, otp: code });
      setStep('password');
    } catch {
      setError('Code invalide ou expiré. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    try {
      await authApi.resendOtp(telephone, { channel });
      setCooldown(RESEND_COOLDOWN);
    } catch {
      setError("Impossible de renvoyer le code pour l'instant.");
    }
  };

  // Étape 3 — définir le nouveau mot de passe
  const onSubmitPassword = async () => {
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword({ telephone, password });
      setStep('done');
    } catch {
      setError('Réinitialisation impossible. Réessayez dans un instant.');
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = step === 'phone' ? 1 : step === 'otp' ? 2 : 3;

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

            <View style={styles.titleRow}>
              <KeyRound size={22} color={colors.heading} />
              <Heading style={styles.heading}>Mot de passe oublié</Heading>
            </View>

            {step !== 'done' ? <Text style={styles.stepHint}>Étape {stepIndex} sur 3</Text> : null}

            {/* ── Étape 1 : numéro + canal ─────────────────────────────── */}
            {step === 'phone' ? (
              <>
                <Subtitle>
                  Entrez votre numéro : nous vous enverrons un code de vérification.
                </Subtitle>
                <View style={styles.form}>
                  <PhoneField
                    value={phone}
                    onChangeText={setPhone}
                    helper="Format international +237 6XX XXX XXX"
                  />

                  <Text style={styles.label}>Recevoir le code par</Text>
                  <ChannelChooser value={channel} onChange={setChannel} />
                  {channel === 'email' ? (
                    <Text style={styles.channelHint}>
                      L'email doit être renseigné sur votre compte.
                    </Text>
                  ) : null}

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <PrimaryButton
                    title="Envoyer le code"
                    withArrow
                    loading={loading}
                    onPress={onRequestOtp}
                    style={styles.cta}
                  />
                </View>
              </>
            ) : null}

            {/* ── Étape 2 : saisie du code ─────────────────────────────── */}
            {step === 'otp' ? (
              <>
                <Subtitle>
                  Code à 6 chiffres envoyé par {CHANNEL_LABEL[channel]} au{' '}
                  <Text style={styles.phone}>{telephone}</Text>.
                </Subtitle>

                <Text style={styles.label}>Code de vérification</Text>
                <OtpInput value={code} onChange={setCode} autoFocus />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <PrimaryButton
                  title="Vérifier le code"
                  loading={loading}
                  disabled={code.length < 6}
                  onPress={onVerifyOtp}
                  style={styles.cta}
                />

                <Text style={styles.resendHint}>
                  Vous n'avez pas reçu le code ? Changez de canal si besoin :
                </Text>
                <ChannelChooser value={channel} onChange={setChannel} />
                <OutlineButton
                  title={
                    cooldown > 0
                      ? `Renvoyer par ${CHANNEL_LABEL[channel]} (${cooldown}s)`
                      : `Renvoyer par ${CHANNEL_LABEL[channel]}`
                  }
                  disabled={cooldown > 0}
                  onPress={onResend}
                  style={styles.resendBtn}
                />

                <Pressable
                  onPress={() => {
                    setCode('');
                    setError(null);
                    setStep('phone');
                  }}
                  hitSlop={8}>
                  <Text style={styles.inlineLink}>Modifier le numéro</Text>
                </Pressable>
              </>
            ) : null}

            {/* ── Étape 3 : nouveau mot de passe ───────────────────────── */}
            {step === 'password' ? (
              <>
                <Subtitle>Choisissez un nouveau mot de passe pour votre compte.</Subtitle>
                <View style={styles.form}>
                  <TextField
                    label="Nouveau mot de passe"
                    placeholder="••••••••"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    helper={`${MIN_PASSWORD} caractères minimum`}
                  />
                  <TextField
                    label="Confirmer le mot de passe"
                    placeholder="••••••••"
                    secureTextEntry
                    value={confirm}
                    onChangeText={setConfirm}
                  />

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <PrimaryButton
                    title="Réinitialiser"
                    loading={loading}
                    disabled={!password || !confirm}
                    onPress={onSubmitPassword}
                    style={styles.cta}
                  />
                </View>
              </>
            ) : null}

            {/* ── Fin ──────────────────────────────────────────────────── */}
            {step === 'done' ? (
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
            ) : null}

            {step !== 'done' ? (
              <>
                <Divider />
                <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
                  <Text style={styles.backLink}>Retour à la connexion</Text>
                </Pressable>
              </>
            ) : null}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
  },
  heading: { fontSize: font.size.xl },
  stepHint: {
    textAlign: 'center',
    fontSize: font.size.xs,
    fontWeight: font.semibold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  form: { marginTop: spacing.xl },
  label: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: font.size.md,
    fontWeight: font.semibold,
    color: colors.text,
  },
  channelHint: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  phone: { fontWeight: font.bold, color: colors.text },
  cta: { marginTop: spacing.sm },
  error: { color: colors.danger, marginBottom: 10, marginTop: 10, textAlign: 'center' },
  resendHint: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: font.size.sm,
    color: colors.textMuted,
  },
  resendBtn: { marginTop: spacing.md, marginBottom: spacing.md },
  inlineLink: {
    textAlign: 'center',
    color: colors.primary,
    fontWeight: font.bold,
    fontSize: font.size.sm,
    marginBottom: spacing.sm,
  },
  backLink: { textAlign: 'center', color: colors.heading, fontWeight: font.bold },
  doneBox: { marginTop: spacing.xl },
  doneText: {
    textAlign: 'center',
    color: colors.text,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
  },
  footer: { marginTop: spacing.xl },
});
