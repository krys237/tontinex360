import api from './client';
import type {
  Contribution, Loan, TreasuryAccount, Transaction,
  ContributionCorrectionRequest,
} from '@/lib/types/finance';

export interface LoanRepayment {
  id: string;
  loan: string;
  session?: string | null;
  amount: number | string;
  paid_at: string;
  payment_method?: string;
  notes?: string;
  receipt_number?: string;
  receipt_pdf?: string | null;
  receipt_hash?: string;
  receipt_signed_at?: string | null;
  has_receipt?: boolean;
}

export const financeApi = {
  // Contributions
  contributions: (params?: Record<string, string>) =>
    api.get<Contribution[]>('/finance/contributions/', { params }).then(r => r.data),
  getContribution: (id: string) =>
    api.get<Contribution>(`/finance/contributions/${id}/`).then(r => r.data),
  createContribution: (data: Partial<Contribution> | FormData) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.post<Contribution>(
      '/finance/contributions/',
      data,
      isFormData ? { headers: { 'Content-Type': undefined as any } } : undefined,
    ).then(r => r.data);
  },
  updateContribution: (id: string, data: Partial<Contribution>) =>
    api.patch<Contribution>(`/finance/contributions/${id}/`, data).then(r => r.data),

  signContributionReceipt: (id: string, signature: string, deviceInfo?: Record<string, any>) =>
    api.post<Contribution>(`/finance/contributions/${id}/sign_receipt/`, {
      signature, device_info: deviceInfo ?? {},
    }).then(r => r.data),

  // Demandes de correction de cotisation (double validation)
  requestContributionCorrection: (
    contributionId: string,
    newPaidAmount: number,
    reason: string,
  ) =>
    api.post<ContributionCorrectionRequest>(
      `/finance/contributions/${contributionId}/request-correction/`,
      { new_paid_amount: newPaidAmount, reason },
    ).then(r => r.data),

  correctionRequests: (params?: { status?: string; contribution?: string }) =>
    api.get<ContributionCorrectionRequest[]>('/finance/correction-requests/', { params })
      .then(r => r.data),

  approveCorrectionRequest: (id: string) =>
    api.post<ContributionCorrectionRequest>(`/finance/correction-requests/${id}/approve/`)
      .then(r => r.data),

  rejectCorrectionRequest: (id: string, rejectionReason: string) =>
    api.post<ContributionCorrectionRequest>(
      `/finance/correction-requests/${id}/reject/`,
      { rejection_reason: rejectionReason },
    ).then(r => r.data),

  cancelCorrectionRequest: (id: string) =>
    api.post<ContributionCorrectionRequest>(`/finance/correction-requests/${id}/cancel/`)
      .then(r => r.data),

  signLoanRepaymentReceipt: (id: string, signature: string, deviceInfo?: Record<string, any>) =>
    api.post<LoanRepayment>(`/finance/loan-repayments/${id}/sign_receipt/`, {
      signature, device_info: deviceInfo ?? {},
    }).then(r => r.data),

  // Loans
  loans: (params?: Record<string, string>) =>
    api.get<Loan[]>('/finance/loans/', { params }).then(r => r.data),
  getLoan: (id: string) =>
    api.get<Loan>(`/finance/loans/${id}/`).then(r => r.data),
  createLoan: (data: Partial<Loan>) =>
    api.post<Loan>('/finance/loans/', data).then(r => r.data),
  updateLoan: (id: string, data: Partial<Loan>) =>
    api.patch<Loan>(`/finance/loans/${id}/`, data).then(r => r.data),

  // Loan repayments
  loanRepayments: (params?: { loan?: string; session?: string }) =>
    api.get<LoanRepayment[]>('/finance/loan-repayments/', { params }).then(r => r.data),
  createLoanRepayment: (data: {
    loan: string; session?: string; amount: number | string;
    payment_method?: string; notes?: string;
  }) => api.post<LoanRepayment>('/finance/loan-repayments/', data).then(r => r.data),

  // Treasury accounts
  treasury: () =>
    api.get<TreasuryAccount[]>('/finance/treasury/').then(r => r.data),
  createTreasuryAccount: (data: Partial<TreasuryAccount>) =>
    api.post<TreasuryAccount>('/finance/treasury/', data).then(r => r.data),
  updateTreasuryAccount: (id: string, data: Partial<TreasuryAccount>) =>
    api.patch<TreasuryAccount>(`/finance/treasury/${id}/`, data).then(r => r.data),

  // Transactions (lecture seule)
  transactions: (params?: Record<string, string>) =>
    api.get<Transaction[]>('/finance/transactions/', { params }).then(r => r.data),

  // Soldes par fonds virtuel (par type de cotisation)
  tontineBalances: () =>
    api.get<{
      funds: Array<{
        tontine_type_id: string;
        name: string;
        slug: string;
        currency: string;
        credits: number | string;
        debits: number | string;
        balance: number | string;
      }>;
      unassigned: { name: string; balance: number | string };
      total: number | string;
    }>('/finance/tontine-balances/').then(r => r.data),

  tontineBalanceDetail: (tontineTypeId: string) =>
    api.get<{
      tontine_type: { id: string; name: string; slug: string; currency: string };
      balance: number | string;
      transactions: Transaction[];
    }>(`/finance/tontine-balances/${tontineTypeId}/`).then(r => r.data),
};
