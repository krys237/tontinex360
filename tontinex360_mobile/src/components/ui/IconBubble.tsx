import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme/colors';

export type BubbleTint = 'lime' | 'primary' | 'accent' | 'danger' | 'info' | 'white';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TINTS: Record<BubbleTint, { bg: string; fg: string }> = {
  lime: { bg: colors.greenBg, fg: colors.green[500] },
  primary: { bg: colors.greenBgDeep, fg: colors.primary },
  accent: { bg: colors.goldSoft, fg: colors.goldAccent },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: '#E0F2FE', fg: colors.info },
  white: { bg: colors.white, fg: colors.primary },
};

/** Soft tinted circular icon container. */
export default function IconBubble({
  icon,
  size = 40,
  tint = 'lime',
  outline = false,
  style,
}: {
  icon: IoniconName;
  size?: number;
  tint?: BubbleTint;
  outline?: boolean;
  style?: ViewStyle;
}) {
  const t = TINTS[tint];
  const isWhite = tint === 'white';
  const bg = (isWhite || outline) ? colors.white : t.bg;
  const border = isWhite ? colors.primary : (outline ? t.fg : null);

  return (
    <View
      style={[
        styles.bubble,
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          backgroundColor: bg,
          ...(border ? { borderWidth: 1, borderColor: border } : {})
        },
        style,
      ]}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={t.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { alignItems: 'center', justifyContent: 'center' },
});
