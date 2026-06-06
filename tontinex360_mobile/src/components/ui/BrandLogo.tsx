import React from 'react';
import { Image, StyleSheet } from 'react-native';

const LOGO = require('../../assets/logo/logo-full.png');
const ICON = require('../../assets/logo/logo-icon.png');

/** TontineX360 brand logo (full lockup by default, or icon-only). */
export default function BrandLogo({
  width = 150,
  variant = 'full',
}: {
  width?: number;
  variant?: 'full' | 'icon';
}) {
  // logo-full is ~1.9:1 (w:h); icon ~1:1
  const ratio = variant === 'full' ? 0.42 : 1;
  return (
    <Image
      source={variant === 'full' ? LOGO : ICON}
      style={[styles.logo, { width, height: width * ratio }]}
      resizeMode="contain"
      accessibilityLabel="TontineX360"
    />
  );
}

const styles = StyleSheet.create({ logo: { alignSelf: 'center' } });
