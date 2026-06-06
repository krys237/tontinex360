import React from 'react';
import { View, Image, StyleSheet, Pressable } from 'react-native';
import { Camera } from 'lucide-react-native';
import { colors } from '../../theme/colors';

/** Circular avatar with a camera affordance (image picking wired in a later phase). */
export default function AvatarPicker({
  uri,
  onPress,
  size = 120,
}: {
  uri?: string | null;
  onPress?: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Choisir une photo de profil"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <Camera size={28} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignSelf: 'center',
    backgroundColor: colors.inputBgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
