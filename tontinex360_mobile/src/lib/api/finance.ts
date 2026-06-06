// Ported from web front (src/lib/api/finance.ts) — member-relevant subset.
import api, { unwrap, Paginated } from './client';
import type { Contribution, Loan, Transaction } from '../types/finance';

export const financeApi = {
  // Contributions
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

  // Loans
  loans: (params?: Record<string, string>) =>
    api.get<Loan[] | Paginated<Loan>>('/finance/loans/', { params }).then((r) => unwrap(r.data)),

  getLoan: (id: string) => api.get<Loan>(`/finance/loans/${id}/`).then((r) => r.data),

  createLoan: (data: Partial<Loan>) =>
    api.post<Loan>('/finance/loans/', data).then((r) => r.data),

  // Transactions (read-only ledger)
  transactions: (params?: Record<string, string>) =>
    api
      .get<Transaction[] | Paginated<Transaction>>('/finance/transactions/', { params })
      .then((r) => unwrap(r.data)),
};
