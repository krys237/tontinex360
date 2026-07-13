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
import { ArrowLeft, Building2, Info } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WorkspaceStackParamList } from '../../navigation/types';
import {
  GradientBackground,
  Card,
  TextField,
  PrimaryButton,
} from '../../components/ui';
import { authApi } from '../../lib/api/auth';
import { refreshWorkspace } from '../../lib/auth/session';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';

type Props = NativeStackScreenProps<WorkspaceStackParamList, 'CreateAssociation'>;

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CreateAssociationScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChangeName = (v: string) => {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  };

  const onSubmit = async () => {
    setError(null);
    if (!name.trim() || !slug.trim()) {
      setError('Le nom et l’identifiant sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      await authApi.createAssociation({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        city: city.trim() || undefined,
        region: region.trim() || undefined,
      });
      await authApi.selectAssociation(slug.trim());
      await refreshWorkspace(); // active association set -> RootNavigator switches to App
    } catch (e: any) {
      const data = e?.response?.data;
      setError(
        typeof data === 'object'
          ? Object.values(data).flat().join(' ')
          : "La création a échoué. Réessayez.",
      );
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Building2 size={22} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.title}>Nouvelle association</Text>
                <Text style={styles.subtitle}>
                  Vous serez automatiquement le fondateur et président.
                </Text>
              </View>
            </View>

            <View style={styles.form}>
              <TextField
                label="Nom de l'association"
                required
                placeholder="Tontine des Amis"
                value={name}
                onChangeText={onChangeName}
              />
              <TextField
                label="Identifiant unique (slug)"
                required
                placeholder="tontine-des-amis"
                autoCapitalize="none"
                value={slug}
                onChangeText={(v) => {
                  setSlug(slugify(v));
                  setSlugEdited(true);
                }}
                helper="Identifiant URL unique, sans espaces ni accents."
              />
              <TextField
                label="Description"
                placeholder="Brève description de l'objet de l'association"
                multiline
                value={description}
                onChangeText={setDescription}
              />
              <View style={styles.row}>
                <TextField
                  label="Ville"
                  placeholder="Douala"
                  value={city}
                  onChangeText={setCity}
                  containerStyle={styles.col}
                />
                <TextField
                  label="Région"
                  placeholder="Littoral"
                  value={region}
                  onChangeText={setRegion}
                  containerStyle={styles.col}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton
                title="Créer l'association"
                loading={loading}
                onPress={onSubmit}
                style={styles.cta}
              />
            </View>
          </Card>

          <View style={styles.notesBadge}>
            <View style={styles.badgeHeader}>
              <Info size={16} color={colors.primary} />
              <Text style={styles.badgeTitle}>À noter</Text>
            </View>
            <View style={styles.badgeBody}>
              <Text style={styles.badgeText}>• Vous serez automatiquement membre fondateur et président.</Text>
              <Text style={styles.badgeText}>• Une période d'essai gratuite est activée selon le plan par défaut.</Text>
              <Text style={styles.badgeText}>• Les rôles et postes de bureau standards sont créés automatiquement.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backText: { fontSize: font.size.md, color: colors.text, fontWeight: font.medium },
  scroll: { padding: spacing.lg, paddingTop: spacing.sm },
  titleRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.textStrong },
  subtitle: { marginTop: 2, fontSize: font.size.sm, color: colors.textMuted },
  form: { marginTop: spacing.xl },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  error: { color: colors.danger, marginBottom: 10 },
  cta: { marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: 28 },
  notesBadge: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  badgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  badgeTitle: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.primary,
  },
  badgeBody: {
    gap: 4,
  },
  badgeText: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
