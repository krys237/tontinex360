// Moteur d'approbations bureau — porté du web front (src/lib/api/approvals.ts).
import api, { unwrap, Paginated } from './client';
import type {
  BureauApprovalRequest,
  ApprovalActionType,
  ApprovalPolicy,
  ApprovalPoliciesResponse,
  HandlerInfo,
} from '../types/approval';

export const approvalsApi = {
  list: (params?: { status?: string; action_type?: string; target_model?: string }) =>
    api
      .get<BureauApprovalRequest[] | Paginated<BureauApprovalRequest>>('/approvals/', { params })
      .then((r) => unwrap(r.data)),

  get: (id: string) =>
    api.get<BureauApprovalRequest>(`/approvals/${id}/`).then((r) => r.data),

  handlers: () => api.get<HandlerInfo[]>('/approvals/handlers/').then((r) => r.data),

  request: (
    actionType: ApprovalActionType,
    targetId: string,
    payload: Record<string, any>,
    reason: string,
  ) =>
    api
      .post<BureauApprovalRequest>('/approvals/request/', {
        action_type: actionType,
        target_id: targetId,
        payload,
        reason,
      })
      .then((r) => r.data),

  approve: (id: string) =>
    api.post<BureauApprovalRequest>(`/approvals/${id}/approve/`).then((r) => r.data),

  reject: (id: string, rejectionReason: string) =>
    api
      .post<BureauApprovalRequest>(`/approvals/${id}/reject/`, {
        rejection_reason: rejectionReason,
      })
      .then((r) => r.data),

  cancel: (id: string) =>
    api.post<BureauApprovalRequest>(`/approvals/${id}/cancel/`).then((r) => r.data),

  // Policies (configuration des règles d'approbation par action_type)
  listPolicies: () =>
    api.get<ApprovalPoliciesResponse>('/approvals/policies/').then((r) => r.data),

  updatePolicy: (actionType: string, policy: ApprovalPolicy) =>
    api
      .patch<{ action_type: string; policy: ApprovalPolicy; is_custom: boolean }>(
        `/approvals/policies/${actionType}/`,
        policy,
      )
      .then((r) => r.data),

  resetPolicy: (actionType: string) =>
    api
      .delete<{ action_type: string; policy: ApprovalPolicy; is_custom: boolean }>(
        `/approvals/policies/${actionType}/reset/`,
      )
      .then((r) => r.data),
};
