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
  TreasuryWithdrawal,
  WithdrawalDebt,
  ContributionCorrectionRequest,
  LoanSettings,
  LoanCapacity,
  LoanCoverage,
  MyGuaranteeItem,
  TontineBalances,
  FundWeights,
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

  updateContribution: (id: string, data: Partial<Contribution> | FormData) => {
    // Accepte un FormData pour re-soumettre une cotisation rejetée avec un
    // nouveau justificatif photo (multipart, comme createContribution).
    const isForm = typeof FormData !== 'undefined' && data instanceof FormData;
    return api
      .patch<Contribution>(`/finance/contributions/${id}/`, data, {
        headers: isForm ? { 'Content-Type': 'multipart/form-data' } : undefined,
      })
      .then((r) => r.data);
  },

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

  /**
   * Demande de correction d'un montant déjà comptabilisé (double validation
   * président + bureau, TTL 24 h). Le serveur ne lit que new_paid_amount +
   * reason ; il ne stocke PAS de fichier sur ce flux — pour un impayé avec
   * preuve, passer par la re-soumission de cotisation (createContribution
   * multipart, recyclage de la ligne DEFAULTED).
   */
  requestContributionCorrection: (
    contributionId: string,
    newPaidAmount: number,
    reason: string,
    proof?: { uri: string; name: string; type: string } | null,
  ) => {
    const url = `/finance/contributions/${contributionId}/request-correction/`;
    if (proof) {
      const form = new FormData();
      form.append('new_paid_amount', String(newPaidAmount));
      form.append('reason', reason);
      form.append('submitted_justification', proof as any);
      return api
        .post<ContributionCorrectionRequest>(url, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    }
    return api
      .post<ContributionCorrectionRequest>(url, { new_paid_amount: newPaidAmount, reason })
      .then((r) => r.data);
  },

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

  /** Prêts du membre courant (tous statuts). */
  myLoans: () =>
    api.get<Loan[] | Paginated<Loan>>('/finance/loans/mine/').then((r) => unwrap(r.data)),

  /** Le membre soumet un remboursement (statut → submitted, awaits bureau).
   *  Preuve photo optionnelle jointe en multipart. */
  repayLoan: (
    loanId: string,
    amount: number | string,
    paymentMethod = 'mobile_money',
    proof?: { uri: string; name: string; type: string } | null,
  ) => {
    const url = `/finance/loans/${loanId}/repay/`;
    if (proof) {
      const form = new FormData();
      form.append('amount', String(amount));
      form.append('payment_method', paymentMethod);
      form.append('submitted_justification', proof as any);
      return api
        .post<LoanRepayment>(url, form, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((r) => r.data);
    }
    return api
      .post<LoanRepayment>(url, { amount, payment_method: paymentMethod })
      .then((r) => r.data);
  },

  /** Bureau : valide un remboursement soumis. */
  validateLoanRepayment: (id: string) =>
    api.post<LoanRepayment>(`/finance/loan-repayments/${id}/validate/`).then((r) => r.data),

  /** Bureau : rejette un remboursement soumis (motif ≥ 5). */
  rejectLoanRepayment: (id: string, reason: string) =>
    api.post<LoanRepayment>(`/finance/loan-repayments/${id}/reject/`, { reason }).then((r) => r.data),

  /** Bureau : file d'attente des remboursements à valider. */
  loanRepaymentsToValidate: () =>
    api
      .get<LoanRepayment[] | Paginated<LoanRepayment>>('/finance/loan-repayments/to-validate/')
      .then((r) => unwrap(r.data)),

  getLoan: (id: string) => api.get<Loan>(`/finance/loans/${id}/`).then((r) => r.data),

  createLoan: (data: Partial<Loan>) =>
    api.post<Loan>('/finance/loans/', data).then((r) => r.data),

  updateLoan: (id: string, data: Partial<Loan>) =>
    api.patch<Loan>(`/finance/loans/${id}/`, data).then((r) => r.data),

  /** Bureau : approuve ET décaisse directement le prêt (remplace l'ancienne
   *  double-validation). `source_fund` = TontineType id du fonds débité,
   *  null/absent = trésorerie générale (découvert autorisé). */
  approveLoan: (
    id: string,
    data?: { source_fund?: string | null; treasury_account?: string | null },
  ) => api.post<Loan>(`/finance/loans/${id}/approve/`, data ?? {}).then((r) => r.data),

  /** Bureau : refuse la demande (pending / contre-offre / attente garants) → annulé. */
  rejectLoan: (id: string, reason?: string) =>
    api.post<Loan>(`/finance/loans/${id}/reject/`, { reason: reason ?? '' }).then((r) => r.data),

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

  /** Poids (apport cumulé + %) de chaque membre dans un fonds — base du
   *  partage des intérêts de prêt. Lecture ouverte à tout membre. */
  fundWeights: (fundId: string, sessionId?: string) =>
    api
      .get<FundWeights>(`/finance/funds/${fundId}/weights/`, {
        params: sessionId ? { session: sessionId } : undefined,
      })
      .then((r) => r.data),

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

  // ---------- Retraits de trésorerie ----------
  withdrawals: (params?: { status?: string }) =>
    api
      .get<TreasuryWithdrawal[] | Paginated<TreasuryWithdrawal>>('/finance/withdrawals/', {
        params: { page_size: '200', ...params },
      })
      .then((r) => unwrap(r.data)),

  /** Bureau : crée le retrait en `pending` (aucun mouvement) — l'application
   *  passe ensuite par approvalsApi.request('treasury.withdraw', id, …). */
  createWithdrawal: (data: {
    source_fund: string | null;
    amount: number;
    reason: string;
    session?: string | null;
    is_repayable: boolean;
  }) => api.post<TreasuryWithdrawal>('/finance/withdrawals/', data).then((r) => r.data),

  /** Parts dues par membre (vide si le retrait n'est pas remboursable). */
  withdrawalDebts: (id: string) =>
    api.get<WithdrawalDebt[]>(`/finance/withdrawals/${id}/debts/`).then((r) => r.data),

  /** Bureau : enregistre le remboursement de la part d'un membre
   *  (plafonné serveur à la dette restante ; recrédite le fonds source). */
  repayWithdrawal: (id: string, data: { membership: string; amount: number; treasury_account?: string }) =>
    api
      .post<{ withdrawal_id: string; membership_id: string; paid: string; remaining: string }>(
        `/finance/withdrawals/${id}/repay/`,
        data,
      )
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
