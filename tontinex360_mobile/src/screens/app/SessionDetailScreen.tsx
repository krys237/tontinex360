import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Chip, type ChipTint } from '../../components/ui';
import { cyclesApi } from '../../lib/api/cycles';
import { sessionsApi } from '../../lib/api/sessions';
import { useAuthStore } from '../../lib/stores/auth-store';
import type { AttendanceStatus, Session, SessionStatus } from '../../lib/types/cycle';
import type { AppStackParamList } from '../../navigation/types';
import { formatDateFr } from '../../lib/utils/format';
import { apiErrorMessage } from '../../lib/utils/errors';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing, radius } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type DetailRoute = RouteProp<AppStackParamList, 'SessionDetail'>;

const STATUS: Record<SessionStatus, { label: string; tint: ChipTint }> = {
  scheduled: { label: 'Programmée', tint: 'green' },
  in_progress: { label: 'En cours', tint: 'gold' },
  completed: { label: 'Terminée', tint: 'grey' },
  cancelled: { label: 'Annulée', tint: 'danger' },
  postponed: { label: 'Reportée', tint: 'gold' },
};

function hhmm(t?: string | null) {
  return t ? t.slice(0, 5).replace(':', 'h') : '';
}

/** Heure locale HH'h'MM depuis un horodatage ISO complet. */
function isoTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

const MY_ATTENDANCE: Record<AttendanceStatus, { label: string; tint: ChipTint }> = {
  present: { label: 'Présent', tint: 'green' },
  late: { label: 'En retard', tint: 'gold' },
  excused: { label: 'Excusé', tint: 'gold' },
  absent: { label: 'Absent', tint: 'danger' },
  represented: { label: 'Représenté', tint: 'grey' },
};

