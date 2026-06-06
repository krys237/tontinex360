import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
} from 'react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { font } from '../../theme/typography';

type Props = {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  shape?: 'circle' | 'rounded';
  autoFocus?: boolean;
};

/**
 * Verification code input backed by one hidden TextInput.
 * Cells are responsive (flex) so the row always fits its container width
 * (no horizontal overflow on small screens or inside padded cards).
 */
export default function OtpInput({
  value,
  onChange,
  length = 6,
  shape = 'circle',
  autoFocus,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const cells = Array.from({ length });

  const handleChange = (raw: string) => {
    onChange(raw.replace(/\D/g, '').slice(0, length));
  };

  return (
    <Pressable style={styles.wrap} onPress={() => inputRef.current?.focus()}>
      {cells.map((_, i) => {
        const char = value[i] ?? '';
        const active = i === value.length;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              shape === 'circle' ? styles.circle : styles.rounded,
              (char || active) && styles.cellActive,
            ]}>
            <Text style={styles.char}>{char}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        style={styles.hiddenInput}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  cell: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
  },
  circle: { borderRadius: 999 },
  rounded: { borderRadius: radius.md, backgroundColor: colors.inputBgAlt, borderWidth: 0 },
  cellActive: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.surface },
  char: { fontSize: font.size.xl, fontWeight: font.bold, color: colors.textStrong },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
});
