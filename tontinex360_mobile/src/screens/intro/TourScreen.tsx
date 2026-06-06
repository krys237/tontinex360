import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/ui/Buttons';
import Dots from '../../components/ui/Dots';
import { useAppStore } from '../../lib/stores/app-store';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const SLIDES = [
  {
    image: require('../../assets/illustrations/onboarding-2.png'),
    title: 'Gérez votre tontine sans stress',
    body: 'Fini les erreurs, les oublis et les conflits. Toutes vos cotisations sont suivies automatiquement.',
  },
  {
    image: require('../../assets/illustrations/onboarding-3.png'),
    title: 'Des prêts enfin sécurisés',
    body: 'Chaque prêt est validé par des avalistes avec signature, selfie et confirmation.',
  },
  {
    image: require('../../assets/illustrations/onboarding-1.png'),
    title: 'Gardez le contrôle à tout moment',
    body: 'Suivez les cotisations, les retards et l’évolution de votre tontine en temps réel.',
  },
];

export default function TourScreen() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const finish = () => useAppStore.getState().setOnboardingSeen(true);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}>
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.circle}>
              <Image source={s.image} style={styles.image} resizeMode="contain" />
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Dots count={SLIDES.length} active={index} />
        <PrimaryButton title="Commencer" onPress={finish} style={styles.cta} />
        <Pressable onPress={finish} hitSlop={10}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const CIRCLE = 280;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.x2, flex: 1 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.green[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.x3,
  },
  image: { width: CIRCLE * 0.78, height: CIRCLE * 0.78 },
  title: {
    fontSize: font.size.xl,
    fontWeight: font.bold,
    color: colors.heading,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: font.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: font.size.md * 1.5,
    paddingHorizontal: 12,
  },
  footer: { paddingHorizontal: spacing.x2, paddingBottom: spacing.lg, gap: spacing.lg },
  cta: { marginTop: spacing.sm },
  skip: { textAlign: 'center', color: colors.textMuted, fontWeight: font.semibold, paddingVertical: 4 },
});
