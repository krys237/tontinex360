/**
 * Poppins integration (design handoff mandates Poppins 400/500/600/700).
 *
 * `poppinsFonts` is passed to expo-font's useFonts in App.
 * `patchTextFonts()` makes ALL <Text>/<TextInput> use Poppins by default,
 * mapping their fontWeight to the matching Poppins family — so existing
 * components (Phase 1) pick up Poppins without per-style edits. An explicit
 * `fontFamily` in a style always wins.
 */
import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

// Import only the 4 weights we use (direct .ttf require avoids bundling all 18 variants).
export const poppinsFonts = {
  Poppins_400Regular: require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
  Poppins_500Medium: require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
  Poppins_600SemiBold: require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
  Poppins_700Bold: require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
};

export const poppins = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

function familyForWeight(weight: unknown): string {
  switch (String(weight)) {
    case '500':
      return poppins.medium;
    case '600':
      return poppins.semibold;
    case '700':
    case 'bold':
    case '800':
    case '900':
      return poppins.bold;
    default:
      return poppins.regular;
  }
}

let patched = false;

/** Inject Poppins as the default font family for Text and TextInput, app-wide. */
export function patchTextFonts(): void {
  if (patched) return;
  for (const Comp of [Text, TextInput] as any[]) {
    const orig = Comp.render;
    if (typeof orig !== 'function') continue;
    Comp.render = function patchedRender(...args: any[]) {
      const el = orig.apply(this, args);
      if (!el || !React.isValidElement(el)) return el;
      const flat = (StyleSheet.flatten((el.props as any)?.style) || {}) as any;
      const family = flat.fontFamily || familyForWeight(flat.fontWeight);
      return React.cloneElement(el as any, {
        style: [{ fontFamily: family }, (el.props as any).style],
      });
    };
  }
  patched = true;
}
