import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, TextField, PrimaryButton, IconBubble } from '../../components/ui';
import StatusChip, { StatusTone } from '../../components/bureau/StatusChip';
import { invitationsApi } from '../../lib/api/invitations';
import type { InvitationChannel, InvitationStatus } from '../../lib/types/invitation';
import type { BubbleTint } from '../../components/ui/IconBubble';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';
import { timeAgo } from '../../lib/utils/format';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CHANNELS: { key: InvitationChannel; label: string; icon: IoniconName }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { key: 'sms', label: 'SMS', icon: 'chatbubble-ellipses' },
  { key: 'email', label: 'Email', icon: 'mail' },
  { key: 'link', label: 'Lien', icon: 'link' },
];

const STATUS: Record<InvitationStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  accepted: { label: 'Acceptée', tone: 'success' },
  declined: { label: 'Refusée', tone: 'danger' },
  expired: { label: 'Expirée', tone: 'muted' },
  revoked: { label: 'Annulée', tone: 'muted' },
};

const CHANNEL_META: Record<InvitationChannel, { icon: IoniconName; tint: BubbleTint }> = {
  whatsapp: { icon: 'logo-whatsapp', tint: 'lime' },
  sms: { icon: 'chatbubble-ellipses', tint: 'accent' },
  email: { icon: 'mail', tint: 'info' },
  link: { icon: 'link', tint: 'primary' },
};

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Envoi impossible pour le moment.';
}

export default function BureauInvitationsScreen() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState<InvitationChannel>('whatsapp');

  const listQ = useQuery({
    queryKey: ['bureau', 'invitations'],
    queryFn: () => invitationsApi.list(),
  });

  const sendMut = useMutation({
    mutationFn: () =>
      invitationsApi.send({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        channel,
      }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setEmail('');
      qc.invalidateQueries({ queryKey: ['bureau', 'invitations'] });
      Alert.alert('Invitation envoyée', 'Le destinataire recevra son lien d’invitation.');
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const canSend =
    !!name.trim() &&
    (channel === 'email' ? !!email.trim() : channel === 'link' ? true : !!phone.trim());

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={listQ.isRefetching}
            onRefresh={() => listQ.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {/* Formulaire */}
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Inviter un membre</Text>
          <TextField label="Nom complet" value={name} onChangeText={setName} placeholder="Ex : Awa Diallo" />
          <TextField
            label="Téléphone"
            value={phone}
            onChangeText={setPhone}
            placeholder="+237 6XX XXX XXX"
            keyboardType="phone-pad"
          />
          <TextField
            label="Email (optionnel)"
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.channelLabel}>Canal d’envoi</Text>
          <View style={styles.channels}>
            {CHANNELS.map((c) => {
              const on = c.key === channel;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setChannel(c.key)}
                  style={[styles.channel, on && styles.channelOn]}
                >
                  <Ionicons name={c.icon} size={16} color={on ? colors.white : colors.textMuted} />
                  <Text style={[styles.channelText, on && styles.channelTextOn]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton
            title="Envoyer l'invitation"
            onPress={() => sendMut.mutate()}
            loading={sendMut.isPending}
            disabled={!canSend}
            style={{ marginTop: spacing.sm }}
          />
        </Card>

        {/* Liste */}
        <Text style={styles.sectionLabel}>Invitations envoyées</Text>
        {listQ.isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : (listQ.data ?? []).length === 0 ? (
          <View style={styles.empty}>
            <IconBubble icon="paper-plane-outline" tint="lime" size={56} />
            <Text style={styles.emptyText}>Aucune invitation envoyée.</Text>
          </View>
        ) : (
          (listQ.data ?? []).map((inv) => {
            const st = STATUS[inv.status] ?? STATUS.pending;
            const cm = CHANNEL_META[inv.channel] ?? CHANNEL_META.link;
            return (
              <View key={inv.id} style={styles.row}>
                <IconBubble icon={cm.icon} tint={cm.tint} size={40} />
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{inv.name || inv.phone || inv.email || 'Invitation'}</Text>
                  <Text style={styles.rowSub}>
                    {inv.channel} · {timeAgo(inv.created_at)}
                  </Text>
                </View>
                <StatusChip label={st.label} tone={st.tone} />
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.x5 },
  formCard: { borderRadius: radius.lg, gap: 2 },
  formTitle: { fontSize: font.size.md, fontWeight: font.bold, color: colors.text, marginBottom: spacing.sm },
  channelLabel: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  channels: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  channelOn: { backgroundColor: colors.primary },
  channelText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  channelTextOn: { color: colors.white },

  sectionLabel: {
    fontSize: font.size.sm,
    fontWeight: font.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    ...cardShadow,
  },
  rowTitle: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text },
  rowSub: { fontSize: font.size.sm, color: colors.textMuted, marginTop: 1, textTransform: 'capitalize' },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.x4 },
  emptyText: { fontSize: font.size.sm, color: colors.textMuted },
});
