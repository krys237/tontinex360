import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  View,
  ViewStyle,
} from 'react-native';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { radius, HIT } from '../../theme/spacing';
import { font } from '../../theme/typography';

type BaseProps = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  withArrow?: boolean;
};

function pressedStyle(pressed: boolean): ViewStyle {
  return pressed ? { opacity: 0.85 } : {};
}

/** Solid dark-green pill — the primary CTA. */
export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  style,
  withArrow,
}: BaseProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        isDisabled && styles.disabled,
        pressedStyle(pressed),
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <View style={styles.row}>
          <Text style={styles.primaryText}>{title}</Text>
          {withArrow ? <ArrowRight color={colors.onPrimary} size={18} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Light-green pill — secondary action ("Faire un tour rapide"). */
export function SoftButton({ title, onPress, disabled, style }: BaseProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        styles.soft,
        disabled && styles.disabled,
        pressedStyle(pressed),
        style,
      ]}>
      <Text style={styles.softText}>{title}</Text>
    </Pressable>
  );
}

/** White pill with green outline ("Renvoyer par SMS"). */
export function OutlineButton({ title, onPress, loading, disabled, style }: BaseProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        styles.outline,
        isDisabled && styles.disabled,
        pressedStyle(pressed),
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text style={styles.outlineText}>{title}</Text>
      )}
    </Pressable>
  );
}

/** Compact pill used for wizard navigation (Retour / Suivant). */
export function PillButton({
  title,
  onPress,
  direction,
  variant = 'solid',
  disabled,
  style,
}: BaseProps & { direction?: 'back' | 'next'; variant?: 'solid' | 'soft' }) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.pill,
        solid ? styles.primary : styles.soft,
        disabled && styles.disabled,
        pressedStyle(pressed),
        style,
      ]}>
      <View style={styles.row}>
        {direction === 'back' ? (
          <ArrowLeft color={solid ? colors.onPrimary : colors.white} size={16} />
        ) : null}
        <Text style={solid ? styles.primaryText : styles.softText}>{title}</Text>
        {direction === 'next' ? (
          <ArrowRight color={solid ? colors.onPrimary : colors.white} size={16} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pill: {
    minHeight: HIT,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: colors.primary },
  primaryText: { color: colors.onPrimary, fontSize: font.size.base, fontWeight: font.bold },
  soft: { backgroundColor: colors.soft },
  softText: { color: colors.white, fontSize: font.size.base, fontWeight: font.bold },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineText: { color: colors.primary, fontSize: font.size.base, fontWeight: font.bold },
  disabled: { opacity: 0.5 },
});