function InfoLine({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

export default function SessionDetailScreen() {
  const insets = useSafeAreaInsets();
  const { params } = useRoute<DetailRoute>();
  const qc = useQueryClient();
  const myId = useAuthStore((st) => st.currentMembership)?.id;

  const placeholder = (qc.getQueryData<Session[]>(['sessions']) ?? []).find((s) => s.id === params.id);

  const sQ = useQuery({
    queryKey: ['session', params.id],
    queryFn: () => cyclesApi.getSession(params.id),
    initialData: placeholder,
  });

  // Politique de pointage + ma ligne de présence (le statut est décidé serveur).
  const cfgQ = useQuery({
    queryKey: ['attendance-config'],
    queryFn: () => sessionsApi.attendanceConfig(),
  });
  const attQ = useQuery({
    queryKey: ['session', params.id, 'attendances'],
    queryFn: () => sessionsApi.attendances(params.id),
    enabled: !!myId,
  });

  const joinMut = useMutation({
    mutationFn: () => sessionsApi.joinSession(params.id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['session', params.id, 'attendances'] });
      Alert.alert(
        'Présence enregistrée',
        res.attendance.status === 'late'
          ? `Arrivée à ${isoTime(res.attendance.checked_in_at)} — comptée en retard (marge dépassée).`
          : res.mode === 'manual'
            ? `Arrivée à ${isoTime(res.attendance.checked_in_at)}. Le bureau confirmera votre statut.`
            : `Arrivée à ${isoTime(res.attendance.checked_in_at)} — votre présence est confirmée.`,
      );
    },
    onError: (e: any) => Alert.alert('Erreur', apiErrorMessage(e)),
  });

  const s = sQ.data;

  if (!s) {
    return (
      <View style={styles.center}>
        {sQ.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.empty}>Séance introuvable.</Text>
        )}
      </View>
    );
  }

  const status = STATUS[s.status] ?? { label: s.status, tint: 'grey' as ChipTint };
  const dateLabel = formatDateFr(s.date, false);
  const timeLabel = s.start_time ? `${hhmm(s.start_time)}${s.end_time ? ` - ${hhmm(s.end_time)}` : ''}` : '';

  const cfg = cfgQ.data;
  const myAtt = myId ? (attQ.data ?? []).find((a) => a.membership === myId) : undefined;
  const myAttInfo = myAtt
    ? MY_ATTENDANCE[myAtt.status] ?? { label: String(myAtt.status), tint: 'grey' as ChipTint }
    : { label: '', tint: 'grey' as ChipTint };
  const canCheckIn =
    s.status === 'in_progress' && !!myId && (cfg ? cfg.allow_self_checkin : false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.x3 }]}>
      <View style={styles.metaRow}>
        <Chip label="Séance" tint="green" />
        <Chip label={status.label} tint={status.tint} />
      </View>

      <Text style={styles.title}>Séance N°{s.session_number}</Text>

      <View style={styles.infoCard}>
        {dateLabel ? <InfoLine icon="calendar" text={dateLabel} /> : null}
        {timeLabel ? <InfoLine icon="time" text={timeLabel} /> : null}
        {s.location ? <InfoLine icon="location" text={s.location} /> : null}
        {s.host_member_name ? <InfoLine icon="person" text={`Hôte : ${s.host_member_name}`} /> : null}
      </View>

      {/* Ma présence / self check-in */}
      {myAtt ? (
        <View style={styles.checkinCard}>
          <View style={styles.checkinHead}>
            <Ionicons name="finger-print" size={18} color={colors.primary} />
            <Text style={styles.checkinTitle}>Ma présence</Text>
            <Chip label={myAttInfo.label} tint={myAttInfo.tint} />
          </View>
          {myAtt.checked_in_at ? (
            <Text style={styles.checkinSub}>Arrivée enregistrée à {isoTime(myAtt.checked_in_at)}.</Text>
          ) : null}
        </View>
      ) : canCheckIn ? (
        <View style={styles.checkinCard}>
          <Pressable
            style={({ pressed }) => [styles.checkinBtn, pressed && { opacity: 0.9 }]}
            onPress={() => joinMut.mutate()}
            disabled={joinMut.isPending}>
            {joinMut.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="hand-right-outline" size={18} color={colors.white} />
                <Text style={styles.checkinBtnText}>Je suis présent·e</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.checkinSub}>
            {cfg?.mode === 'auto'
              ? `Retard compté au-delà de ${cfg.late_after_minutes} min après l'heure de début.`
              : 'Votre arrivée est horodatée ; le bureau confirmera votre statut.'}
          </Text>
        </View>
      ) : s.status === 'in_progress' && cfg && !cfg.allow_self_checkin ? (
        <View style={styles.checkinCard}>
          <Text style={styles.checkinSub}>
            Le pointage individuel est désactivé : le bureau enregistre les présences.
          </Text>
        </View>
      ) : null}

      {s.minutes ? (
        <>
          <Text style={styles.sectionTitle}>Compte rendu</Text>
          <Text style={styles.body}>{s.minutes}</Text>
        </>
      ) : null}

      {s.notes ? (
        <>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.body}>{s.notes}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: 12, paddingBottom: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty: { color: colors.textMuted, fontSize: font.size.md },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: font.size.x2, fontWeight: font.bold, color: colors.text, lineHeight: font.size.x2 * 1.25 },

  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    ...cardShadow,
  },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: font.size.md, color: colors.text, fontWeight: font.medium, flex: 1 },

  sectionTitle: { fontSize: font.size.lg, fontWeight: font.bold, color: colors.text, marginTop: 6 },
  body: { fontSize: font.size.md, color: colors.text, lineHeight: font.size.md * 1.6 },

  // Self check-in / ma présence
  checkinCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    ...cardShadow,
  },
  checkinHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkinTitle: { flex: 1, fontSize: font.size.md, fontWeight: font.bold, color: colors.text },
  checkinSub: { fontSize: font.size.sm, color: colors.textMuted },
  checkinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  checkinBtnText: { color: colors.white, fontSize: font.size.base, fontWeight: font.bold },
});
