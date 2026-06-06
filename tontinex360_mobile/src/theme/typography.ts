import { TextStyle } from 'react-native';

/**
 * Type scale. The Figma uses a rounded geometric sans (Poppins-like). We use the
 * system font for now; to match exactly, drop Poppins TTFs into the project and
 * set `fontFamily` here (see README "À faire").
 */
export const font = {
  // weights
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  extrabold: '800' as TextStyle['fontWeight'],

  // sizes
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    base: 16,
    lg: 18,
    xl: 22,
    x2: 26,
    x3: 30,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
  },
};
