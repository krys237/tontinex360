import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IntroStackParamList } from '../../navigation/types';
import BrandLogo from '../../components/ui/BrandLogo';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';

type Props = NativeStackScreenProps<IntroStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace('Welcome'), 1600);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <BrandLogo width={200} />
      <Text style={styles.tagline}>Vos tontines, en toute confiance</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  tagline: {
    marginTop: 16,
    fontSize: font.size.md,
    color: colors.textMuted,
  },
});
