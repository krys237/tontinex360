import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Card, TextField, PrimaryButton } from '../../components/ui';
import type { BureauStackParamList } from '../../navigation/types';
import { tontinesApi } from '../../lib/api/tontines';
import { financeApi } from '../../lib/api/finance';
import type {
  TontineType, ContributionKind, TontineRateMode, PayoutPattern, AcquisitionMethod,
} from '../../lib/types/tontine';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { radius, spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BureauStackParamList, 'BureauTontineTypeForm'>;
type Rt = RouteProp<BureauStackParamList, 'BureauTontineTypeForm'>;

const RATE_MODES: { key: TontineRateMode; label: string }[] = [
  { key: 'fixed', label: 'Fixe' },
  { key: 'range', label: 'Plage' },
  { key: 'free', label: 'Libre' },
];

const PAYOUT_PATTERNS: { key: PayoutPattern; label: string }[] = [
  { key: 'rotating', label: 'Tontine rotative — 1 bénéficiaire / séance' },
  { key: 'individual_savings', label: 'Épargne individuelle (banque scolaire)' },
  { key: 'collective_savings', label: 'Caisse commune (trésorerie)' },
];

const METHODS: { key: AcquisitionMethod; label: string }[] = [
  { key: 'random', label: 'Tirage aléatoire' },
  { key: 'sequential', label: 'Tour de rôle' },
  { key: 'auction', label: 'Enchère' },
  { key: 'vote', label: 'Vote des membres' },
  { key: 'need_based', label: 'Selon le besoin' },
  { key: 'manual', label: 'Attribution manuelle' },
];

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function errMsg(e: any): string {
  const d = e?.response?.data;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    const first = Object.values(d)[0];
    if (Array.isArray(first)) return String(first[0]);
    return d.detail ?? d.error ?? JSON.stringify(d);
  }
  return 'Enregistrement impossible pour le moment.';
}

