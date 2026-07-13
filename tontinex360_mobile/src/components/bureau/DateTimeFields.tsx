import React from 'react';
import { ViewStyle } from 'react-native';
import TextField from '../ui/TextField';

/**
 * Champs de saisie date/heure masqués : l'utilisateur tape uniquement des
 * chiffres, les séparateurs (-, :, espace) sont insérés automatiquement.
 * Un contrôle de validité affiche une erreur en cas de valeur impossible.
 */

// ── Masques (insertion auto des séparateurs) ────────────────────────────
export function maskDate(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8);
  let out = d.slice(0, 4);
  if (d.length > 4) out += '-' + d.slice(4, 6);
  if (d.length > 6) out += '-' + d.slice(6, 8);
  return out;
}

export function maskTime(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 4);
  let out = d.slice(0, 2);
  if (d.length > 2) out += ':' + d.slice(2, 4);
  return out;
}

export function maskDateTime(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 12);
  let out = d.slice(0, 4);
  if (d.length > 4) out += '-' + d.slice(4, 6);
  if (d.length > 6) out += '-' + d.slice(6, 8);
  if (d.length > 8) out += ' ' + d.slice(8, 10);
  if (d.length > 10) out += ':' + d.slice(10, 12);
  return out;
}

// ── Validateurs ─────────────────────────────────────────────────────────
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function isValidTime(s: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const [h, mn] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && mn >= 0 && mn <= 59;
}

export function isValidDateTime(s: string): boolean {
  const [datePart, timePart] = s.split(' ');
  return isValidDate(datePart ?? '') && isValidTime(timePart ?? '');
}

type FieldProps = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  containerStyle?: ViewStyle;
  helper?: string;
};

export function DateField({ label, value, onChangeText, containerStyle, helper }: FieldProps) {
  const invalid = value.length === 10 && !isValidDate(value);
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(t) => onChangeText(maskDate(t))}
      placeholder="AAAA-MM-JJ"
      keyboardType="number-pad"
      maxLength={10}
      autoCapitalize="none"
      containerStyle={containerStyle}
      error={invalid ? 'Date invalide' : undefined}
      helper={helper}
    />
  );
}

export function TimeField({ label, value, onChangeText, containerStyle, helper }: FieldProps) {
  const invalid = value.length === 5 && !isValidTime(value);
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(t) => onChangeText(maskTime(t))}
      placeholder="HH:MM"
      keyboardType="number-pad"
      maxLength={5}
      autoCapitalize="none"
      containerStyle={containerStyle}
      error={invalid ? 'Heure invalide' : undefined}
      helper={helper}
    />
  );
}

export function DateTimeField({ label, value, onChangeText, containerStyle, helper }: FieldProps) {
  const invalid = value.length === 16 && !isValidDateTime(value);
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(t) => onChangeText(maskDateTime(t))}
      placeholder="AAAA-MM-JJ HH:MM"
      keyboardType="number-pad"
      maxLength={16}
      autoCapitalize="none"
      containerStyle={containerStyle}
      error={invalid ? 'Date/heure invalide' : undefined}
      helper={helper}
    />
  );
}
