// Libellés FR + tonalités pour cycles / séances / présences / cagnottes.
import type { CycleStatus, SessionStatus, AttendanceStatus } from '../types/cycle';
import type { AcquisitionMethod, PayoutStatus } from '../types/pot';
import type { StatusTone } from '../../components/bureau/StatusChip';

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
