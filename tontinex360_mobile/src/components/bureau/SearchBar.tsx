import React from 'react';
import { View, TextInput, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

/** Barre de recherche réutilisable (recherche globale + intra-tuile). */
export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Rechercher…',
  autoFocus,
  style,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Effacer la recherche">
          <Ionicons name="close-circle" size={18} color={colors.textLight} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
  },
  input: {
    flex: 1,
    fontSize: font.size.base,
    color: colors.textStrong,
    paddingVertical: 10,
  },
});
