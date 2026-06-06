import { Platform, ViewStyle } from 'react-native';
import { colors } from './colors';

// Green-tinted shadows from the handoff:
//   card:   0 2px 8px rgba(67,121,63,.08)
//   lifted: 0 8px 24px rgba(67,121,63,.12)

export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 2 },
  default: {},
}) as ViewStyle;

export const liftedShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  android: { elevation: 6 },
  default: {},
}) as ViewStyle;
