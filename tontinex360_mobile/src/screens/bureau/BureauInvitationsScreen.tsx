import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import { invitationsApi } from '../../lib/api/invitations';
import { membersApi } from '../../lib/api/members';
import type { InvitationChannel } from '../../lib/types/invitation';
import type { BureauStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauInvitations'>;
type Rt = RouteProp<BureauStackParamList, 'BureauInvitations'>;

const CHANNELS: { key: InvitationChannel; label: string; icon: IoniconName }[] = [
  { key: 'email', label: 'Email', icon: 'mail' },
  { key: 'sms', label: 'SMS', icon: 'chatbubble-ellipses' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { key: 'link', label: 'Lien', icon: 'link' },
];

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Envoi impossible pour le moment.';
}

export default function BureauInvitationsScreen() {
  const qc = useQueryClient();
  const navigation = useNavigation<Nav>();
  const routeChannel = useRoute<Rt>().params?.channel;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState<InvitationChannel>(routeChannel ?? 'email');
  const [roleId, setRoleId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [autoFees, setAutoFees] = useState(false);

  const rolesQ = useQuery({
    queryKey: ['bureau', 'roles'],
    queryFn: () => membersApi.roles(),
    retry: false,
  });

  const sendMut = useMutation({
    mutationFn: () =>
      invitationsApi.send({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        channel,
        role: roleId || undefined,
        message: message.trim() || undefined,
        auto_mark_fees_paid: autoFees,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'invitations'] });
      Alert.alert('Invitation envoyée', 'Le destinataire recevra son lien d’invitation.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const canSend =
    !!name.trim() &&
    (channel === 'email' ? !!email.trim() : channel === 'link' ? true : !!phone.trim());

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.formCard}>
          <TextField label="Nom du destinataire" value={name} onChangeText={setName} placeholder="Jean Kamga" />
          <View style={styles.row2}>
            <TextField containerStyle={styles.flex} label="Email" value={email} onChangeText={setEmail} placeholder="jean@example.com" keyboardType="email-address" autoCapitalize="none" />
            <TextField containerStyle={styles.flex} label="Téléphone" value={phone} onChangeText={setPhone} placeholder="+237 6XX XXX XXX" keyboardType="phone-pad" />
          </View>

          {/* Canal d'envoi */}
          <Text style={styles.label}>Canal d’envoi</Text>
          <View style={styles.channels}>
            {CHANNELS.map((c) => {
              const on = c.key === channel;
              return (
                <Pressable key={c.key} onPress={() => setChannel(c.key)} style={[styles.channel, on && styles.channelOn]}>
                  <Ionicons name={c.icon} size={16} color={on ? colors.primary : colors.textMuted} />
                  <Text style={[styles.channelText, on && styles.channelTextOn]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Rôle initial */}
          <Text style={styles.label}>Rôle initial (optionnel)</Text>
          <View style={styles.roleWrap}>
            <Pressable onPress={() => setRoleId('')} style={[styles.roleChip, !roleId && styles.roleChipOn]}>
              <Text style={[styles.roleChipText, !roleId && styles.roleChipTextOn]}>Aucun rôle</Text>
            </Pressable>
            {(rolesQ.data ?? []).map((r) => {
              const on = roleId === r.id;
              return (
                <Pressable key={r.id} onPress={() => setRoleId(r.id)} style={[styles.roleChip, on && styles.roleChipOn]}>
                  <Text style={[styles.roleChipText, on && styles.roleChipTextOn]}>{r.name}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Message personnalisé */}
          <TextField label="Message personnalisé" value={message} onChangeText={setMessage} placeholder="Bienvenue dans notre association !" multiline />

          {/* Frais déjà à jour */}
          <Pressable style={styles.feesBox} onPress={() => setAutoFees((v) => !v)}>
            <Ionicons name={autoFees ? 'checkbox' : 'square-outline'} size={20} color={autoFees ? colors.primary : colors.goldAccent} />
            <View style={styles.flex}>
              <Text style={styles.feesTitle}>Ce membre est déjà à jour de ses frais d'adhésion</Text>
              <Text style={styles.feesText}>
                Cochez si l'inscription et le fond de membre ont déjà été payés (fondateur, ancien membre…).
                Le membre sera directement actif à l'acceptation.
              </Text>
            </View>
          </Pressable>

          <PrimaryButton title="Envoyer l'invitation" onPress={() => sendMut.mutate()} loading={sendMut.isPending} disabled={!canSend} style={{ marginTop: spacing.sm }} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  formCard: { borderRadius: radius.lg, gap: 2 },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  row2: { flexDirection: 'row', gap: spacing.sm },
  channels: { gap: spacing.sm, marginBottom: 14 },
  channel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  channelOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  channelText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  channelTextOn: { color: colors.primary },
  roleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 14 },
  roleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  roleChipOn: { backgroundColor: colors.primary },
  roleChipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  roleChipTextOn: { color: colors.white },
  feesBox: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md, marginTop: 4, marginBottom: spacing.sm },
  feesTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: '#7A5B10' },
  feesText: { fontSize: font.size.xs, color: '#8A6D1E', marginTop: 2 },
});
