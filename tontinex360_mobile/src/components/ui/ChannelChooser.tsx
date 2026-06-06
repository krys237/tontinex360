import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MessageCircle, Phone, Mail } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/spacing';
import { font } from '../../theme/typography';

export type OtpChannel = 'whatsapp' | 'sms' | 'email';

const OPTIONS: { key: OtpChannel; label: string; Icon: typeof Phone }[] = [
  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { key: 'sms', label: 'SMS', Icon: Phone },
  { key: 'email', label: 'Email', Icon: Mail },
];

/** Segmented chooser for the OTP delivery channel. */
export default function ChannelChooser({
  value,
  onChange,
}: {
  value: OtpChannel;
  onChange: (c: OtpChannel) => void;
}) {
  return (
    <View style={styles.row}>
      {OPTIONS.map(({ key, label, Icon }) => {
        const selected = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}>
            <Icon size={18} color={selected ? colors.primary : colors.textMuted} />
            <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.tintGreenBg },
  label: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.medium },
  labelSelected: { color: colors.primary, fontWeight: font.semibold },
});
