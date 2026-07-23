// Libellés FR + tonalités pour le moteur d'approbations bureau.
import type { ApprovalActionType, ApprovalStatus } from '../types/approval';
import type { StatusTone } from '../../components/bureau/StatusChip';

export const ACTION_LABELS: Record<string, string> = {
  'loan_repayment.correction': 'Correction de remboursement',
  'sanction.correction': 'Correction de sanction',
  'wallet.manual_adjustment': 'Ajustement de portefeuille',
  'beneficiary_payout.correction': 'Correction de versement',
  'member.expel': 'Exclusion d’un membre',
  'member.suspend': 'Suspension d’un membre',
  'member.transfer_founder': 'Transfert de fondateur',
  'member.designate_bureau': 'Désignation au bureau',
  'loan.approve': 'Approbation de prêt',
  'loan.modify': 'Modification de prêt',
  'loan.write_off': 'Radiation de prêt',
  'treasury.withdraw': 'Retrait de trésorerie',
  'cycle.close': 'Clôture de cycle',
  'session.cancel': 'Annulation de séance',
  'election.validate_results': 'Validation d’élection',
  'contribution.correction': 'Correction de cotisation',
};

export function actionLabel(actionType: ApprovalActionType): string {
  return ACTION_LABELS[actionType] ?? actionType;
}

export const APPROVAL_STATUS: Record<ApprovalStatus, { label: string; tone: StatusTone }> = {
  pending: { label: 'En attente', tone: 'warning' },
  pres_approved: { label: 'Validé président', tone: 'info' },
  bureau_approved: { label: 'Validé bureau', tone: 'info' },
  approved: { label: 'Approuvé', tone: 'success' },
  rejected: { label: 'Rejeté', tone: 'danger' },
  cancelled: { label: 'Annulé', tone: 'muted' },
  expired: { label: 'Expiré', tone: 'muted' },
  failed: { label: 'Échec', tone: 'danger' },
};

export function approvalStatus(status: ApprovalStatus): { label: string; tone: StatusTone } {
  return APPROVAL_STATUS[status] ?? { label: status, tone: 'muted' };
}
