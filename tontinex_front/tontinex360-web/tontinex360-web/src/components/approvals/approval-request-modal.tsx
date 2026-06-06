"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { approvalsApi, type ApprovalActionType } from "@/lib/api/approvals";
import { X, Loader2, AlertTriangle } from "lucide-react";

export interface PayloadFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  min?: number;
  defaultValue?: string;
}

interface Props {
  title: string;
  actionType: ApprovalActionType;
  targetId: string;
  targetLabel: string;
  contextSummary?: string;
  fields: PayloadFieldConfig[];
  onClose: () => void;
  onSubmitted: () => void;
}

export function ApprovalRequestModal({
  title, actionType, targetId, targetLabel, contextSummary,
  fields, onClose, onSubmitted,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.name, f.defaultValue ?? ""])),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const setField = (name: string, value: string) =>
    setValues(prev => ({ ...prev, [name]: value }));

  const mut = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {};
      for (const f of fields) {
        const v = values[f.name];
        if (v === "" || v === undefined || v === null) continue;
        payload[f.name] = f.type === 'number' ? Number(v) : v;
      }
      return approvalsApi.request(actionType, targetId, payload, reason.trim());
    },
    onSuccess: () => onSubmitted(),
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.error || data?.detail || "Erreur");
    },
  });

  const canSubmit = () => {
    if (reason.trim().length < 5) return false;
    for (const f of fields) {
      if (f.required && !values[f.name]) return false;
    }
    return true;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            {title}
          </h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs p-2 rounded-lg mb-3">
          Cette opération sera <strong>soumise au Président et à un autre membre du bureau</strong>.
          Elle s'appliquera automatiquement quand les <strong>2 approbations</strong> seront réunies.
          Délai limite : <strong>24h</strong>.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-3">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 text-xs">
            <p className="text-gray-500">Cible</p>
            <p className="font-semibold text-gray-900">{targetLabel}</p>
            {contextSummary && (
              <p className="text-gray-500 mt-1">{contextSummary}</p>
            )}
          </div>

          {fields.map(f => (
            <div key={f.name}>
              <label className="text-xs text-gray-500 block mb-1">
                {f.label}{f.required && ' *'}
              </label>
              {f.type === 'select' ? (
                <select
                  value={values[f.name] ?? ""}
                  onChange={e => setField(f.name, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Choisir…</option>
                  {f.options?.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  value={values[f.name] ?? ""}
                  onChange={e => setField(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              ) : (
                <input
                  type={f.type}
                  min={f.min}
                  value={values[f.name] ?? ""}
                  onChange={e => setField(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              )}
            </div>
          ))}

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Motif de la demande * <span className="text-gray-400">(min 5 caractères)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Pourquoi cette opération est-elle nécessaire ?"
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
            disabled={mut.isPending || !canSubmit()}
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
