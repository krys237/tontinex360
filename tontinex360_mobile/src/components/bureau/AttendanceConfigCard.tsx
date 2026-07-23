import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, TextField } from '../ui';
import { sessionsApi, type AttendanceConfig } from '../../lib/api/sessions';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

/**
 * Politique de pointage de l'association (repliée par défaut).
 * GET ouvert à tout membre, PATCH réservé au bureau (contrôle serveur) —
 * à n'afficher que derrière RequirePermission bureau.
 */
export default function AttendanceConfigCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AttendanceConfig | null>(null);
  const [late, setLate] = useState('');

  const q = useQuery({ queryKey: ['attendance-config'], queryFn: () => sessionsApi.attendanceConfig() });
  const cfg = q.data;

  const toggleOpen = () => {
    if (!open && cfg) {
      setDraft({ ...cfg });
      setLate(String(cfg.late_after_minutes));
    }
    setOpen((v) => !v);
  };

  const save = useMutation({
    mutationFn: () =>
      sessionsApi.updateAttendanceConfig({
        ...draft!,
        late_after_minutes: Math.max(0, Number(late) || 0),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(['attendance-config'], updated);
      setOpen(false);
      Alert.alert('Politique enregistrée', 'La configuration du pointage a été mise à jour.');
    },
    onError: (e: any) =>
      Alert.alert('Erreur', e?.response?.data?.error ?? e?.response?.data?.detail ?? 'Enregistrement impossible.'),
  });

  const summary = cfg
    ? cfg.mode === 'auto'
      ? `Auto · retard après ${cfg.late_after_minutes} min`
      : 'Manuel (le bureau pointe)'
    : '…';

  return (
    <Card style={styles.card}>
      <Pressable style={styles.head} onPress={toggleOpen} disabled={!cfg}>
        <Ionicons name="options-outline" size={18} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={styles.title}>Politique de pointage</Text>
          <Text style={styles.summary}>{summary}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>

      {open && draft ? (
        <View style={styles.body}>
          <Text style={styles.fieldLabel}>Mode</Text>
          <View style={styles.modeRow}>
            {(
              [
                { key: 'manual', label: 'Manuel' },
                { key: 'auto', label: 'Auto (marge de retard)' },
              ] as const
            ).map((m) => {
              const on = draft.mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setDraft({ ...draft, mode: m.key })}
                  style={[styles.modeChip, on && styles.modeChipOn]}>
                  <Text style={[styles.modeChipText, on && styles.modeChipTextOn]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {draft.mode === 'auto' ? (
            <TextField
              label="Marge de retard (minutes)"
              value={late}
              onChangeText={(t) => setLate(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="15"
              helper="Arrivée au-delà de l'heure de début + marge → statut « En retard »."
            />
          ) : null}

          <ToggleRow
            label="Pointage individuel (« Je suis présent »)"
            value={draft.allow_self_checkin}
            onToggle={() => setDraft({ ...draft, allow_self_checkin: !draft.allow_self_checkin })}
          />
          <ToggleRow
            label="Non-pointés marqués absents à la clôture"
            value={draft.absent_on_close}
            onToggle={() => setDraft({ ...draft, absent_on_close: !draft.absent_on_close })}
          />

          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
            onPress={() => save.mutate()}
            disabled={save.isPending}>
            {save.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveText}>Enregistrer</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={onToggle}>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={22}
        color={value ? colors.primary : colors.textMuted}
      />
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: radius.lg, gap: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  summary: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 1 },
  body: { marginTop: spacing.md, gap: spacing.sm },

  fieldLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
  },
  modeChipOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  modeChipText: { fontSize: font.size.xs, fontWeight: font.semibold, color: colors.textMuted, textAlign: 'center' },
  modeChipTextOn: { color: colors.primary },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  toggleLabel: { flex: 1, fontSize: font.size.sm, color: colors.text },

  saveBtn: {
    minHeight: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  saveText: { color: colors.white, fontSize: font.size.md, fontWeight: font.bold },
});
