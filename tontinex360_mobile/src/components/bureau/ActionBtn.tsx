import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
export type ActionTone = 'success' | 'danger' | 'neutral';

const TONES: Record<ActionTone, { bg: string; fg: string }> = {
  success: { bg: colors.greenBgDeep, fg: colors.primary },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.surfaceAlt, fg: colors.textMuted },
};

/** Petit bouton circulaire d'action (✓ / ✗) pour les lignes de liste. */
export default function ActionBtn({
  icon,
  tone = 'neutral',
  onPress,
  disabled,
  loading,
  size = 36,
}: {
  icon: IoniconName;
  tone?: ActionTone;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: number;
}) {
  const t = TONES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg },
        (disabled || loading) && styles.disabled,
        pressed && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={t.fg} />
      ) : (
        <Ionicons name={icon} size={Math.round(size * 0.5)} color={t.fg} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
