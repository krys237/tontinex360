import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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
    if (cooldown > 0) return;
    try {
      await authApi.resendOtp(telephone, { channel });
      setCooldown(30);
    } catch {
      setError("Impossible de renvoyer le code pour l'instant.");
    }
  };

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
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

          <Divider />

          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
            <Text style={styles.backLink}>Retour à la connexion</Text>
          </Pressable>
        </Card>

        <View style={styles.footer}>
          <Footer />
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
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
