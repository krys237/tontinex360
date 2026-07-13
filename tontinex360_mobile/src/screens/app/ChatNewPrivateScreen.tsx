import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { Card, PrimaryButton } from '../../components/ui';
import MemberPicker from '../../components/bureau/MemberPicker';
import { chatApi } from '../../lib/api/chat';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

function errMsg(e: any): string {
  return e?.response?.data?.detail ?? e?.response?.data?.error ?? 'Action impossible pour le moment.';
}

export default function ChatNewPrivateScreen() {
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const [member, setMember] = useState<{ id: string; name: string } | null>(null);

  const startMut = useMutation({
    mutationFn: () => chatApi.createPrivate(member!.id),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      navigation.replace('Conversation', { id: conv.id, title: member!.name });
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <MemberPicker label="Membre" value={member} onChange={setMember} />
          <PrimaryButton
            title="Démarrer la conversation"
            onPress={() => startMut.mutate()}
            loading={startMut.isPending}
            disabled={!member}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg },
  card: { borderRadius: radius.lg },
});
