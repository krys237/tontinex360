import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';

import { proxiesApi } from '../../lib/api/proxies';
import { cyclesApi } from '../../lib/api/cycles';
import { membersApi } from '../../lib/api/members';
import { tontinesApi } from '../../lib/api/tontines';
import type { Session } from '../../lib/types/cycle';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** "2026-06-19" -> "19 juin 2026". */
function frDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return dateStr ?? '';
  return `${Number(m[3])} ${MONTHS_FR[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

// Libellés FR des champs renvoyés par le back, pour des erreurs lisibles.
const FIELD_LABELS: Record<string, string> = {
  proxy: 'Procurataire',
  session: 'Séance',
  tontine: 'Tontine',
  reason: 'Motif',
  proxy_cni_number: 'N° CNI',
  non_field_errors: 'Erreur',
  detail: 'Erreur',
};

/** Met en forme une erreur DRF en conservant le nom du champ concerné. */
function formatApiError(data: unknown): string {
  if (!data) return 'Échec de la création de la procuration.';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.join(' ');
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === 'string') return obj.detail;
    const parts: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      const label = FIELD_LABELS[key] ?? key;
      const msg = Array.isArray(val)
        ? val.join(' ')
        : typeof val === 'object' && val
          ? JSON.stringify(val)
          : String(val);
      parts.push(`${label} : ${msg}`);
    }
    if (parts.length) return parts.join('\n');
  }
  return 'Échec de la création de la procuration.';
}

export default function ProxyRequestModal({
  visible,
  onClose,
  onCreated,
  currentMembershipId,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
  currentMembershipId?: string;
}) {
  const cycleQ = useQuery({ queryKey: ['cycle', 'current'], queryFn: cyclesApi.current, enabled: visible });
  const cycle = cycleQ.data ?? null;
  const sessionsQ = useQuery({
    queryKey: ['cycle', 'sessions', cycle?.id ?? null],
    queryFn: () => cyclesApi.sessions({ status: 'scheduled', ...(cycle ? { cycle: cycle.id } : {}) }),
    enabled: visible && !!cycle,
  });
  const membersQ = useQuery({
    queryKey: ['members', 'all'],
    queryFn: () => membersApi.list(),
    enabled: visible,
  });
  const typesQ = useQuery({
    queryKey: ['tontines', 'types', 'active'],
    queryFn: () => tontinesApi.types({ is_active: true }),
    enabled: visible,
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const sessions: Session[] = useMemo(
    () => [...(sessionsQ.data ?? [])].filter((s) => !!s.date).sort((a, b) => a.date.localeCompare(b.date)),
    [sessionsQ.data],
  );
  const defaultSession = useMemo(
    () => sessions.find((s) => s.date >= todayISO) ?? sessions[0] ?? null,
    [sessions, todayISO],
  );

  // On ne peut pas se mandater soi-même.
  const members = useMemo(
    () => (membersQ.data ?? []).filter((m) => m.id !== currentMembershipId),
    [membersQ.data, currentMembershipId],
  );
  const types = typesQ.data ?? [];

  const [proxyId, setProxyId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tontineId, setTontineId] = useState<string | null>(null); // null = toutes
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSessionId((prev) => prev ?? defaultSession?.id ?? null);
  }, [visible, defaultSession]);

  const reset = () => {
    setProxyId(null);
    setSessionId(null);
    setTontineId(null);
    setReason('');
    setError(null);
    setDone(false);
    setLoading(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const selectedMember = members.find((m) => m.id === proxyId) ?? null;

  const submit = async () => {
    setError(null);
    if (!proxyId) return setError('Sélectionnez le membre qui vous représentera.');
    if (!sessionId) return setError('Sélectionnez une séance.');

    setLoading(true);
    try {
      await proxiesApi.create({
        proxy: proxyId,
        session: sessionId,
        reason: reason.trim(),
        ...(tontineId ? { tontine: tontineId } : {}),
      });
      setDone(true);
      onCreated?.();
    } catch (e: any) {
      setError(formatApiError(e?.response?.data));
    } finally {
      setLoading(false);
    }
  };

  const sessionsLoading = cycleQ.isLoading || (!!cycle && sessionsQ.isLoading);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Nouvelle procuration</Text>
            <Pressable onPress={close} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {done ? (
            <View style={styles.success}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={34} color={colors.white} />
              </View>
              <Text style={styles.successTitle}>Procuration créée</Text>
              <Text style={styles.successText}>
                {selectedMember ? selectedMember.user_name : 'Le membre choisi'} pourra vous représenter
                à la séance sélectionnée. Elle sera effective après validation du bureau.
              </Text>
              <Pressable style={[styles.btn, styles.btnPrimary, styles.successBtn]} onPress={close}>
                <Text style={styles.btnPrimaryText}>Fermer</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Procurataire */}
                <Text style={styles.label}>
                  Procurataire (membre actif) <Text style={styles.req}>*</Text>
                </Text>
                {membersQ.isLoading ? (
                  <ActivityIndicator color={colors.primary} style={styles.loader} />
                ) : members.length === 0 ? (
                  <Text style={styles.empty}>Aucun autre membre disponible.</Text>
                ) : (
                  members.map((m) => {
                    const active = m.id === proxyId;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setProxyId(m.id)}
                        style={[styles.option, active && styles.optionActive]}>
                        <Ionicons
                          name={active ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={active ? colors.primary : colors.textLight}
                        />
                        <View style={styles.flex}>
                          <Text style={styles.optionName}>{m.user_name}</Text>
                          <Text style={styles.optionDesc} numberOfLines={1}>
                            N° {m.member_number}
                            {m.user_telephone ? ` · ${m.user_telephone}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}

                {/* Séance */}
                <Text style={styles.label}>
                  Séance <Text style={styles.req}>*</Text>
                </Text>
                {sessionsLoading ? (
                  <ActivityIndicator color={colors.primary} style={styles.loader} />
                ) : sessions.length === 0 ? (
                  <Text style={styles.empty}>Aucune séance planifiée pour le moment.</Text>
                ) : (
                  sessions.map((s) => {
                    const active = s.id === sessionId;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setSessionId(s.id)}
                        style={[styles.option, active && styles.optionActive]}>
                        <Ionicons
                          name={active ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={active ? colors.primary : colors.textLight}
                        />
                        <View style={styles.flex}>
                          <Text style={styles.optionName}>Séance N°{s.session_number}</Text>
                          <Text style={styles.optionDesc} numberOfLines={1}>
                            {frDate(s.date)}
                            {s.location ? ` · ${s.location}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}

                {/* Tontine (optionnel) */}
                <Text style={styles.label}>
                  Tontine <Text style={styles.optional}>(optionnel)</Text>
                </Text>
                <View style={styles.chips}>
                  <Pressable
                    onPress={() => setTontineId(null)}
                    style={[styles.chip, tontineId === null && styles.chipActive]}>
                    <Text style={[styles.chipText, tontineId === null && styles.chipTextActive]}>
                      Toutes les tontines
                    </Text>
                  </Pressable>
                  {types.map((t) => {
                    const active = t.id === tontineId;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setTontineId(t.id)}
                        style={[styles.chip, active && styles.chipActive]}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.hint}>Laissez « Toutes les tontines » pour une délégation globale.</Text>

                {/* Motif */}
                <Text style={styles.label}>
                  Motif <Text style={styles.optional}>(facultatif)</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.inputArea]}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Raison de la procuration…"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}
              </ScrollView>

              <View style={styles.actions}>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={close} disabled={loading}>
                  <Text style={styles.btnGhostText}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
                  onPress={submit}
                  disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Créer</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.x2,
    maxHeight: '90%',
  },
  flex: { flex: 1 },
  loader: { marginVertical: 8, alignSelf: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  label: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.primary, marginTop: spacing.md, marginBottom: 6 },
  req: { color: colors.danger },
  optional: { color: colors.textLight, fontWeight: font.regular },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    minHeight: 48,
    fontSize: font.size.base,
    color: colors.textStrong,
  },
  inputArea: { borderRadius: radius.lg, paddingTop: 12, paddingBottom: 12, minHeight: 84 },
  hint: { fontSize: font.size.xs, color: colors.textMuted, marginTop: 4 },
  empty: { fontSize: font.size.sm, color: colors.textMuted, paddingVertical: 8 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  chipText: { fontSize: font.size.sm, fontWeight: font.medium, color: colors.textMuted },
  chipTextActive: { color: colors.primary, fontWeight: font.semibold },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  optionName: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  optionDesc: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1 },

  error: { color: colors.danger, marginTop: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: spacing.lg },
  btn: { minHeight: 46, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  btnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  btnGhostText: { color: colors.textMuted, fontWeight: font.semibold, fontSize: font.size.md },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.white, fontWeight: font.bold, fontSize: font.size.md },
  btnDisabled: { opacity: 0.6 },

  success: { alignItems: 'center', paddingVertical: spacing.lg },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text },
  successText: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: font.size.sm * 1.45,
    paddingHorizontal: spacing.md,
  },
  successBtn: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
