import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import StatusChip from '../../components/bureau/StatusChip';
import RequirePermission from '../../components/bureau/RequirePermission';
import { Card, SoftButton } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { governanceApi, type GovernanceDocument } from '../../lib/api/governance';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { formatDateFr } from '../../lib/utils/format';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauDocumentDetail'>;
type Rt = RouteProp<BureauStackParamList, 'BureauDocumentDetail'>;

const DOC_TYPE: Record<GovernanceDocument['doc_type'], string> = {
  charter: 'Charte',
  bylaws: 'Statuts',
  internal_rules: 'Règlement intérieur',
  amendment: 'Amendement',
  other: 'Autre',
};

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function BureauDocumentDetailScreen() {
  const id = useRoute<Rt>().params.id;
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ['bureau', 'document', id], queryFn: () => governanceApi.getDocument(id) });

  const removeMut = useMutation({
    mutationFn: () => governanceApi.removeDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'documents'] });
      navigation.goBack();
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const confirmRemove = () =>
    Alert.alert('Supprimer le document', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => removeMut.mutate() },
    ]);

  const openFile = async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('Impossible', "Le fichier n'a pas pu être ouvert.");
    } catch {
      Alert.alert('Impossible', "Le fichier n'a pas pu être ouvert.");
    }
  };

  const d = q.data;
  if (q.isLoading || !d) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.primary} />}
      >
        <Card style={styles.card}>
          <View style={styles.head}>
            <StatusChip label={DOC_TYPE[d.doc_type] ?? d.doc_type} tone="info" />
            <Text style={styles.version}>v{d.version || '1'}</Text>
            <StatusChip label={d.is_active ? 'En vigueur' : 'Archivé'} tone={d.is_active ? 'success' : 'muted'} />
          </View>
          <Text style={styles.title}>{d.title}</Text>
          {d.effective_date ? <Text style={styles.meta}>En vigueur depuis le {formatDateFr(d.effective_date, false)}</Text> : null}
          {d.content ? <Text style={styles.content}>{d.content}</Text> : <Text style={styles.empty}>Aucun contenu textuel.</Text>}
        </Card>

        {d.file ? (
          <Pressable style={styles.fileBtn} onPress={() => openFile(d.file as string)}>
            <Ionicons name="download-outline" size={18} color={colors.white} />
            <Text style={styles.fileBtnText}>Ouvrir le fichier joint</Text>
          </Pressable>
        ) : null}

        <RequirePermission bureau>
          <SoftButton title="Modifier le document" onPress={() => navigation.navigate('BureauDocumentForm', { id })} />
          <SoftButton title="Supprimer le document" onPress={confirmRemove} disabled={removeMut.isPending} style={styles.delBtn} />
        </RequirePermission>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  version: { fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.semibold },
  title: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  meta: { fontSize: font.size.xs, color: colors.textLight, marginTop: 4 },
  content: { fontSize: font.size.md, color: colors.text, lineHeight: 22, marginTop: spacing.md },
  empty: { fontSize: font.size.sm, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.md },
  fileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 12 },
  fileBtnText: { fontSize: font.size.md, fontWeight: font.bold, color: colors.white },
  delBtn: { borderColor: colors.danger },
});
