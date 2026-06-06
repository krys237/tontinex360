"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { sanctionsApi, type Sanction, type SanctionType } from "@/lib/api/sanctions";
import { membersApi } from "@/lib/api/members";
import { sessionsApi } from "@/lib/api/sessions";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatXAF, formatDate } from "@/lib/utils/format";
import { ReceiptSigningModal } from "@/components/signature/receipt-signing-modal";
import { ApprovalRequestModal } from "@/components/approvals/approval-request-modal";
import {
  AlertTriangle, Plus, Edit2, Trash2, Loader2, X, PenLine, Download,
} from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Payée", color: "bg-emerald-100 text-emerald-700" },
  waived: { label: "Graciée", color: "bg-blue-100 text-blue-700" },
  contested: { label: "Contestée", color: "bg-red-100 text-red-700" },
};

export default function SanctionsPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const [tab, setTab] = useState<"sanctions" | "types">("sanctions");
  const [statusFilter, setStatusFilter] = useState("");
  const [showSanctionForm, setShowSanctionForm] = useState(false);
  const [editingSanction, setEditingSanction] = useState<Sanction | null>(null);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState<SanctionType | null>(null);
  const [signing, setSigning] = useState<Sanction | null>(null);
  const [correcting, setCorrecting] = useState<Sanction | null>(null);
  const [refSigUrl, setRefSigUrl] = useState<string | null>(null);

  const canManage = p.isPresident || p.canAny(['*', 'sanctions.*']);

  const openSigning = async (s: Sanction) => {
    setSigning(s);
    setRefSigUrl(null);
    try {
      const m = await membersApi.get(s.membership);
      setRefSigUrl(m.signature_reference ?? null);
    } catch {
      setRefSigUrl(null);
    }
  };

  const { data: sanctions = [], isLoading } = useQuery({
    queryKey: ["sanctions", statusFilter],
    queryFn: () => sanctionsApi.list(statusFilter ? { status: statusFilter } : undefined),
    enabled: tab === "sanctions",
  });

  const { data: types = [] } = useQuery({
    queryKey: ["sanction-types"],
    queryFn: () => sanctionsApi.types(),
  });

  const removeTypeMut = useMutation({
    mutationFn: (id: string) => sanctionsApi.removeType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sanction-types"] }),
  });

  return (
    <>
      <Topbar title="Sanctions" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setTab("sanctions")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              tab === "sanctions" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500"
            }`}
          >
            Sanctions appliquées
          </button>
          <button
            onClick={() => setTab("types")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              tab === "types" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500"
            }`}
          >
            Types de sanction
          </button>
        </div>

        {canManage && tab === "sanctions" && (
          <button
            onClick={() => { setEditingSanction(null); setShowSanctionForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
          >
            <Plus size={14} /> Appliquer une sanction
          </button>
        )}
        {canManage && tab === "types" && (
          <button
            onClick={() => { setEditingType(null); setShowTypeForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
          >
            <Plus size={14} /> Nouveau type
          </button>
        )}
      </div>

      {(showSanctionForm || editingSanction) && (
        <SanctionForm
          types={types}
          sanction={editingSanction}
          onClose={() => { setShowSanctionForm(false); setEditingSanction(null); }}
          onSaved={() => {
            setShowSanctionForm(false);
            setEditingSanction(null);
            qc.invalidateQueries({ queryKey: ["sanctions"] });
          }}
        />
      )}

      {(showTypeForm || editingType) && (
        <SanctionTypeForm
          type={editingType}
          onClose={() => { setShowTypeForm(false); setEditingType(null); }}
          onSaved={() => {
            setShowTypeForm(false);
            setEditingType(null);
            qc.invalidateQueries({ queryKey: ["sanction-types"] });
          }}
        />
      )}

      {correcting && (
        <ApprovalRequestModal
          title="Corriger la sanction"
          actionType="sanction.correction"
          targetId={correcting.id}
          targetLabel={correcting.member_name ?? "Membre"}
          contextSummary={`Sanction actuelle : ${correcting.amount} XAF · statut ${correcting.status}`}
          fields={[
            { name: 'new_amount', label: 'Nouveau montant (XAF)', type: 'number', placeholder: 'Optionnel' },
            { name: 'new_status', label: 'Nouveau statut', type: 'select', options: [
              { value: 'pending', label: 'En attente' },
              { value: 'paid', label: 'Payée' },
              { value: 'waived', label: 'Graciée' },
              { value: 'contested', label: 'Contestée' },
            ] },
          ]}
          onClose={() => setCorrecting(null)}
          onSubmitted={() => {
            setCorrecting(null);
            qc.invalidateQueries({ queryKey: ["approvals"] });
          }}
        />
      )}

      {signing && (
        <ReceiptSigningModal
          subject={{
            title: "Bordereau de sanction",
            memberName: signing.member_name ?? "Membre",
            amount: Number(signing.amount),
            contextLine: `Sanction · ${signing.type_name ?? ''} ${signing.reason ? `— ${signing.reason}` : ''}`,
          }}
          referenceSignatureUrl={refSigUrl}
          membershipId={signing.membership}
          signFn={(signature, deviceInfo) =>
            sanctionsApi.signReceipt(signing.id, signature, deviceInfo)
              .then(s => ({
                receipt_number: s.receipt_number,
                receipt_hash: s.receipt_hash,
                receipt_pdf: s.receipt_pdf ?? null,
              }))
          }
          onClose={() => { setSigning(null); setRefSigUrl(null); }}
          onSigned={() => {
            qc.invalidateQueries({ queryKey: ["sanctions"] });
          }}
        />
      )}

      {tab === "sanctions" && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            >
              <option value="">Tous statuts</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {isLoading && <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>}
            {!isLoading && sanctions.length === 0 && (
              <div className="p-12 text-center">
                <AlertTriangle size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Aucune sanction.</p>
              </div>
            )}
            {sanctions.length > 0 && (
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 font-medium">Membre</th>
                    <th className="px-4 py-2 font-medium">Motif</th>
                    <th className="px-4 py-2 font-medium text-right">Montant</th>
                    <th className="px-4 py-2 font-medium">Statut</th>
                    <th className="px-4 py-2 font-medium">Payée le</th>
                    <th className="px-4 py-2 font-medium text-right">Bordereau</th>
                    {canManage && <th className="px-4 py-2 w-16"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sanctions.map(s => {
                    const st = STATUS[s.status] ?? { label: s.status, color: "bg-gray-100 text-gray-700" };
                    const canSign = s.status === 'paid' && !s.has_receipt;
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{s.member_name ?? s.membership}</td>
                        <td className="px-4 py-3 text-gray-600">{s.reason || "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatXAF(Number(s.amount))}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {s.paid_at ? formatDate(s.paid_at) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.has_receipt && s.receipt_pdf ? (
                            <a
                              href={s.receipt_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                            >
                              <Download size={12} /> {s.receipt_number ?? 'PDF'}
                            </a>
                          ) : canSign ? (
                            <button
                              onClick={() => openSigning(s)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-[#43793F] text-white text-xs rounded-lg hover:bg-[#43793F]"
                            >
                              <PenLine size={12} /> Signer
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {!s.has_receipt && (
                                <button
                                  onClick={() => setCorrecting(s)}
                                  className="p-1 text-amber-600 hover:text-amber-700"
                                  title="Corriger (validation bureau)"
                                >
                                  <AlertTriangle size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => setEditingSanction(s)}
                                className="p-1 text-gray-400 hover:text-[#43793F]"
                                title="Modifier (champs non sensibles)"
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "types" && (
        <div className="grid grid-cols-2 gap-3">
          {types.length === 0 && (
            <p className="col-span-2 p-6 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              Aucun type de sanction.
            </p>
          )}
          {types.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description || "—"}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px]">
                    {t.is_fixed_amount && t.default_amount != null && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Fixe : {formatXAF(Number(t.default_amount))}
                      </span>
                    )}
                    {!t.is_fixed_amount && (t.min_amount || t.max_amount) && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {formatXAF(Number(t.min_amount ?? 0))} → {formatXAF(Number(t.max_amount ?? 0))}
                      </span>
                    )}
                    {t.is_automatic && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Auto</span>
                    )}
                    {!t.is_active && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">Inactif</span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditingType(t)} className="p-1.5 text-gray-400 hover:text-[#43793F]">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Supprimer "${t.name}" ?`)) removeTypeMut.mutate(t.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SanctionForm({ types, sanction, onClose, onSaved }: {
  types: SanctionType[];
  sanction: Sanction | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    sanction_type: sanction?.sanction_type ?? "",
    membership: sanction?.membership ?? "",
    session: sanction?.session ?? "",
    amount: String(sanction?.amount ?? ""),
    reason: sanction?.reason ?? "",
    status: (sanction?.status ?? "pending") as Sanction['status'],
  });
  const [error, setError] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["members", "active"],
    queryFn: () => membersApi.list({ status: "active" }),
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => sessionsApi.list(),
  });

  const mut = useMutation({
    mutationFn: () => {
      const payload: any = {
        ...form,
        amount: Number(form.amount),
        session: form.session || null,
      };
      return sanction
        ? sanctionsApi.update(sanction.id, payload)
        : sanctionsApi.create(payload);
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.detail || "Erreur");
    },
  });

  const onTypeChange = (id: string) => {
    const t = types.find(x => x.id === id);
    setForm(f => ({
      ...f,
      sanction_type: id,
      amount: t?.default_amount != null ? String(t.default_amount) : f.amount,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">
            {sanction ? "Modifier la sanction" : "Appliquer une sanction"}
          </h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type *</label>
            <select
              value={form.sanction_type}
              onChange={e => onTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Choisir…</option>
              {types.filter(t => t.is_active).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Membre *</label>
            <select
              value={form.membership}
              onChange={e => setForm({ ...form, membership: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Choisir…</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.user_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Montant (XAF) *</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Statut</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="pending">En attente</option>
                <option value="paid">Payée</option>
                <option value="waived">Graciée</option>
                <option value="contested">Contestée</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Séance (optionnel)</label>
            <select
              value={form.session ?? ""}
              onChange={e => setForm({ ...form, session: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
            <label className="text-xs text-gray-500 block mb-1">Motif</label>
            <textarea
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Annuler</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.sanction_type || !form.membership || !form.amount}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            {sanction ? 'Enregistrer' : 'Appliquer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SanctionTypeForm({ type, onClose, onSaved }: {
  type: SanctionType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: type?.name ?? "",
    slug: type?.slug ?? "",
    description: type?.description ?? "",
    default_amount: String(type?.default_amount ?? ""),
    min_amount: String(type?.min_amount ?? ""),
    max_amount: String(type?.max_amount ?? ""),
    is_fixed_amount: type?.is_fixed_amount ?? true,
    is_automatic: type?.is_automatic ?? false,
    is_active: type?.is_active ?? true,
  });
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      const payload: any = {
        ...form,
        slug: form.slug || form.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        default_amount: form.default_amount ? Number(form.default_amount) : null,
        min_amount: form.min_amount ? Number(form.min_amount) : null,
        max_amount: form.max_amount ? Number(form.max_amount) : null,
      };
      return type
        ? sanctionsApi.updateType(type.id, payload)
        : sanctionsApi.createType(payload);
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.detail || "Erreur");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">
            {type ? "Modifier le type" : "Nouveau type de sanction"}
          </h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Retard, Absence, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_fixed_amount}
              onChange={e => setForm({ ...form, is_fixed_amount: e.target.checked })}
            />
            <span className="text-sm text-gray-700">Montant fixe</span>
          </label>

          {form.is_fixed_amount ? (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Montant par défaut (XAF)</label>
              <input
                type="number"
                value={form.default_amount}
                onChange={e => setForm({ ...form, default_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Min (XAF)</label>
                <input
                  type="number"
                  value={form.min_amount}
                  onChange={e => setForm({ ...form, min_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Max (XAF)</label>
                <input
                  type="number"
                  value={form.max_amount}
                  onChange={e => setForm({ ...form, max_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_automatic}
              onChange={e => setForm({ ...form, is_automatic: e.target.checked })}
            />
            <span className="text-sm text-gray-700">Application automatique</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
            />
            <span className="text-sm text-gray-700">Actif</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Annuler</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.name}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            {type ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
