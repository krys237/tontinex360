// Ported from the web front (src/lib/api/approvals.ts) — moteur d'approbations bureau.

export type ApprovalStatus =
  | 'pending'
  | 'pres_approved'
  | 'bureau_approved'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'failed';

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
  | 'treasury.withdraw'
  | 'cycle.close'
  | 'session.cancel'
  | 'election.validate_results'
  | (string & {});

export type ApprovalDecisionRule = 'unanimous' | 'majority' | 'president_overrides';

export type ApprovalSlot = 'president' | 'bureau';

export interface ApprovalPolicy {
  approvers: ApprovalSlot[];
  decision_rule: ApprovalDecisionRule;
  majority_threshold: number | null;
}

export interface ApprovalVote {
  membership_id: string;
  decision: 'approve' | 'reject';
  role: ApprovalSlot;
  at: string;
  reason?: string;
}

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
  policy_snapshot?: ApprovalPolicy;
  votes?: ApprovalVote[];
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

export interface ApprovalPolicyItem {
  action_type: string;
  label: string;
  category: string;
  policy: ApprovalPolicy;
  is_custom: boolean;
}

export interface ApprovalPoliciesResponse {
  can_modify: boolean;
  items: ApprovalPolicyItem[];
}

export interface HandlerInfo {
  action_type: string;
  target_model: string;
  human_label: string;
}
