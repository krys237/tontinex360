// TontineX360 brand palette — canonical tokens from the member design handoff
// (design_handoff_mobile_member/colors_and_type.css). This is the source of truth.

const green = {
  900: '#232B1D', // deepest foliage / near-black green
  800: '#3D6A2A', // primaryDark — gradient end, pressed
  700: '#43793F', // PRIMARY — buttons, headings, icons
  600: '#5A8C3F', // primaryLight
  500: '#87C241', // lime — secondary accent, gradients
  400: '#A8D26A', // lime-soft
  100: '#F1F8E8', // green-bg — pale banners/cards
  50: '#F7FBF0',
};

const gold = {
  base: '#E5BC2C', // accent — pending status, highlights
  light: '#EDD743',
  soft: '#FBF6CF',
  beige: '#EFDB99',
};

const blue = {
  600: '#007AFF', // info
  100: '#EAF1FB',
  border: '#D2E0F5',
};

export const colors = {
  // brand scales
  green,
  gold,
  blue,

  // semantic (stable keys used across the app)
  primary: green[700],
  primaryDark: green[800],
  primaryDarker: green[900],
  primaryLight: green[100],
  soft: green[500], // light-green pill buttons (lime)
  limeSoft: green[400],
  accent: green[500], // lime — active dots, asterisks
  goldAccent: gold.base,
  goldSoft: gold.soft,

  // surfaces
  bg: '#FAFAFA', // app screen background
  background: '#FAFAFA',
  bgGradientTop: '#E7F4E9', // auth mint gradient (kept for auth screens)
  bgGradientBottom: '#FFFFFF',
  surface: '#FFFFFF', // card
  surfaceAlt: '#F4F4F5',
  surfaceMuted: '#EBEBEB', // inputs, progress track
  greenBg: green[100],
  greenBgDeep: '#E0F0CC',

  // text
  heading: green[700],
  text: '#1E3233', // primary copy (deep teal-black)
  textStrong: '#1E3233',
  textMuted: '#707070',
  textLight: '#A0A0A0',
  placeholder: '#A0A0A0',
  footer: '#A0A0A0',
  onPrimary: '#FFFFFF',

  // lines / inputs
  border: '#DFDEDE',
  inputBorder: '#DFDEDE',
  inputBg: '#FFFFFF',
  inputBgAlt: '#EBEBEB',

  // tints (info cards)
  tintGreenBg: green[100],
  tintGreenBorder: '#E0F0CC',
  tintBlueBg: blue[100],
  tintBlueBorder: blue.border,

  // status
  danger: '#9A5356',
  dangerSoft: '#FCE7E7',
  warning: gold.base,
  success: '#34C759',
  ok: '#34C759',
  error: '#FF3B30',
  info: '#007AFF',

  // green-tinted shadow color (use with low opacity)
  shadow: '#43793F',

  white: '#FFFFFF',
  black: '#000000',
};

export type Colors = typeof colors;
