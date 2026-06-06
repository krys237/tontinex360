"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  memberFeesApi,
  type MembershipFeePayment, type FeeStatus,
} from "@/lib/api/member-fees";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { ApprovalRequestModal } from "@/components/approvals/approval-request-modal";
import { formatXAF, formatDate } from "@/lib/utils/format";
import {
  Coins, PiggyBank, Loader2, X, AlertCircle, CheckCircle2,
  Clock, ShieldOff,
} from "lucide-react";

const STATUS_META: Record<FeeStatus, { label: string; color: string }> = {
  pending: { label: "À payer", color: "bg-amber-100 text-amber-700" },
  partial: { label: "Partiel", color: "bg-blue-100 text-blue-700" },
  paid: { label: "Payé", color: "bg-emerald-100 text-emerald-700" },
  waived: { label: "Exonéré", color: "bg-purple-100 text-purple-700" },
};

interface Props {
  membershipId: string;
}

export function MembershipFeesSection({ membershipId }: Props) {
  const qc = useQueryClient();
  const p = usePermissions();
  const canManage = p.isBureau || p.isPresident || p.canAny(['*', 'members.*']);
  const [recording, setRecording] = useState<MembershipFeePayment | null>(null);
  const [waiving, setWaiving] = useState<MembershipFeePayment | null>(null);

  const { data: fees = [], isLoading } = useQuery({
    queryKey: ["member-fees", membershipId],
    queryFn: () => memberFeesApi.byMembership(membershipId),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <p className="text-sm text-gray-400 text-center">Chargement des frais…</p>
      </div>
    );
  }

  if (fees.length === 0) {
    return null;  // Pas de frais configurés → on n'affiche rien
  }

  return (
    <>
      {recording && (
        <RecordPaymentModal
          fee={recording}
          onClose={() => setRecording(null)}
          onSaved={() => {
            setRecording(null);
            qc.invalidateQueries({ queryKey: ["member-fees", membershipId] });
            qc.invalidateQueries({ queryKey: ["member", membershipId] });
          }}
        />
      )}

      {waiving && (
        <ApprovalRequestModal
          title="Exonérer ce frais"
          actionType="membership_fee.waive"
          targetId={waiving.id}
          targetLabel={`${waiving.fee_type_display} — ${waiving.member_name}`}
          contextSummary={`Restant à payer : ${formatXAF(Number(waiving.remaining_amount))}`}
          fields={[]}
          onClose={() => setWaiving(null)}
          onSubmitted={() => {
            setWaiving(null);
            qc.invalidateQueries({ queryKey: ["approvals"] });
          }}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Coins size={14} className="text-gray-400" /> Frais d'adhésion
        </h3>

        <div className="space-y-3">
          {fees.map(fee => {
            const meta = STATUS_META[fee.status];
            const Icon = fee.fee_type === 'registration' ? Coins : PiggyBank;
            const expected = Number(fee.expected_amount);
            const paid = Number(fee.paid_amount);
            const remaining = Number(fee.remaining_amount);

            return (
              <div key={fee.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {fee.fee_type_display}
                    </span>
                    {fee.cycle_name && (
                      <span className="text-[10px] text-gray-500">
                        ({fee.cycle_name})
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        fee.status === 'paid' || fee.status === 'waived'
                          ? 'bg-emerald-500'
                          : fee.status === 'partial' ? 'bg-blue-500'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${fee.progress_pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {Math.round(fee.progress_pct)}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    {formatXAF(paid)} / {formatXAF(expected)}
                  </span>
                  {remaining > 0 && fee.status !== 'waived' && (
                    <span className="text-red-600 font-medium">
                      Reste {formatXAF(remaining)}
                    </span>
                  )}
                </div>

                {fee.status === 'waived' && fee.waiver_reason && (
                  <p className="text-[10px] text-purple-700 mt-2 italic">
                    Exonération : {fee.waiver_reason}
                    {fee.waived_by_name && ` (par ${fee.waived_by_name})`}
                  </p>
                )}

                {fee.installments && fee.installments.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-700">
                      {fee.installments.length} versement{fee.installments.length > 1 ? 's' : ''}
                    </summary>
                    <ul className="mt-1 space-y-0.5 text-[10px] text-gray-600">
                      {fee.installments.map(i => (
                        <li key={i.id} className="flex items-center gap-1">
                          • {formatDate(i.paid_at)} — {formatXAF(Number(i.amount))}
                          {i.payment_method && <span className="text-gray-400">· {i.payment_method}</span>}
                          {i.recorded_by_name && <span className="text-gray-400">· {i.recorded_by_name}</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {canManage && (fee.status === 'pending' || fee.status === 'partial') && (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setRecording(fee)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-[#43793F] text-white rounded-lg hover:opacity-90"
                    >
                      <CheckCircle2 size={12} /> Enregistrer un versement
                    </button>
                    <button
                      onClick={() => setWaiving(fee)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
                      title="Exonérer (double validation Bureau)"
                    >
                      <ShieldOff size={12} /> Exonérer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Modal d'enregistrement de versement ──────────────────────────

function RecordPaymentModal({
  fee, onClose, onSaved,
}: {
  fee: MembershipFeePayment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const remaining = Number(fee.remaining_amount);
  const [amount, setAmount] = useState<string>(String(remaining));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => memberFeesApi.record(fee.id, {
      amount: Number(amount),
      payment_method: paymentMethod,
      notes: notes.trim(),
    }),
    onSuccess: () => onSaved(),
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.error || "Erreur");
    },
  });

  const parsedAmount = Number(amount);
  const validAmount = parsedAmount > 0 && parsedAmount <= remaining;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">
            Enregistrer un versement
          </h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 text-xs mb-3">
          <p className="text-gray-700"><strong>{fee.fee_type_display}</strong> — {fee.member_name}</p>
          <p className="text-gray-500 mt-1">
            Restant : <strong>{formatXAF(remaining)}</strong> sur {formatXAF(Number(fee.expected_amount))}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-lg mb-3 flex items-start gap-2">
            <AlertCircle size={12} className="mt-0.5" /> {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Montant versé (XAF) *</label>
            <input
              type="number"
              min="0" max={remaining}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {parsedAmount > 0 && parsedAmount === remaining
                ? "✓ Versement final — le frais sera marqué comme PAYÉ"
                : parsedAmount > 0
                  ? `Solde restant après ce versement : ${formatXAF(remaining - parsedAmount)}`
                  : "Saisissez un montant"}
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Mode de paiement</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="cash">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Virement bancaire</option>
              <option value="check">Chèque</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Ex: versement reçu par Orange Money"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => { setError(""); mut.mutate(); }}
            disabled={mut.isPending || !validAmount}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
