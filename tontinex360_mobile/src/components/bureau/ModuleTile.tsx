import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IconBubble } from '../ui';
import type { BubbleTint } from '../ui/IconBubble';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadow';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Tuile de module du dashboard bureau (grille 3 colonnes). */
export default function ModuleTile({
  icon,
  label,
  desc,
  tint = 'lime',
  badge,
  disabled,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  desc: string;
  tint?: BubbleTint;
  badge?: number;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        disabled && styles.disabled,
        pressed && !disabled && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <View>
        <IconBubble icon={icon} tint={tint} size={48} outline={true} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.desc} numberOfLines={2}>
        {disabled ? 'Bientôt' : desc}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '31%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
    ...cardShadow,
  },
  disabled: { opacity: 0.55 },
  label: { fontWeight: font.bold, color: colors.text, fontSize: 13, marginTop: 4, textAlign: 'center' },
  desc: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: font.bold },
});
