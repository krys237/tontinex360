// Libellés FR + tonalités pour cycles / séances / présences / cagnottes.
import type { CycleStatus, SessionStatus, AttendanceStatus, RecurrenceKind } from '../types/cycle';
import type { AcquisitionMethod, PayoutStatus } from '../types/pot';
import type { StatusTone } from '../../components/bureau/StatusChip';

/** Jours de semaine — indices alignés sur le backend (Python `weekday()`). */
export const WEEKDAYS: { key: number; label: string }[] = [
  { key: 0, label: 'Lun' },
  { key: 1, label: 'Mar' },
  { key: 2, label: 'Mer' },
  { key: 3, label: 'Jeu' },
  { key: 4, label: 'Ven' },
  { key: 5, label: 'Sam' },
  { key: 6, label: 'Dim' },
];
export const weekdayLabel = (w: number) => WEEKDAYS.find((d) => d.key === w)?.label ?? String(w);

export const SESSION_FREQUENCIES: { key: string; label: string }[] = [
  { key: 'weekly', label: 'Hebdo' },
  { key: 'biweekly', label: 'Bimensuel' },
  { key: 'monthly', label: 'Mensuel' },
  { key: 'quarterly', label: 'Trimestriel' },
  { key: 'custom', label: 'Personnalisé' },
];

export const RECURRENCE_KIND: Record<RecurrenceKind, string> = {
  none: 'Aucun (séances manuelles)',
  fixed_day_of_month: 'Jour fixe du mois',
  nth_weekday: 'Nième jour de semaine',
  every_weekday: 'Chaque semaine',
  weekly_multiple: 'Plusieurs jours / semaine',
  daily: 'Quotidien',
  custom_dates: 'Dates libres',
};
export const RECURRENCES: { key: RecurrenceKind; label: string }[] = (
  Object.keys(RECURRENCE_KIND) as RecurrenceKind[]
).map((k) => ({ key: k, label: RECURRENCE_KIND[k] }));

export const RECURRENCE_NTH: { key: string; label: string }[] = [
  { key: '1', label: '1er' },
  { key: '2', label: '2e' },
  { key: '3', label: '3e' },
  { key: '4', label: '4e' },
  { key: '5', label: 'Dernier' },
];

export const CYCLE_STATUS: Record<CycleStatus, { label: string; tone: StatusTone }> = {
  draft: { label: 'Brouillon', tone: 'muted' },
  active: { label: 'Actif', tone: 'success' },
  completed: { label: 'Terminé', tone: 'info' },
  cancelled: { label: 'Annulé', tone: 'danger' },
};
export const cycleStatus = (s: CycleStatus) => CYCLE_STATUS[s] ?? { label: s, tone: 'muted' as StatusTone };

export const SESSION_STATUS: Record<SessionStatus, { label: string; tone: StatusTone }> = {
  scheduled: { label: 'Prévue', tone: 'muted' },
  in_progress: { label: 'En cours', tone: 'warning' },
  completed: { label: 'Terminée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'danger' },
  postponed: { label: 'Reportée', tone: 'warning' },
};
export const sessionStatus = (s: SessionStatus) =>
  SESSION_STATUS[s] ?? { label: s, tone: 'muted' as StatusTone };

export const ATTENDANCE: Record<AttendanceStatus, { label: string; tone: StatusTone }> = {
  present: { label: 'Présent', tone: 'success' },
  absent: { label: 'Absent', tone: 'danger' },
  excused: { label: 'Excusé', tone: 'warning' },
  late: { label: 'En retard', tone: 'warning' },
  represented: { label: 'Représenté', tone: 'info' },
};

export const ACQUISITION_METHOD: Record<AcquisitionMethod, string> = {
  random: 'Tirage au sort',
  sequential: 'Ordre séquentiel',
  auction: 'Enchère',
  vote: 'Vote',
  need_based: 'Besoin',
  manual: 'Manuel',
};

export const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  paid: { label: 'Versé', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'muted' },
};
export const payoutStatus = (s: PayoutStatus) =>
  PAYOUT_STATUS[s] ?? { label: s, tone: 'muted' as StatusTone };
