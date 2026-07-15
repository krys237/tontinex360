// Finance API — porté du web front (src/lib/api/finance.ts).
// Couvre le membre (cotisations/prêts en lecture, demande de prêt) ET le bureau
// (validation, corrections, trésorerie, config des prêts).
import api, { unwrap, Paginated } from './client';
import type {
  Contribution,
  Loan,
  Transaction,
  LoanRepayment,
  TreasuryAccount,
  ContributionCorrectionRequest,
  LoanSettings,
  LoanCapacity,
  LoanCoverage,
  MyGuaranteeItem,
  TontineBalances,
  ArrearsPreview,
} from '../types/finance';

export const financeApi = {
  // ---------- Contributions ----------
  contributions: (params?: Record<string, string>) =>
    api
      .get<Contribution[] | Paginated<Contribution>>('/finance/contributions/', { params })
      .then((r) => unwrap(r.data)),

  getContribution: (id: string) =>
    api.get<Contribution>(`/finance/contributions/${id}/`).then((r) => r.data),

  createContribution: (data: Partial<Contribution> | FormData) => {
    // Quand on joint un justificatif photo, `data` est un FormData : on force le
    // Content-Type multipart (le défaut du client est application/json, qui
    // casserait l'upload — RN ajoute alors lui-même la boundary).
    const isForm = typeof FormData !== 'undefined' && data instanceof FormData;
    return api
      .post<Contribution>('/finance/contributions/', data, {
        headers: isForm ? { 'Content-Type': 'multipart/form-data' } : undefined,
      })
      .then((r) => r.data);
  },

  updateContribution: (id: string, data: Partial<Contribution>) =>
    api.patch<Contribution>(`/finance/contributions/${id}/`, data).then((r) => r.data),

  signContributionReceipt: (id: string, signature: string, deviceInfo?: Record<string, any>) =>
    api
      .post<Contribution>(`/finance/contributions/${id}/sign_receipt/`, {
        signature,
        device_info: deviceInfo ?? {},
      })
      .then((r) => r.data),

  /** Ajoute un paiement complémentaire (sans approbation, plafonné au montant attendu). */
  topUpContribution: (
    id: string,
    data: { amount: number; payment_method?: string; notes?: string; treasury_account?: string },
  ) => api.post<Contribution>(`/finance/contributions/${id}/top-up/`, data).then((r) => r.data),

  /** Aperçu de la ventilation retards + séance courante (sans rien créer). */
  arrearsPreview: (params: { membership: string; session: string; tontine_type: string }) =>
    api.get<ArrearsPreview>('/finance/contributions/arrears-preview/', { params }).then((r) => r.data),

  /** Saisit un paiement et le ventile entre retards + séance courante (pas d'avance). */
  payArrears: (data: {
    membership: string;
    session: string;
    tontine_type: string;
    amount: number;
    payment_method?: string;
    notes?: string;
  }) => api.post('/finance/contributions/pay-arrears/', data).then((r) => r.data),

  /** Trésorier inspecte le justificatif et valide → comptabilisation. */
  validateContribution: (id: string, data?: { notes?: string; treasury_account?: string }) =>
    api
      .post<Contribution>(`/finance/contributions/${id}/validate/`, data ?? {})
      .then((r) => r.data),

  /** Trésorier rejette le justificatif. Le membre est notifié. */
  rejectContribution: (id: string, reason: string) =>
    api
      .post<Contribution>(`/finance/contributions/${id}/reject/`, { reason })
      .then((r) => r.data),

  /** Demande de correction d'un montant déjà comptabilisé (→ double validation). */
  requestContributionCorrection: (contributionId: string, newPaidAmount: number, reason: string) =>
    api
      .post<ContributionCorrectionRequest>(
        `/finance/contributions/${contributionId}/request-correction/`,
        { new_paid_amount: newPaidAmount, reason },
      )
      .then((r) => r.data),

  correctionRequests: (params?: { status?: string; contribution?: string }) =>
    api
      .get<ContributionCorrectionRequest[] | Paginated<ContributionCorrectionRequest>>(
        '/finance/correction-requests/',
        { params },
      )
      .then((r) => unwrap(r.data)),

  approveCorrectionRequest: (id: string) =>
    api
      .post<ContributionCorrectionRequest>(`/finance/correction-requests/${id}/approve/`)
      .then((r) => r.data),

  rejectCorrectionRequest: (id: string, rejectionReason: string) =>
    api
      .post<ContributionCorrectionRequest>(`/finance/correction-requests/${id}/reject/`, {
        rejection_reason: rejectionReason,
      })
      .then((r) => r.data),

  // ---------- Loans ----------
  loans: (params?: Record<string, string>) =>
    api.get<Loan[] | Paginated<Loan>>('/finance/loans/', { params }).then((r) => unwrap(r.data)),

  getLoan: (id: string) => api.get<Loan>(`/finance/loans/${id}/`).then((r) => r.data),

  createLoan: (data: Partial<Loan>) =>
    api.post<Loan>('/finance/loans/', data).then((r) => r.data),

  updateLoan: (id: string, data: Partial<Loan>) =>
    api.patch<Loan>(`/finance/loans/${id}/`, data).then((r) => r.data),

  // Contre-offre & allocation (trésorier)
  counterOfferLoan: (id: string, approvedAmount: number, note?: string) =>
    api
      .post<Loan>(`/finance/loans/${id}/counter-offer/`, {
        approved_amount: approvedAmount,
        note: note ?? '',
      })
      .then((r) => r.data),
  acceptLoanOffer: (id: string) =>
    api.post<Loan>(`/finance/loans/${id}/accept-offer/`).then((r) => r.data),
  declineLoanOffer: (id: string) =>
    api.post<Loan>(`/finance/loans/${id}/decline-offer/`).then((r) => r.data),
  allocateSessionLoans: (
    sessionId: string,
    allocations: { loan: string; approved_amount: number }[],
  ) =>
    api
      .post<Loan[]>('/finance/loans/allocate-session/', { session: sessionId, allocations })
      .then((r) => r.data),

  getLoanCapacity: () =>
    api.get<LoanCapacity>('/finance/loans/capacity/').then((r) => r.data),

  // ---------- Garants ----------
  getLoanCoverage: (membershipId?: string) =>
    api
      .get<LoanCoverage>('/finance/loans/coverage/', { params: membershipId ? { membership: membershipId } : undefined })
      .then((r) => r.data),
  attachGuarantors: (loanId: string, guarantors: string[]) =>
    api.post<Loan>(`/finance/loans/${loanId}/attach-guarantors/`, { guarantors }).then((r) => r.data),
  guarantorAccept: (loanId: string, note?: string) =>
    api.post<Loan>(`/finance/loans/${loanId}/guarantor-accept/`, { note: note ?? '' }).then((r) => r.data),
  guarantorDecline: (loanId: string, note?: string) =>
    api.post<Loan>(`/finance/loans/${loanId}/guarantor-decline/`, { note: note ?? '' }).then((r) => r.data),
  myGuarantees: () =>
    api.get<MyGuaranteeItem[] | Paginated<MyGuaranteeItem>>('/finance/loans/my-guarantees/').then((r) => unwrap(r.data)),

  removeLoanRepayment: (id: string) =>
    api.delete(`/finance/loan-repayments/${id}/`).then((r) => r.data),

  // ---------- Soldes par fonds (par type de cotisation) ----------
  tontineBalances: () =>
    api.get<TontineBalances>('/finance/tontine-balances/').then((r) => r.data),

  // ---------- Loan repayments ----------
  loanRepayments: (params?: { loan?: string; session?: string }) =>
    api
      .get<LoanRepayment[] | Paginated<LoanRepayment>>('/finance/loan-repayments/', { params })
      .then((r) => unwrap(r.data)),
  createLoanRepayment: (data: {
    loan: string;
    session?: string;
    amount: number | string;
    payment_method?: string;
    notes?: string;
  }) => api.post<LoanRepayment>('/finance/loan-repayments/', data).then((r) => r.data),
  signLoanRepaymentReceipt: (id: string, signature: string, deviceInfo?: Record<string, any>) =>
    api
      .post<LoanRepayment>(`/finance/loan-repayments/${id}/sign_receipt/`, {
        signature,
        device_info: deviceInfo ?? {},
      })
      .then((r) => r.data),

  // ---------- Treasury ----------
  treasury: () => api.get<TreasuryAccount[] | Paginated<TreasuryAccount>>('/finance/treasury/').then((r) => unwrap(r.data)),
  createTreasuryAccount: (data: Partial<TreasuryAccount>) =>
    api.post<TreasuryAccount>('/finance/treasury/', data).then((r) => r.data),
  updateTreasuryAccount: (id: string, data: Partial<TreasuryAccount>) =>
    api.patch<TreasuryAccount>(`/finance/treasury/${id}/`, data).then((r) => r.data),

  // ---------- Transactions (lecture seule / audit) ----------
  transactions: (params?: Record<string, string>) =>
    api
      .get<Transaction[] | Paginated<Transaction>>('/finance/transactions/', { params })
      .then((r) => unwrap(r.data)),
  getTransaction: (id: string) =>
    api.get<Transaction>(`/finance/transactions/${id}/`).then((r) => r.data),

  // ---------- Config des prêts (président) ----------
  getLoanSettings: () => api.get<LoanSettings>('/finance/loan-settings/').then((r) => r.data),
  updateLoanSettings: (data: Partial<Omit<LoanSettings, 'can_modify'>>) =>
    api.patch<LoanSettings>('/finance/loan-settings/', data).then((r) => r.data),
};
