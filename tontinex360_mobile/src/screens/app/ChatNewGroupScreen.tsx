import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import { chatApi } from '../../lib/api/chat';
import { membersApi } from '../../lib/api/members';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function ChatNewGroupScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({}); // id -> name

  const membersQ = useQuery({ queryKey: ['bureau', 'members', 'list'], queryFn: () => membersApi.list() });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = membersQ.data ?? [];
    if (!q) return all;
    return all.filter((m) => m.user_name?.toLowerCase().includes(q));
  }, [query, membersQ.data]);

  const selectedIds = Object.keys(selected);
  const toggle = (id: string, nm: string) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = nm;
      return next;
    });

  const createMut = useMutation({
    mutationFn: () => chatApi.createGroup({ name: name.trim(), member_ids: selectedIds }),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      navigation.replace('Conversation', { id: conv.id, title: conv.name || name.trim() });
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <TextField label="Nom du groupe *" value={name} onChangeText={setName} placeholder="Ex : Comité d'organisation" />

          <Text style={styles.label}>Membres ({selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''})</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un membre…"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          {membersQ.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
          ) : (
            results.map((m) => {
              const on = !!selected[m.id];
              return (
                <Pressable key={m.id} style={styles.result} onPress={() => toggle(m.id, m.user_name)}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.primary : colors.textMuted} />
                  <Text style={styles.resultName} numberOfLines={1}>{m.user_name}</Text>
                  <Text style={styles.resultNum}>#{m.member_number}</Text>
                </Pressable>
              );
            })
          )}
        </Card>

        <PrimaryButton
          title="Créer le groupe"
          onPress={() => createMut.mutate()}
          loading={createMut.isPending}
          disabled={!name.trim() || selectedIds.length === 0}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 48, marginBottom: spacing.sm,
  },
  input: { flex: 1, fontSize: font.size.base, color: colors.textStrong, paddingVertical: 10 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt },
  resultName: { flex: 1, fontSize: font.size.sm, color: colors.text },
  resultNum: { fontSize: font.size.xs, color: colors.textLight },
});
