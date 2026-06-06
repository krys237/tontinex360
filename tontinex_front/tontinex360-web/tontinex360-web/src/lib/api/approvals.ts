import api from './client';

export type ApprovalStatus =
  | 'pending' | 'pres_approved' | 'bureau_approved'
  | 'approved' | 'rejected' | 'cancelled' | 'expired' | 'failed';

export type ApprovalActionType =
  | 'loan_repayment.correction'
  | 'sanction.correction'
  | 'wallet.manual_adjustment'
  | 'beneficiary_payout.correction'
  | 'member.expel'
  | 'member.suspend'
  | 'member.transfer_founder'
  | 'member.designate_bureau'
  | 'loan.approve'
  | 'loan.modify'
  | 'loan.write_off'
  | 'cycle.close'
  | 'session.cancel'
  | 'election.validate_results'
  | string;

export interface BureauApprovalRequest {
  id: string;
  action_type: ApprovalActionType;
  target_model: string;
  target_id: string;
  requested_by: string;
  requested_by_name: string;
  payload: Record<string, any>;
  original_snapshot: Record<string, any>;
  reason: string;
  summary: string;
  president_approval?: string | null;
  president_approval_name?: string | null;
  president_approval_at?: string | null;
  bureau_approval?: string | null;
  bureau_approval_name?: string | null;
  bureau_approval_at?: string | null;
  bureau_approval_2?: string | null;
  bureau_approval_2_name?: string | null;
  bureau_approval_2_at?: string | null;
  requires_triple: boolean;
  rejected_by?: string | null;
  rejected_by_name?: string | null;
  rejection_reason?: string;
  status: ApprovalStatus;
  applied_at?: string | null;
  expires_at: string;
  is_expired: boolean;
  apply_error?: string;
  side_effects?: Record<string, any>;
  created_at: string;
}

export interface HandlerInfo {
  action_type: string;
  target_model: string;
  human_label: string;
}

export const approvalsApi = {
  list: (params?: { status?: string; action_type?: string; target_model?: string }) =>
    api.get<BureauApprovalRequest[]>('/approvals/', { params }).then(r => r.data),

  get: (id: string) =>
    api.get<BureauApprovalRequest>(`/approvals/${id}/`).then(r => r.data),

  handlers: () =>
    api.get<HandlerInfo[]>('/approvals/handlers/').then(r => r.data),

  request: (
    actionType: ApprovalActionType,
    targetId: string,
    payload: Record<string, any>,
    reason: string,
  ) =>
    api.post<BureauApprovalRequest>('/approvals/request/', {
      action_type: actionType,
      target_id: targetId,
      payload,
      reason,
    }).then(r => r.data),

  approve: (id: string) =>
    api.post<BureauApprovalRequest>(`/approvals/${id}/approve/`).then(r => r.data),

  reject: (id: string, rejectionReason: string) =>
    api.post<BureauApprovalRequest>(`/approvals/${id}/reject/`, {
      rejection_reason: rejectionReason,
    }).then(r => r.data),

  cancel: (id: string) =>
    api.post<BureauApprovalRequest>(`/approvals/${id}/cancel/`).then(r => r.data),
};
