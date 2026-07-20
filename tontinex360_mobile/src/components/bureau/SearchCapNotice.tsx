import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

/**
 * Avertissement honnête affiché quand la recherche intra-tuile porte sur une
 * liste plafonnée (200 éléments chargés) : le filtrage client ne voit pas
 * au-delà. À montrer uniquement quand `visible` (liste au plafond + requête).
 */
export default function SearchCapNotice({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Ionicons name="information-circle-outline" size={15} color={colors.info} />
      <Text style={styles.text}>
        Recherche limitée aux 200 éléments les plus récents chargés.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  text: { flex: 1, fontSize: font.size.xs, color: colors.info },
});
