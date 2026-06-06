"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { governanceApi, type Election } from "@/lib/api/governance";
import { cyclesApi } from "@/lib/api/cycles";
import { sessionsApi } from "@/lib/api/sessions";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatDate } from "@/lib/utils/format";
import { ApprovalRequestModal } from "@/components/approvals/approval-request-modal";
import { Vote, Plus, Loader2, X, BellRing, CheckSquare } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: "Planifiée", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700" },
  completed: { label: "Terminée", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-700" },
};

const METHOD: Record<string, string> = {
  secret: "Vote à bulletin secret",
  open: "Vote à main levée",
  consensus: "Consensus",
  designation: "Désignation par les statuts",
  other: "Autre",
};

export default function ElectionsPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [validatingElection, setValidatingElection] = useState<Election | null>(null);
  const canManage = p.isPresident || p.canAny(['*', 'governance.*']);

  const { data: elections = [], isLoading } = useQuery({
    queryKey: ["elections"],
    queryFn: () => governanceApi.elections(),
  });

  return (
    <>
      <Topbar title="Élections" />

      {canManage && (
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
          >
            <Plus size={14} /> Nouvelle élection
          </button>
        </div>
      )}

      {validatingElection && (
        <ApprovalRequestModal
          title="Valider les résultats de l'élection"
          actionType="election.validate_results"
          targetId={validatingElection.id}
          targetLabel={validatingElection.title}
          contextSummary="Triple validation requise (Président + 2 membres bureau distincts). Les candidats marqués `is_elected=true` deviendront membres du bureau."
          fields={[]}
          onClose={() => setValidatingElection(null)}
          onSubmitted={() => {
            setValidatingElection(null);
            qc.invalidateQueries({ queryKey: ["approvals"] });
            qc.invalidateQueries({ queryKey: ["elections"] });
          }}
        />
      )}

      {showForm && (
        <ElectionForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["elections"] });
          }}
        />
      )}

      <div className="space-y-3">
        {isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
            Chargement…
          </div>
        )}
        {!isLoading && elections.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Vote size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucune élection.</p>
          </div>
        )}
        {elections.map(e => {
          const st = STATUS[e.status] ?? { label: e.status, color: "bg-gray-100 text-gray-700" };
          return (
            <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#F1F8E8] rounded-lg flex items-center justify-center text-[#43793F] shrink-0">
                  <Vote size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link href={`/governance/elections/${e.id}`} className="text-sm font-semibold text-gray-900 hover:underline">
                      {e.title}
                    </Link>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {METHOD[e.method] ?? e.method}
                    {e.date ? ` · ${formatDate(e.date)}` : ""}
                  </p>
                  {e.notes && <p className="text-sm text-gray-600 mt-2">{e.notes}</p>}
                  <Link
                    href={`/governance/elections/${e.id}`}
                    className="inline-flex items-center gap-1 text-xs text-[#43793F] hover:underline mt-2"
                  >
                    Voir les candidats & saisir les résultats →
                  </Link>

                  {canManage && (e.status === 'in_progress' || e.status === 'planned') && (
                    <button
                      onClick={() => setValidatingElection(e)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
                      title="Officialiser les résultats (triple validation)"
                    >
                      <CheckSquare size={12} /> Valider les résultats
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ElectionForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    cycle: "",
    session: "",
    title: "",
    method: "secret" as Election['method'],
    status: "planned" as Election['status'],
    date: "",
    notes: "",
  });
  const [error, setError] = useState("");

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles"],
    queryFn: () => cyclesApi.list(),
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", form.cycle],
    queryFn: () => sessionsApi.list({ cycle: form.cycle }),
    enabled: !!form.cycle,
  });

  const mut = useMutation({
    mutationFn: () => governanceApi.createElection({
      ...form,
      session: form.session || null,
    } as any),
    onSuccess: () => onSaved(),
    onError: (err: any) => {
      const data = err.response?.data;
      const msg = typeof data === "string"
        ? data
        : data?.detail
          || (data ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' ; ') : '')
          || "Erreur";
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Nouvelle élection</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Renouvellement du bureau 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Cycle *</label>
            <select
              value={form.cycle}
              onChange={e => setForm({ ...form, cycle: e.target.value, session: "" })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Choisir un cycle…</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Méthode</label>
              <select
                value={form.method}
                onChange={e => setForm({ ...form, method: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="secret">Bulletin secret</option>
                <option value="open">Main levée</option>
                <option value="consensus">Consensus</option>
                <option value="designation">Désignation</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Séance liée (optionnel)</label>
            <select
              value={form.session}
              onChange={e => setForm({ ...form, session: e.target.value })}
              disabled={!form.cycle}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            >
              <option value="">Aucune</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  Séance n°{s.session_number} · {formatDate(s.date)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes / informations aux membres</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Postes à pourvoir, modalités, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs p-2 rounded-lg flex items-start gap-2">
            <BellRing size={14} className="shrink-0 mt-0.5" />
            <span>Tous les membres actifs seront notifiés de la création de cette élection.</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Annuler</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.title || !form.cycle || !form.date}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            Créer & notifier
          </button>
        </div>
      </div>
    </div>
  );
}
