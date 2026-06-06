import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WorkspaceStackParamList } from '../../navigation/types';
import {
  GradientBackground,
  Card,
  TextField,
  PrimaryButton,
  InfoCard,
} from '../../components/ui';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<WorkspaceStackParamList, 'JoinRequest'>;

export default function JoinRequestScreen({ navigation }: Props) {
  const [slug, setSlug] = useState('');
  const [motivation, setMotivation] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!slug.trim()) {
      setError("Indiquez l'identifiant de l'association.");
      return;
    }
    setLoading(true);
    try {
      // TODO(Phase 2): POST /members/membership-requests/ in the target association's
      // tenant context (X-Tenant = slug) with { motivation, contact_phone, contact_email }.
      // Exact targeting flow to confirm against /swagger/.
      await new Promise<void>((r) => setTimeout(() => r(), 600));
      setSent(true);
    } catch {
      setError("L'envoi de la demande a échoué.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GradientBackground>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={20} color={colors.text} />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card>
            {sent ? (
              <View style={styles.doneBox}>
                <CheckCircle2 size={48} color={colors.success} />
                <Text style={styles.doneTitle}>Demande envoyée</Text>
                <Text style={styles.doneText}>
                  Votre demande d'adhésion a été transmise au bureau de l'association. Vous
                  serez notifié dès qu'elle sera examinée.
                </Text>
                <PrimaryButton
                  title="Retour"
                  onPress={() => navigation.goBack()}
                  style={styles.cta}
                />
              </View>
            ) : (
              <>
                <Text style={styles.title}>Rejoindre une association</Text>
                <Text style={styles.subtitle}>
                  Envoyez une demande d'adhésion au bureau d'une association existante.
                </Text>

                <View style={styles.form}>
                  <TextField
                    label="Identifiant de l'association (slug)"
                    placeholder="tontine-des-amis"
                    autoCapitalize="none"
                    value={slug}
                    onChangeText={setSlug}
                  />
                  <TextField
                    label="Motivation (optionnel)"
                    placeholder="Présentez-vous en quelques mots…"
                    multiline
                    value={motivation}
                    onChangeText={setMotivation}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <PrimaryButton
                    title="Envoyer la demande"
                    loading={loading}
                    onPress={onSubmit}
                    style={styles.cta}
                  />
                </View>

                <View style={styles.info}>
                  <InfoCard variant="green">
                    Vous pouvez aussi rejoindre via un lien d'invitation reçu par WhatsApp,
                    SMS ou e-mail.
                  </InfoCard>
                </View>
              </>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backText: { fontSize: font.size.md, color: colors.text, fontWeight: font.medium },
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.heading, textAlign: 'center' },
  subtitle: {
    marginTop: spacing.md,
    fontSize: font.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: font.size.md * 1.5,
  },
  form: { marginTop: spacing.xl },
  error: { color: colors.danger, marginBottom: 10 },
  cta: { marginTop: spacing.sm },
  info: { marginTop: spacing.lg },
  doneBox: { alignItems: 'center', paddingVertical: spacing.lg },
  doneTitle: { marginTop: spacing.md, fontSize: font.size.lg, fontWeight: font.bold, color: colors.heading },
  doneText: {
    marginTop: spacing.sm,
    fontSize: font.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: font.size.md * 1.5,
  },
});
