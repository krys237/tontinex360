import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { membersApi } from '../../lib/api/members';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

/** Sélecteur de membre avec recherche, pour les formulaires bureau. */
export default function MemberPicker({
  label = 'Membre',
  value,
  onChange,
}: {
  label?: string;
  value: { id: string; name: string } | null;
  onChange: (m: { id: string; name: string } | null) => void;
}) {
  const [query, setQuery] = useState('');
  const membersQ = useQuery({ queryKey: ['bureau', 'members', 'list'], queryFn: () => membersApi.list() });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = membersQ.data ?? [];
    if (!q) return all.slice(0, 6);
    return all.filter((m) => m.user_name?.toLowerCase().includes(q)).slice(0, 6);
  }, [query, membersQ.data]);

  if (value) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.selected}>
          <Ionicons name="person-circle" size={22} color={colors.primary} />
          <Text style={styles.selectedName}>{value.name}</Text>
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
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
      {results.map((m) => (
        <Pressable key={m.id} style={styles.result} onPress={() => onChange({ id: m.id, name: m.user_name })}>
          <Ionicons name="person" size={16} color={colors.textMuted} />
          <Text style={styles.resultName}>{m.user_name}</Text>
          <Text style={styles.resultNum}>#{m.member_number}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.greenBg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  selectedName: { flex: 1, fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: font.size.base, color: colors.textStrong, paddingVertical: 10 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  resultName: { flex: 1, fontSize: font.size.sm, color: colors.text },
  resultNum: { fontSize: font.size.xs, color: colors.textLight },
});
