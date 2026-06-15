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
} from '../types/finance';

export const financeApi = {
  // ---------- Contributions ----------
  contributions: (params?: Record<string, string>) =>
    api
      .get<Contribution[] | Paginated<Contribution>>('/finance/contributions/', { params })
      .then((r) => unwrap(r.data)),

  getContribution: (id: string) =>
    api.get<Contribution>(`/finance/contributions/${id}/`).then((r) => r.data),

  createContribution: (data: Partial<Contribution> | FormData) =>
    api.post<Contribution>('/finance/contributions/', data).then((r) => r.data),

  updateContribution: (id: string, data: Partial<Contribution>) =>
    api.patch<Contribution>(`/finance/contributions/${id}/`, data).then((r) => r.data),

  signContributionReceipt: (id: string, signature: string, deviceInfo?: Record<string, any>) =>
    api
      .post<Contribution>(`/finance/contributions/${id}/sign_receipt/`, {
        signature,
        device_info: deviceInfo ?? {},
      })
      .then((r) => r.data),

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
