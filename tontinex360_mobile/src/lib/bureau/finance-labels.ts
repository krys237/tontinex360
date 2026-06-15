// Libellés FR + tonalités pour la finance bureau (cotisations & prêts).
import type { ContributionStatus, LoanStatus } from '../types/finance';
import type { StatusTone } from '../../components/bureau/StatusChip';

export const CONTRIBUTION_STATUS: Record<ContributionStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'En attente', tone: 'muted' },
  submitted: { label: 'À valider', tone: 'warning' },
  paid: { label: 'Validée', tone: 'success' },
  partial: { label: 'Partielle', tone: 'warning' },
  rejected: { label: 'Rejetée', tone: 'danger' },
  defaulted: { label: 'Impayée', tone: 'danger' },
};

export function contributionStatus(s: ContributionStatus): { label: string; tone: StatusTone } {
  return CONTRIBUTION_STATUS[s] ?? { label: s, tone: 'muted' };
}

export const LOAN_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  approved: { label: 'Approuvé', tone: 'info' },
  approved_allocated: { label: 'Alloué', tone: 'info' },
  disbursed: { label: 'Décaissé', tone: 'success' },
  repaying: { label: 'En remboursement', tone: 'info' },
  repaid: { label: 'Remboursé', tone: 'success' },
  defaulted: { label: 'En défaut', tone: 'danger' },
};

export function loanStatus(s: LoanStatus | string): { label: string; tone: StatusTone } {
  return LOAN_STATUS[s] ?? { label: String(s), tone: 'muted' };
}
