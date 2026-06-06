"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { approvalsApi, type BureauApprovalRequest, type ApprovalStatus } from "@/lib/api/approvals";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDate } from "@/lib/utils/format";
import {
  AlertTriangle, Check, X, Clock, Shield, UserCheck,
  Hourglass, CheckCircle2, XCircle, Loader2, AlertOctagon,
} from "lucide-react";

const STATUS_META: Record<ApprovalStatus, { label: string; color: string; icon: any }> = {
  pending: { label: "Attente bureau", color: "bg-amber-100 text-amber-700", icon: Hourglass },
  pres_approved: { label: "Président OK · attend bureau", color: "bg-blue-100 text-blue-700", icon: Shield },
  bureau_approved: { label: "Bureau OK · attend président", color: "bg-blue-100 text-blue-700", icon: UserCheck },
  approved: { label: "Approuvée et appliquée", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Rejetée", color: "bg-red-100 text-red-700", icon: XCircle },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-600", icon: X },
  expired: { label: "Expirée (24h)", color: "bg-gray-200 text-gray-600", icon: Clock },
  failed: { label: "Échec d'application", color: "bg-red-100 text-red-700", icon: AlertOctagon },
};

const ACTION_LABEL: Record<string, string> = {
  'loan_repayment.correction': 'Correction remboursement prêt',
  'sanction.correction': 'Correction sanction',
  'wallet.manual_adjustment': 'Ajustement manuel wallet',
  'beneficiary_payout.correction': 'Correction versement bénéficiaire',
  'member.expel': 'Expulsion d\'un membre',
  'member.suspend': 'Suspension / levée de suspension',
  'member.transfer_founder': 'Transfert du statut de fondateur',
  'member.designate_bureau': 'Désignation / révocation bureau (hors élection)',
  'loan.approve': 'Approbation et décaissement d\'un prêt',
  'loan.modify': 'Modification d\'un prêt',
  'loan.write_off': 'Radiation / mise en défaut d\'un prêt',
  'cycle.close': 'Clôture d\'un cycle (triple validation)',
  'session.cancel': 'Annulation d\'une séance (triple validation)',
  'election.validate_results': 'Validation des résultats d\'élection (triple validation)',
};

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirée";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}min`;
}

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { currentMembership } = useAuthStore();
  const [filter, setFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [rejecting, setRejecting] = useState<BureauApprovalRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["approvals", filter, actionFilter],
    queryFn: () => approvalsApi.list({
      ...(filter ? { status: filter } : {}),
      ...(actionFilter ? { action_type: actionFilter } : {}),
    }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals"] }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => approvalsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approvals"] }),
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
      <Topbar title="Approbations du bureau" />

      {rejecting && (
        <RejectModal
          req={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            qc.invalidateQueries({ queryKey: ["approvals"] });
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
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          <option value="">Toutes opérations</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
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
            Aucune demande d'approbation.
          </div>
        )}

        {requests.map(req => (
          <ApprovalCard
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

function ApprovalCard({
  req, currentMembershipId,
  isApproving, isCancelling,
  onApprove, onReject, onCancel,
}: {
  req: BureauApprovalRequest;
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
  const actionLabel = ACTION_LABEL[req.action_type] ?? req.action_type;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
              <Icon size={10} /> {meta.label}
            </span>
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {actionLabel}
            </span>
            {isOpen && !req.is_expired && (
              <span className="text-[10px] text-gray-500">
                ⏱ {timeLeft(req.expires_at)} restant
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-gray-900">{req.summary}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Demandée par <strong>{req.requested_by_name}</strong> · {formatDate(req.created_at)}
          </p>
        </div>
      </div>

      {/* Payload + snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-gray-500 mb-1">État actuel</p>
          <KVList obj={req.original_snapshot} />
        </div>
        <div className="bg-amber-50 rounded-lg p-2">
          <p className="text-amber-700 mb-1">Changement proposé</p>
          <KVList obj={req.payload} />
        </div>
      </div>

      <div className="mt-3 bg-gray-50 rounded-lg p-2 text-xs text-gray-700">
        <p className="text-gray-500 mb-0.5">Motif</p>
        {req.reason}
      </div>

      <div className={`mt-3 grid gap-2 ${req.requires_triple ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <ApprovalSlot
          icon={Shield}
          label="Président"
          approverName={req.president_approval_name}
          approvedAt={req.president_approval_at}
        />
        <ApprovalSlot
          icon={UserCheck}
          label={req.requires_triple ? "Bureau 1" : "Autre bureau"}
          approverName={req.bureau_approval_name}
          approvedAt={req.bureau_approval_at}
        />
        {req.requires_triple && (
          <ApprovalSlot
            icon={UserCheck}
            label="Bureau 2"
            approverName={req.bureau_approval_2_name}
            approvedAt={req.bureau_approval_2_at}
          />
        )}
      </div>

      {req.requires_triple && (
        <div className="mt-2 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1 inline-flex items-center gap-1">
          <Shield size={10} /> Triple validation requise (Président + 2 bureaux distincts)
        </div>
      )}

      {req.status === 'rejected' && req.rejection_reason && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-lg">
          <strong>Rejetée</strong> par {req.rejected_by_name} : {req.rejection_reason}
        </div>
      )}

      {req.status === 'failed' && req.apply_error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-lg">
          <strong>Échec d'application :</strong> {req.apply_error}
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

function KVList({ obj }: { obj: Record<string, any> }) {
  const entries = Object.entries(obj ?? {});
  if (entries.length === 0) return <p className="text-gray-400 italic">—</p>;
  return (
    <div className="space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-2">
          <span className="text-gray-500 text-[10px]">{k}:</span>
          <span className="font-medium text-gray-800">{String(v)}</span>
        </div>
      ))}
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
  req: BureauApprovalRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => approvalsApi.reject(req.id, reason.trim()),
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

        <div className="text-xs text-gray-600 mb-3">{req.summary}</div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Motif du rejet * <span className="text-gray-400">(min 5 caractères)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Ex: incohérence détectée, doublon, manque de pièce justificative…"
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
