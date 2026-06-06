"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { financeApi } from "@/lib/api/finance";
import { formatXAF } from "@/lib/utils/format";
import type { Contribution } from "@/lib/types/finance";
import { X, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  contribution: Contribution;
  onClose: () => void;
  onSubmitted: () => void;
}

export function CorrectionRequestModal({ contribution, onClose, onSubmitted }: Props) {
  const [newAmount, setNewAmount] = useState<string>(String(contribution.paid_amount ?? 0));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      financeApi.requestContributionCorrection(
        contribution.id, Number(newAmount), reason.trim(),
      ),
    onSuccess: () => onSubmitted(),
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.error || data?.detail || "Erreur");
    },
  });

  const parsed = Number(newAmount);
  const diff = parsed - Number(contribution.paid_amount ?? 0);
  const projectedStatus = parsed <= 0
    ? 'pending'
    : parsed >= Number(contribution.expected_amount ?? 0) ? 'paid' : 'partial';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Demande de correction
          </h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs p-2 rounded-lg mb-3">
          La correction sera <strong>soumise au Président et à un autre membre du bureau</strong>.
          Elle s'applique automatiquement quand les <strong>2 approbations</strong> sont réunies.
          Délai limite : <strong>24h</strong>.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-3">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 text-xs">
            <p className="text-gray-500">Cotisation de</p>
            <p className="font-semibold text-gray-900">{contribution.member_name}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div>
                <p className="text-gray-500">Attendu</p>
                <p className="font-medium">{formatXAF(Number(contribution.expected_amount))}</p>
              </div>
              <div>
                <p className="text-gray-500">Actuellement payé</p>
                <p className="font-medium">{formatXAF(Number(contribution.paid_amount))}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Nouveau montant payé (XAF) *</label>
            <input
              type="number"
              min="0"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {newAmount !== "" && (
              <p className="text-xs mt-1 text-gray-600">
                Différence : <span className={diff >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {diff >= 0 ? '+' : ''}{formatXAF(diff)}
                </span>
                {' · '}Statut projeté : <strong>{projectedStatus}</strong>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Motif de la correction * <span className="text-gray-400">(min 5 caractères)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Ex: erreur de frappe, membre s'est trompé de tontine, doublon…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => { setError(""); mut.mutate(); }}
            disabled={
              mut.isPending
              || !newAmount
              || reason.trim().length < 5
              || Number(newAmount) === Number(contribution.paid_amount)
            }
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            Soumettre au bureau
          </button>
        </div>
      </div>
    </div>
  );
}
