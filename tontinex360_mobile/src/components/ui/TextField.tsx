import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { font } from '../../theme/typography';

type Props = TextInputProps & {
  label?: string;
  required?: boolean;
  helper?: string;
  error?: string | null;
  variant?: 'pill' | 'filled';
  containerStyle?: ViewStyle;
};

/**
 * Labeled text input. `pill` = white rounded (card screens),
 * `filled` = light-gray (accept-invite profile). Supports password toggle.
 */
export default function TextField({
  label,
  required,
  helper,
  error,
  variant = 'pill',
  containerStyle,
  secureTextEntry,
  multiline,
  style,
  ...rest
}: Props) {
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const isPassword = !!secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.req}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          variant === 'filled' ? styles.filled : styles.pill,
          multiline && styles.multiline,
          !!error && styles.fieldError,
        ]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline, style]}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={hidden}
          multiline={multiline}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Afficher le mot de passe' : 'Masquer le mot de passe'}>
            {hidden ? (
              <Eye size={20} color={colors.textMuted} />
            ) : (
              <EyeOff size={20} color={colors.textMuted} />
            )}
          </Pressable>
        ) : null}
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  pill: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.pill,
  },
  filled: {
    backgroundColor: colors.inputBgAlt,
    borderRadius: radius.lg,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: 12, minHeight: 96 },
  fieldError: { borderColor: colors.danger, borderWidth: 1 },
  input: {
    flex: 1,
    fontSize: font.size.base,
    color: colors.textStrong,
    paddingVertical: 12,
  },
  inputMultiline: { textAlignVertical: 'top' },
  helper: { marginTop: 6, fontSize: font.size.sm, color: colors.textMuted },
  error: { marginTop: 6, fontSize: font.size.sm, color: colors.danger },
});