function Chips<T extends string>({
  options, value, onChange,
}: { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function BureauTontineTypeFormScreen() {
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const editId = useRoute<Rt>().params?.id;
  const isEdit = !!editId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ContributionKind>('cash');
  const [unitLabel, setUnitLabel] = useState('');
  const [unitValue, setUnitValue] = useState('');
  const [rateMode, setRateMode] = useState<TontineRateMode>('fixed');
  const [fixedRate, setFixedRate] = useState('');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [shareUnitName, setShareUnitName] = useState('nom');
  const [account, setAccount] = useState<string>(''); // '' = caisse principale
  const [multiShares, setMultiShares] = useState(true);
  const [maxShares, setMaxShares] = useState('5');
  const [pattern, setPattern] = useState<PayoutPattern>('rotating');
  const [method, setMethod] = useState<AcquisitionMethod>('random');

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Modifier le type' : 'Nouveau type de cotisation' });
  }, [navigation, isEdit]);

  const accountsQ = useQuery({
    queryKey: ['bureau', 'treasury'],
    queryFn: () => financeApi.treasury(),
    retry: false,
  });

  const typeQ = useQuery({
    queryKey: ['bureau', 'tontine-type', editId],
    queryFn: () => tontinesApi.getType(editId!),
    enabled: isEdit,
  });

  // Préremplissage en édition
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (typeQ.data && !loaded) {
      const t = typeQ.data;
      setName(t.name ?? '');
      setDescription(t.description ?? '');
      setKind(t.contribution_kind ?? 'cash');
      setUnitLabel(t.in_kind_unit_label ?? '');
      setUnitValue(t.in_kind_unit_value != null ? String(t.in_kind_unit_value) : '');
      setRateMode(t.rate_mode ?? 'fixed');
      setFixedRate(t.fixed_rate != null ? String(t.fixed_rate) : '');
      setMinRate(t.min_rate != null ? String(t.min_rate) : '');
      setMaxRate(t.max_rate != null ? String(t.max_rate) : '');
      setCurrency(t.currency ?? 'XAF');
      setShareUnitName(t.share_unit_name ?? 'nom');
      setAccount(t.default_account ?? '');
      setMultiShares(t.allows_multiple_shares ?? true);
      setMaxShares(t.max_shares_per_member != null ? String(t.max_shares_per_member) : '5');
      setPattern(t.payout_pattern ?? 'rotating');
      setMethod(t.default_acquisition_method ?? 'random');
      setLoaded(true);
    }
  }, [typeQ.data, loaded]);

  // L'épargne individuelle impose le mode libre (règle backend).
  const onChangePattern = (p: PayoutPattern) => {
    setPattern(p);
    if (p === 'individual_savings') setRateMode('free');
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Partial<TontineType> = {
        name: name.trim(),
        slug: slugify(name) || undefined,
        description: description.trim(),
        contribution_kind: kind,
        rate_mode: rateMode,
        currency: currency.trim() || 'XAF',
        share_unit_name: shareUnitName.trim() || 'nom',
        allows_multiple_shares: multiShares,
        max_shares_per_member: multiShares ? Number(maxShares) || 1 : 1,
        payout_pattern: pattern,
        default_acquisition_method: method,
        default_account: account || null,
      };
      if (kind === 'in_kind') {
        payload.in_kind_unit_label = unitLabel.trim();
        payload.in_kind_unit_value = Number(unitValue) || 0;
      }
      if (rateMode === 'fixed') payload.fixed_rate = Number(fixedRate) || 0;
      if (rateMode === 'range') {
        payload.min_rate = Number(minRate) || 0;
        payload.max_rate = Number(maxRate) || 0;
      }
      return isEdit ? tontinesApi.updateType(editId!, payload) : tontinesApi.createType(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bureau', 'tontine-types'] });
      Alert.alert(isEdit ? 'Type modifié' : 'Type créé', 'Le type de cotisation a été enregistré.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e) => Alert.alert('Erreur', errMsg(e)),
  });

  const error = useMemo(() => {
    if (!name.trim()) return 'Le nom est requis.';
    if (kind === 'in_kind' && (!unitLabel.trim() || !unitValue.trim())) return "L'unité et sa valeur de référence sont requises en nature.";
    if (rateMode === 'fixed' && !fixedRate.trim()) return 'Le montant par part est requis (mode fixe).';
    if (rateMode === 'range') {
      if (!minRate.trim() || !maxRate.trim()) return 'Min et max requis (mode plage).';
      if (Number(minRate) > Number(maxRate)) return 'Le min ne peut dépasser le max.';
    }
    if (pattern === 'individual_savings' && rateMode !== 'free') return "L'épargne individuelle nécessite le mode libre.";
    return null;
  }, [name, kind, unitLabel, unitValue, rateMode, fixedRate, minRate, maxRate, pattern]);

  if (isEdit && typeQ.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.x4 }} />
      </SafeAreaView>
    );
  }

  const accountOptions = [
    { key: '', label: '— Caisse principale (par défaut) —' },
    ...(accountsQ.data ?? []).map((a) => ({ key: a.id, label: a.name })),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <TextField label="Nom *" value={name} onChangeText={setName} placeholder="Ex : Tontine principale" />
          <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Cotisation principale…" multiline />

          {/* Type de cotisation — bloc doré */}
          <View style={styles.goldBox}>
            <Text style={styles.goldTitle}>Type de cotisation</Text>
            <View style={styles.segments}>
              <Pressable onPress={() => setKind('cash')} style={[styles.segment, kind === 'cash' && styles.segmentOn]}>
                <Text style={[styles.segmentText, kind === 'cash' && styles.segmentTextOn]}>🪙 En argent</Text>
              </Pressable>
              <Pressable onPress={() => setKind('in_kind')} style={[styles.segment, kind === 'in_kind' && styles.segmentOn]}>
                <Text style={[styles.segmentText, kind === 'in_kind' && styles.segmentTextOn]}>🌽 En nature</Text>
              </Pressable>
            </View>
            {kind === 'in_kind' ? (
              <View style={styles.row2}>
                <TextField containerStyle={styles.flex} label="Unité *" value={unitLabel} onChangeText={setUnitLabel} placeholder="Sac de riz 25kg" />
                <TextField containerStyle={styles.flex} label="Valeur (XAF) *" value={unitValue} onChangeText={setUnitValue} placeholder="15000" keyboardType="numeric" />
              </View>
            ) : null}
          </View>

          <Text style={styles.label}>Mode de cotisation</Text>
          <Chips
            options={pattern === 'individual_savings' ? RATE_MODES.filter((m) => m.key === 'free') : RATE_MODES}
            value={rateMode}
            onChange={setRateMode}
          />

          {rateMode === 'fixed' ? (
            <TextField label="Montant par part (XAF) *" value={fixedRate} onChangeText={setFixedRate} placeholder="10000" keyboardType="numeric" />
          ) : null}
          {rateMode === 'range' ? (
            <View style={styles.row2}>
              <TextField containerStyle={styles.flex} label="Min (XAF) *" value={minRate} onChangeText={setMinRate} placeholder="5000" keyboardType="numeric" />
              <TextField containerStyle={styles.flex} label="Max (XAF) *" value={maxRate} onChangeText={setMaxRate} placeholder="20000" keyboardType="numeric" />
            </View>
          ) : null}

          <View style={styles.row2}>
            <TextField containerStyle={styles.flex} label="Devise" value={currency} onChangeText={setCurrency} placeholder="XAF" autoCapitalize="characters" />
            <TextField containerStyle={styles.flex} label="Unité (nom local)" value={shareUnitName} onChangeText={setShareUnitName} placeholder="nom" />
          </View>

          <Text style={styles.label}>Caisse physique par défaut (optionnel)</Text>
          <Chips options={accountOptions} value={account} onChange={setAccount} />

          <Pressable style={styles.check} onPress={() => setMultiShares((v) => !v)}>
            <Ionicons name={multiShares ? 'checkbox' : 'square-outline'} size={20} color={multiShares ? colors.primary : colors.textMuted} />
            <Text style={styles.checkLabel}>Permettre plusieurs parts par membre</Text>
          </Pressable>
          {multiShares ? (
            <TextField label="Nombre max de parts / membre" value={maxShares} onChangeText={setMaxShares} placeholder="5" keyboardType="numeric" />
          ) : null}

          {/* Restitution + méthode — bloc vert */}
          <View style={styles.greenBox}>
            <Text style={styles.greenTitle}>Mode de restitution des fonds *</Text>
            <Chips options={PAYOUT_PATTERNS} value={pattern} onChange={onChangePattern} />

            {pattern === 'rotating' ? (
              <>
                <Text style={styles.greenTitle}>Méthode d'attribution par défaut *</Text>
                <Chips options={METHODS} value={method} onChange={setMethod} />
                <Text style={styles.greenHint}>
                  Appliquée par défaut à chaque cycle. Le bureau peut toujours l'overrider au cycle ou à la séance.
                </Text>
              </>
            ) : null}
          </View>

          {error ? <Text style={styles.errText}>{error}</Text> : null}
          <PrimaryButton
            title={isEdit ? 'Enregistrer' : 'Créer le type'}
            onPress={() => saveMut.mutate()}
            loading={saveMut.isPending}
            disabled={!!error}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.x5 },
  card: { borderRadius: radius.lg },
  row2: { flexDirection: 'row', gap: spacing.sm },
  label: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.textMuted },
  chipTextOn: { color: colors.white },

  goldBox: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold.beige, borderRadius: radius.md, padding: spacing.md, marginBottom: 14 },
  goldTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: '#7A5B10', marginBottom: spacing.sm },
  segments: { gap: spacing.sm },
  segment: { alignItems: 'center', paddingVertical: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  segmentOn: { borderColor: colors.primary, backgroundColor: colors.greenBg },
  segmentText: { fontSize: font.size.md, fontWeight: font.semibold, color: colors.textMuted },
  segmentTextOn: { color: colors.primary },

  greenBox: { backgroundColor: colors.greenBg, borderWidth: 1, borderColor: colors.greenBgDeep, borderRadius: radius.md, padding: spacing.md, marginTop: 4, marginBottom: spacing.sm },
  greenTitle: { fontSize: font.size.sm, fontWeight: font.bold, color: colors.primary, marginBottom: spacing.sm },
  greenHint: { fontSize: font.size.xs, color: colors.primary, opacity: 0.8, marginTop: 2 },

  check: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginBottom: 4 },
  checkLabel: { fontSize: font.size.sm, fontWeight: font.semibold, color: colors.text },
  errText: { fontSize: font.size.sm, color: colors.danger, marginTop: 4 },
});
