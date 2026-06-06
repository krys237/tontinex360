import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { IntroStackParamList } from '../../navigation/types';
import { PrimaryButton, SoftButton } from '../../components/ui/Buttons';
import { useAppStore } from '../../lib/stores/app-store';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<IntroStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  const finish = () => useAppStore.getState().setOnboardingSeen(true);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.illustrationWrap}>
        <Image
          source={require('../../assets/illustrations/onboarding-1.png')}
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>Gérez votre tontine en toute confiance</Text>

      <View style={styles.actions}>
        <SoftButton title="Faire un tour rapide" onPress={() => navigation.navigate('Tour')} />
        <PrimaryButton title="Commencer" onPress={finish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.x2,
    justifyContent: 'space-between',
  },
  illustrationWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  illustration: { width: '85%', height: 280 },
  title: {
    fontSize: font.size.xl,
    fontWeight: font.bold,
    color: colors.textStrong,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: spacing.x3,
  },
  actions: { gap: 12, paddingBottom: spacing.lg },
});
