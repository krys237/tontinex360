import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { font } from '../../theme/typography';

type Props = {
  label?: string;
  required?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  helper?: string;
  error?: string | null;
  dialCode?: string;
  countryCode?: string;
  onPressCountry?: () => void;
  placeholder?: string;
};

/**
 * Phone input with a country selector chip (e.g. "CM +237") + national number.
 * Country picker is a stub for now (Phase 1) — defaults to Cameroon.
 */
export default function PhoneField({
  label = 'Téléphone',
  required,
  value,
  onChangeText,
  helper,
  error,
  dialCode = '+237',
  countryCode = 'CM',
  onPressCountry,
  placeholder = '6XX XXX XXX',
}: Props) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      ) : null}

      <View style={styles.row}>
        <Pressable
          onPress={onPressCountry}
          accessibilityRole="button"
          accessibilityLabel={`Pays ${countryCode} ${dialCode}`}
          style={styles.country}>
          <Text style={styles.countryCode}>{countryCode}</Text>
          <Text style={styles.dial}>{dialCode}</Text>
          <ChevronDown size={16} color={colors.textMuted} />
        </Pressable>

        <View style={[styles.numberWrap, isFocused && styles.fieldFocused, !!error && styles.fieldError]}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: {
    fontSize: font.size.md,
    fontWeight: font.semibold,
    color: colors.text,
    marginBottom: 8,
  },
  req: { color: colors.accent },
  row: { flexDirection: 'row', gap: 10 },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 52,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
  },
  countryCode: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.text },
  dial: { fontSize: font.size.base, fontWeight: font.semibold, color: colors.text },
  numberWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
  },
  fieldFocused: {
    borderColor: colors.primary,
  },
  fieldError: { borderColor: colors.danger },
  input: { fontSize: font.size.base, color: colors.textStrong, paddingVertical: 12 },
  helper: { marginTop: 6, fontSize: font.size.sm, color: colors.textMuted },
  error: { marginTop: 6, fontSize: font.size.sm, color: colors.danger },
});
