import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Files } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import {
  PhoneField,
  TextField,
  OtpInput,
  PrimaryButton,
  PillButton,
  Checkbox,
  AvatarPicker,
  Divider,
} from '../../components/ui';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<AuthStackParamList, 'InviteAccept'>;

type Step = 0 | 1 | 2 | 3;

export default function InviteAcceptScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>(0);

  // collected data
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const soon = () => Alert.alert('Bientôt disponible', 'Cette option arrivera prochainement.');

  const next = () => setStep((s) => Math.min(3, s + 1) as Step);
  const back = () => {
    if (step === 0) navigation.goBack();
    else setStep((s) => Math.max(0, s - 1) as Step);
  };

  const finish = () => {
    // TODO(Phase 1 wiring): with the invitation token (deep link) call
    // invitationsApi.registerAndAccept({ token, telephone, first_name, last_name, email, password })
    // then enter the app. Exact payload to confirm against /swagger/.
    Alert.alert(
      'Invitation',
      'Profil prêt. La validation de l’invitation sera connectée au lien reçu (token).',
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {step === 0 && (
            <View style={styles.center}>
              <Text style={styles.title}>
                Bienvenue sur <Text style={styles.brand}>Tontinex360</Text>
              </Text>
              <Text style={styles.subtitle}>
                Entrez votre numéro de téléphone pour continuer
              </Text>

              <View style={styles.block}>
                <PhoneField
                  label=""
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Numéro de téléphone"
                  helper="Un code de confirmation vous sera envoyé par SMS"
                />
              </View>

              <Divider label="Ou" />

              <Pressable style={styles.social} onPress={soon}>
                <View style={styles.googleG}>
                  <Text style={styles.googleGText}>G</Text>
                </View>
                <Text style={styles.socialText}>continuer avec Google</Text>
              </Pressable>
              <Pressable style={styles.social} onPress={soon}>
                <Text style={styles.apple}></Text>
                <Text style={styles.socialText}>Continuer avec Apple</Text>
              </Pressable>

              <Text style={styles.terms}>
                En continuant, vous acceptez nos Conditions d'utilisation et notre Politique
                de confidentialité.
              </Text>
            </View>
          )}

          {step === 1 && (
            <View style={styles.center}>
              <Text style={styles.title}>Vérifiez votre numéro</Text>
              <Text style={styles.subtitle}>Entrez le code reçu par SMS</Text>
              <View style={styles.block}>
                <OtpInput value={code} onChange={setCode} shape="rounded" autoFocus />
              </View>
              <Pressable
                onPress={() => cooldown === 0 && setCooldown(30)}
                disabled={cooldown > 0}
                hitSlop={8}>
                <Text style={styles.resend}>
                  {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
                </Text>
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View style={styles.center}>
              <Text style={styles.title}>Complétez votre profil</Text>
              <Text style={styles.subtitle}>
                Ces informations permettent de vous identifier dans la tontine
              </Text>
              <View style={styles.avatar}>
                <AvatarPicker onPress={() => {}} />
              </View>
              <View style={styles.block}>
                <TextField label="Nom" variant="filled" value={lastName} onChangeText={setLastName} />
                <TextField label="Prénom" variant="filled" value={firstName} onChangeText={setFirstName} />
                <TextField
                  label="Adresse email"
                  variant="filled"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.center}>
              <View style={styles.docIcon}>
                <Files size={56} color={colors.accent} />
              </View>
              <Text style={styles.title}>
                Acceptez les termes et conditions générales d'utilisation de TontineX360
              </Text>
              <View style={styles.checkboxWrap}>
                <Checkbox checked={accepted} onChange={setAccepted}>
                  J'accepte les{' '}
                  <Text style={styles.link}>conditions générales d'utilisation</Text>
                </Checkbox>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom action bar */}
        <View style={styles.bottomBar}>
          {step === 0 ? (
            <PrimaryButton title="Continuer" onPress={next} style={styles.fullCta} />
          ) : step === 1 ? (
            <View style={styles.barBetween}>
              <PillButton title="Retour" direction="back" variant="soft" onPress={back} />
              <PrimaryButton title="Continuer" onPress={next} style={styles.midCta} />
            </View>
          ) : (
            <View style={styles.barBetween}>
              <PillButton title="Retour" direction="back" variant="soft" onPress={back} />
              <PillButton
                title="Suivant"
                direction="next"
                onPress={step === 3 ? finish : next}
                disabled={step === 3 && !accepted}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.x2 },
  center: { width: '100%' },
  title: {
    fontSize: font.size.x2,
    fontWeight: font.extrabold,
    color: colors.heading,
    textAlign: 'center',
  },
  brand: { color: colors.heading },
  subtitle: {
    marginTop: spacing.md,
    fontSize: font.size.md,
    color: colors.text,
    textAlign: 'center',
    lineHeight: font.size.md * 1.4,
  },
  block: { marginTop: spacing.x3 },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.inputBgAlt,
    borderRadius: 999,
    minHeight: 54,
    marginBottom: 12,
  },
  socialText: { fontSize: font.size.base, fontWeight: font.semibold, color: colors.text },
  googleG: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGText: { color: '#4285F4', fontWeight: '800', fontSize: 14 },
  apple: { fontSize: 18 },
  terms: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: font.size.sm,
    color: colors.textMuted,
    lineHeight: font.size.sm * 1.5,
  },
  resend: { marginTop: spacing.xl, textAlign: 'center', color: colors.textMuted, fontWeight: font.semibold },
  avatar: { marginTop: spacing.x3, marginBottom: spacing.lg },
  docIcon: { alignItems: 'center', marginBottom: spacing.x2 },
  checkboxWrap: { marginTop: spacing.lg },
  link: { color: colors.text, fontWeight: font.semibold },
  bottomBar: { padding: spacing.lg },
  barBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  fullCta: { width: '100%' },
  midCta: { flex: 1 },
});
