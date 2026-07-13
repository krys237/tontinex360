import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import ChipSelect from '../../components/bureau/ChipSelect';
import { DateField } from '../../components/bureau/DateTimeFields';
import type { BureauStackParamList } from '../../navigation/types';
import { governanceApi, type GovernanceDocument } from '../../lib/api/governance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauDocumentForm'>;
type Rt = RouteProp<BureauStackParamList, 'BureauDocumentForm'>;

const DOC_TYPES = [
  { key: 'charter' as const, label: 'Charte' },
  { key: 'bylaws' as const, label: 'Statuts' },
  { key: 'internal_rules' as const, label: 'Règlement intérieur' },
  { key: 'amendment' as const, label: 'Amendement' },
  { key: 'other' as const, label: 'Autre' },
];

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauDocumentFormScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const editId = useRoute<Rt>().params?.id;
  const isEdit = !!editId;

  const [docType, setDocType] = useState<GovernanceDocument['doc_type']>('bylaws');
  const [version, setVersion] = useState('1.0');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [active, setActive] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Modifier le document' : 'Nouveau document' });
  }, [navigation, isEdit]);

  const docQ = useQuery({
    queryKey: ['bureau', 'document', editId],
    queryFn: () => governanceApi.getDocument(editId!),
    enabled: isEdit,
  });

  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (docQ.data && !loaded) {
      const d = docQ.data;
      setDocType(d.doc_type ?? 'bylaws');
      setVersion(d.version ?? '1.0');
      setTitle(d.title ?? '');
      setContent(d.content ?? '');
      setEffectiveDate(d.effective_date ?? '');
      setActive(d.is_active ?? true);
      setLoaded(true);
    }
  }, [docQ.data, loaded]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Partial<GovernanceDocument> = {
        doc_type: docType,
        version: version.trim() || '1.0',
        title: title.trim(),
        content: content.trim(),
        effective_date: effectiveDate.trim() || null,
        is_active: active,
      };
      return isEdit ? governanceApi.updateDocument(editId!, payload) : governanceApi.createDocument(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'documents'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['bureau', 'document', editId] });
      Alert.alert(isEdit ? 'Document modifié' : 'Document publié', 'Le document a été enregistré.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  if (isEdit && docQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.label}>Type *</Text>
          <ChipSelect options={DOC_TYPES} value={docType} onChange={setDocType} />

          <TextField label="Version" value={version} onChangeText={setVersion} placeholder="1.0" />
          <TextField label="Titre *" value={title} onChangeText={setTitle} placeholder="Statuts de l'association v1.0" />
          <TextField label="Contenu / Résumé" value={content} onChangeText={setContent} placeholder="Texte ou résumé du document (Markdown supporté)" multiline />
          <DateField label="Date d'effet" value={effectiveDate} onChangeText={setEffectiveDate} />

          {/* Pièce jointe — désactivée (picker non disponible) */}
          <Text style={styles.label}>Fichier joint (optionnel)</Text>
          <View style={styles.dropZone}>
            <Ionicons name="cloud-upload-outline" size={26} color={colors.textLight} />
            <Text style={styles.dropText}>Téléversement bientôt disponible</Text>
            <Text style={styles.dropHint}>Nécessite une mise à jour de l'application.</Text>
          </View>

          <Pressable style={styles.check} onPress={() => setActive((v) => !v)}>
            <Ionicons name={active ? 'checkbox' : 'square-outline'} size={20} color={active ? colors.primary : colors.textMuted} />
            <Text style={styles.checkLabel}>Document actif (en vigueur)</Text>
          </Pressable>

          <PrimaryButton
            title={isEdit ? 'Enregistrer' : 'Publier'}
            onPress={() => saveMut.mutate()}
            loading={saveMut.isPending}
            disabled={!title.trim()}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  dropZone: { borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: spacing.x3, alignItems: 'center', gap: 4, marginBottom: 14 },
  dropText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.semibold },
  dropHint: { fontSize: font.size.xs, color: colors.textLight },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  checkLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
});
