// Helper réutilisable pour soumettre une action sensible au moteur d'approbations.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalsApi } from '../api/approvals';
import type { ApprovalActionType, BureauApprovalRequest } from '../types/approval';

export interface ApprovalRequestVars {
  action: ApprovalActionType;
  targetId: string;
  payload?: Record<string, any>;
  reason: string;
}

/**
 * Crée une demande d'approbation bureau. Le caller branche onSuccess/onError
 * (ex : naviguer vers le détail de l'approbation créée).
 */
export function useApprovalAction(options?: {
  onSuccess?: (req: BureauApprovalRequest) => void;
  onError?: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: ApprovalRequestVars) =>
      approvalsApi.request(vars.action, vars.targetId, vars.payload ?? {}, vars.reason),
    onSuccess: (req) => {
      qc.invalidateQueries({ queryKey: ['bureau', 'approvals', 'pending'] });
      qc.invalidateQueries({ queryKey: ['bureau', 'approvals'] });
      options?.onSuccess?.(req);
    },
    onError: (e) => options?.onError?.(e),
  });
}
