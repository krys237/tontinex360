"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { financeApi } from "@/lib/api/finance";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatXAF, formatDate } from "@/lib/utils/format";
import type {
  ContributionCorrectionRequest, CorrectionRequestStatus,
} from "@/lib/types/finance";
import {
  AlertTriangle, Check, X, Clock, Shield, UserCheck,
  Hourglass, CheckCircle2, XCircle, Loader2,
} from "lucide-react";

const STATUS_META: Record<CorrectionRequestStatus, { label: string; color: string; icon: any }> = {
  pending: { label: "Attente bureau", color: "bg-amber-100 text-amber-700", icon: Hourglass },
  pres_approved: { label: "Président OK · attend bureau", color: "bg-blue-100 text-blue-700", icon: Shield },
  bureau_approved: { label: "Bureau OK · attend président", color: "bg-blue-100 text-blue-700", icon: UserCheck },
  approved: { label: "Approuvée et appliquée", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Rejetée", color: "bg-red-100 text-red-700", icon: XCircle },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-600", icon: X },
  expired: { label: "Expirée (24h)", color: "bg-gray-200 text-gray-600", icon: Clock },
};

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirée";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}min`;
}

export default function CorrectionRequestsPage() {
  const qc = useQueryClient();
  const { currentMembership } = useAuthStore();
  const [filter, setFilter] = useState<string>("");
  const [rejecting, setRejecting] = useState<ContributionCorrectionRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["correction-requests", filter],
    queryFn: () => financeApi.correctionRequests(filter ? { status: filter } : undefined),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => financeApi.approveCorrectionRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["correction-requests"] }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => financeApi.cancelCorrectionRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["correction-requests"] }),
  });

  const stats = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, other: 0 };
    requests.forEach(r => {
      if (r.status === 'pending' || r.status === 'pres_approved' || r.status === 'bureau_approved') counts.pending++;
      else if (r.status === 'approved') counts.approved++;
      else if (r.status === 'rejected') counts.rejected++;
      else counts.other++;
    });
    return counts;
  }, [requests]);

  return (
    <>
      <Topbar title="Demandes de correction" />

      {rejecting && (
        <RejectModal
          req={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            qc.invalidateQueries({ queryKey: ["correction-requests"] });
          }}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="En attente" value={stats.pending} color="text-amber-600" />
        <StatCard label="Approuvées" value={stats.approved} color="text-emerald-600" />
        <StatCard label="Rejetées" value={stats.rejected} color="text-red-600" />
        <StatCard label="Autres" value={stats.other} color="text-gray-500" />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <div className="p-12 text-center text-sm text-gray-400 bg-white border border-gray-200 rounded-xl">
            Chargement…
          </div>
        )}
        {!isLoading && requests.length === 0 && (
          <div className="p-12 text-center text-sm text-gray-400 bg-white border border-gray-200 rounded-xl">
            Aucune demande de correction.
          </div>
        )}

        {requests.map(req => (
          <CorrectionCard
            key={req.id}
            req={req}
            currentMembershipId={currentMembership?.id}
            isApproving={approveMut.isPending && approveMut.variables === req.id}
            isCancelling={cancelMut.isPending && cancelMut.variables === req.id}
            onApprove={() => approveMut.mutate(req.id)}
            onReject={() => setRejecting(req)}
            onCancel={() => cancelMut.mutate(req.id)}
          />
        ))}
      </div>
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function CorrectionCard({
  req, currentMembershipId,
  isApproving, isCancelling,
  onApprove, onReject, onCancel,
}: {
  req: ContributionCorrectionRequest;
  currentMembershipId?: string;
  isApproving: boolean;
  isCancelling: boolean;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const meta = STATUS_META[req.status];
  const Icon = meta.icon;
  const isOpen = ['pending', 'pres_approved', 'bureau_approved'].includes(req.status);
  const isRequester = currentMembershipId === req.requested_by;
  const canApprove = isOpen && !isRequester && !req.is_expired;
  const diff = Number(req.new_paid_amount) - Number(req.original_paid_amount);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
              <Icon size={10} /> {meta.label}
            </span>
            {isOpen && !req.is_expired && (
              <span className="text-[10px] text-gray-500">
                ⏱ {timeLeft(req.expires_at)} restant
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-gray-900">
            Correction cotisation de {req.member_name}
            {req.tontine_type_name ? ` — ${req.tontine_type_name}` : ''}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Demandée par <strong>{req.requested_by_name}</strong> · {formatDate(req.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-500">Montant actuel</p>
          <p className="font-medium">{formatXAF(Number(req.original_paid_amount))}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-2">
          <p className="text-amber-700">Nouveau montant</p>
          <p className="font-semibold">{formatXAF(Number(req.new_paid_amount))}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-500">Différence</p>
          <p className={`font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {diff >= 0 ? '+' : ''}{formatXAF(diff)}
          </p>
        </div>
      </div>

      <div className="mt-3 bg-gray-50 rounded-lg p-2 text-xs text-gray-700">
        <p className="text-gray-500 mb-0.5">Motif</p>
        {req.reason}
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ApprovalSlot
          icon={Shield}
          label="Président"
          approverName={req.president_approval_name}
          approvedAt={req.president_approval_at}
        />
        <ApprovalSlot
          icon={UserCheck}
          label="Autre bureau"
          approverName={req.bureau_approval_name}
          approvedAt={req.bureau_approval_at}
        />
      </div>

      {req.status === 'rejected' && req.rejection_reason && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-lg">
          <strong>Rejetée</strong> par {req.rejected_by_name} : {req.rejection_reason}
        </div>
      )}

      {canApprove && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
          >
            <X size={12} /> Rejeter
          </button>
          <button
            onClick={onApprove}
            disabled={isApproving}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {isApproving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Approuver
          </button>
        </div>
      )}

      {isOpen && isRequester && !req.is_expired && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isCancelling}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50"
          >
            {isCancelling ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            Annuler ma demande
          </button>
        </div>
      )}
    </div>
  );
}

function ApprovalSlot({
  icon: Icon, label, approverName, approvedAt,
}: {
  icon: any; label: string; approverName?: string | null; approvedAt?: string | null;
}) {
  const done = !!approverName;
  return (
    <div className={`rounded-lg border p-2 text-xs ${
      done ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className={`flex items-center gap-1 ${done ? 'text-emerald-700' : 'text-gray-500'}`}>
        <Icon size={11} /> {label}
      </div>
      {done ? (
        <p className="mt-0.5 font-medium text-gray-900">
          ✓ {approverName}
          {approvedAt && (
            <span className="text-[10px] font-normal text-gray-500 ml-1">
              · {formatDate(approvedAt)}
            </span>
          )}
        </p>
      ) : (
        <p className="mt-0.5 text-gray-400">En attente</p>
      )}
    </div>
  );
}

function RejectModal({
  req, onClose, onDone,
}: {
  req: ContributionCorrectionRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => financeApi.rejectCorrectionRequest(req.id, reason.trim()),
    onSuccess: () => onDone(),
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === 'string' ? data : data?.error || "Erreur");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            Rejeter la demande
          </h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3">{error}</div>
        )}

        <div className="text-xs text-gray-600 mb-3">
          Vous rejetez la correction de la cotisation de <strong>{req.member_name}</strong>.
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Motif du rejet * <span className="text-gray-400">(min 5 caractères)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Ex: montant initial correct, manque de pièces justificatives…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => { setError(""); mut.mutate(); }}
            disabled={mut.isPending || reason.trim().length < 5}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            Rejeter
          </button>
        </div>
      </div>
    </div>
  );
}
