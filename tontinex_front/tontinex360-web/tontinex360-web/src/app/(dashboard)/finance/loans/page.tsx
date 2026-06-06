"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { financeApi, type LoanRepayment } from "@/lib/api/finance";
import { membersApi } from "@/lib/api/members";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatXAF, formatDate } from "@/lib/utils/format";
import { ReceiptSigningModal } from "@/components/signature/receipt-signing-modal";
import { ApprovalRequestModal } from "@/components/approvals/approval-request-modal";
import type { Loan } from "@/lib/types/finance";
import type { ApprovalActionType } from "@/lib/api/approvals";
import {
  FileCheck, Plus, Loader2, X, ChevronDown, ChevronRight,
  PenLine, Download, AlertTriangle, CheckCircle2, Edit3, XCircle,
} from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approuvé", color: "bg-blue-100 text-blue-700" },
  disbursed: { label: "Décaissé", color: "bg-purple-100 text-purple-700" },
  repaying: { label: "En remboursement", color: "bg-orange-100 text-orange-700" },
  repaid: { label: "Remboursé", color: "bg-emerald-100 text-emerald-700" },
  defaulted: { label: "Défaut", color: "bg-red-100 text-red-700" },
};

type SigningContext = {
  repayment: LoanRepayment;
  loan: Loan;
};

export default function LoansPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const { currentMembership } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [signing, setSigning] = useState<SigningContext | null>(null);
  const [correcting, setCorrecting] = useState<SigningContext | null>(null);
  const [refSigUrl, setRefSigUrl] = useState<string | null>(null);
  const [loanAction, setLoanAction] = useState<{
    loan: Loan;
    actionType: ApprovalActionType;
    title: string;
    fields: any[];
    contextSummary?: string;
  } | null>(null);

  // Tout membre peut demander un prêt pour lui-même.
  // Le bureau peut en plus créer pour autrui (géré dans LoanRequestForm).
  const canRequest = !!p.membership;
  // Les non-bureau ne voient que leurs propres prêts (confidentialité).
  const canSeeAll = p.isBureau || p.canAny(['finance.*', 'finance.loans', '*']);

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["loans", statusFilter, canSeeAll, currentMembership?.id],
    queryFn: () => financeApi.loans(statusFilter ? { status: statusFilter } : undefined),
    select: (all) =>
      canSeeAll
        ? all
        : all.filter((l) => l.membership === currentMembership?.id),
  });

  const totalLent = loans.reduce((s, l) => s + Number(l.amount ?? 0), 0);
  const totalRepaid = loans.reduce((s, l) => s + Number(l.amount_repaid ?? 0), 0);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openSigning = async (repayment: LoanRepayment, loan: Loan) => {
    setSigning({ repayment, loan });
    setRefSigUrl(null);
    try {
      const m = await membersApi.get(loan.membership);
      setRefSigUrl(m.signature_reference ?? null);
    } catch {
      setRefSigUrl(null);
    }
  };

  return (
    <>
      <Topbar title="Prêts" />

      {loanAction && (
        <ApprovalRequestModal
          title={loanAction.title}
          actionType={loanAction.actionType}
          targetId={loanAction.loan.id}
          targetLabel={loanAction.loan.member_name ?? "Membre"}
          contextSummary={loanAction.contextSummary}
          fields={loanAction.fields}
          onClose={() => setLoanAction(null)}
          onSubmitted={() => {
            setLoanAction(null);
            qc.invalidateQueries({ queryKey: ["approvals"] });
            qc.invalidateQueries({ queryKey: ["loans"] });
          }}
        />
      )}

      {correcting && (
        <ApprovalRequestModal
          title="Corriger un remboursement"
          actionType="loan_repayment.correction"
          targetId={correcting.repayment.id}
          targetLabel={correcting.loan.member_name ?? "Membre"}
          contextSummary={`Montant actuel : ${correcting.repayment.amount} XAF`}
          fields={[
            {
              name: 'new_amount', label: 'Nouveau montant (XAF)',
              type: 'number', required: true, min: 1,
              defaultValue: String(correcting.repayment.amount),
            },
          ]}
          onClose={() => setCorrecting(null)}
          onSubmitted={() => {
            setCorrecting(null);
            qc.invalidateQueries({ queryKey: ["approvals"] });
            qc.invalidateQueries({ queryKey: ["loan-repayments"] });
          }}
        />
      )}

      {signing && (
        <ReceiptSigningModal
          subject={{
            title: "Bordereau de remboursement",
            memberName: signing.loan.member_name ?? "Membre",
            amount: Number(signing.repayment.amount),
            contextLine: `Remboursement prêt · ${formatXAF(Number(signing.loan.amount))} décaissé`,
          }}
          referenceSignatureUrl={refSigUrl}
          membershipId={signing.loan.membership}
          signFn={(signature, deviceInfo) =>
            financeApi.signLoanRepaymentReceipt(signing.repayment.id, signature, deviceInfo)
              .then(r => ({
                receipt_number: r.receipt_number,
                receipt_hash: r.receipt_hash,
                receipt_pdf: r.receipt_pdf ?? null,
              }))
          }
          onClose={() => { setSigning(null); setRefSigUrl(null); }}
          onSigned={() => {
            qc.invalidateQueries({ queryKey: ["loans"] });
            qc.invalidateQueries({ queryKey: ["loan-repayments"] });
          }}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Prêts actifs</p>
          <p className="text-xl font-semibold">{loans.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total prêté</p>
          <p className="text-xl font-semibold text-gray-900">{formatXAF(totalLent)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total remboursé</p>
          <p className="text-xl font-semibold text-emerald-600">{formatXAF(totalRepaid)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
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

        {canRequest && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
          >
            <Plus size={14} /> Demander un prêt
          </button>
        )}
      </div>

      {showForm && (
        <LoanRequestForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["loans"] });
          }}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading && <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>}
        {!isLoading && loans.length === 0 && (
          <div className="p-12 text-center">
            <FileCheck size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun prêt.</p>
          </div>
        )}
        {loans.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-2 py-2 w-8"></th>
                <th className="px-4 py-2 font-medium">Membre</th>
                <th className="px-4 py-2 font-medium text-right">Montant</th>
                <th className="px-4 py-2 font-medium text-right">Taux</th>
                <th className="px-4 py-2 font-medium text-right">Total dû</th>
                <th className="px-4 py-2 font-medium text-right">Remboursé</th>
                <th className="px-4 py-2 font-medium">Échéance</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium text-right">Actions bureau</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.map(l => {
                const st = STATUS[l.status] ?? { label: l.status, color: "bg-gray-100 text-gray-700" };
                const isOpen = expanded.has(l.id);
                return (
                  <RepaymentRows
                    key={l.id}
                    loan={l}
                    isOpen={isOpen}
                    statusLabel={st}
                    onToggle={() => toggleExpand(l.id)}
                    onSignRepayment={(rep) => openSigning(rep, l)}
                    onCorrectRepayment={(rep) => setCorrecting({ repayment: rep, loan: l })}
                    onLoanAction={(cfg) => setLoanAction({ loan: l, ...cfg })}
                  />
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}

function RepaymentRows({
  loan, isOpen, statusLabel, onToggle, onSignRepayment, onCorrectRepayment, onLoanAction,
}: {
  loan: Loan;
  isOpen: boolean;
  statusLabel: { label: string; color: string };
  onToggle: () => void;
  onSignRepayment: (rep: LoanRepayment) => void;
  onCorrectRepayment: (rep: LoanRepayment) => void;
  onLoanAction: (cfg: {
    actionType: ApprovalActionType;
    title: string;
    fields: any[];
    contextSummary?: string;
  }) => void;
}) {
  const { data: repayments = [], isLoading } = useQuery({
    queryKey: ["loan-repayments", loan.id],
    queryFn: () => financeApi.loanRepayments({ loan: loan.id }),
    enabled: isOpen,
  });

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-2 py-3 text-gray-400">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-4 py-3 text-gray-700">{loan.member_name || loan.membership}</td>
        <td className="px-4 py-3 text-right font-medium">{formatXAF(Number(loan.amount))}</td>
        <td className="px-4 py-3 text-right text-gray-600">{Number(loan.interest_rate)}%</td>
        <td className="px-4 py-3 text-right text-gray-700">{formatXAF(Number(loan.total_due))}</td>
        <td className="px-4 py-3 text-right text-emerald-600">{formatXAF(Number(loan.amount_repaid))}</td>
        <td className="px-4 py-3 text-xs text-gray-500">
          {loan.due_date ? formatDate(loan.due_date) : "—"}
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusLabel.color}`}>
            {statusLabel.label}
          </span>
        </td>
        <td
          className="px-4 py-3 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <LoanActionButtons loan={loan} onLoanAction={onLoanAction} />
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={9} className="bg-gray-50 px-6 py-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">Remboursements</p>
            {isLoading && <p className="text-xs text-gray-400">Chargement…</p>}
            {!isLoading && repayments.length === 0 && (
              <p className="text-xs text-gray-400 italic">Aucun remboursement enregistré.</p>
            )}
            {repayments.length > 0 && (
              <div className="space-y-1">
                {repayments.map(rep => (
                  <div key={rep.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs">
                    <span className="text-gray-500 w-24">{formatDate(rep.paid_at)}</span>
                    <span className="font-medium text-gray-900 flex-1">
                      {formatXAF(Number(rep.amount))}
                    </span>
                    <span className="text-gray-500">{rep.payment_method ?? '—'}</span>
                    <div className="w-40 text-right flex items-center justify-end gap-1">
                      {!rep.has_receipt && (
                        <button
                          onClick={() => onCorrectRepayment(rep)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 border border-amber-300 text-amber-700 rounded hover:bg-amber-50"
                          title="Demander une correction (validation bureau)"
                        >
                          <AlertTriangle size={10} /> Corriger
                        </button>
                      )}
                      {rep.has_receipt && rep.receipt_pdf ? (
                        <a
                          href={rep.receipt_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                        >
                          <Download size={11} /> {rep.receipt_number ?? 'PDF'}
                        </a>
                      ) : (
                        <button
                          onClick={() => onSignRepayment(rep)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#43793F] text-white rounded hover:bg-[#43793F]"
                        >
                          <PenLine size={10} /> Signer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function LoanRequestForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { currentMembership } = useAuthStore();
  const p = usePermissions();
  const [form, setForm] = useState({
    membership: currentMembership?.id ?? "",
    amount: "",
    interest_rate: "0",
    due_date: "",
    purpose: "",
  });
  const [error, setError] = useState("");

  const canChooseMember = p.isPresident || p.canAny(['*', 'finance.*', 'finance.loans']);

  const { data: members = [] } = useQuery({
    queryKey: ["members", "active"],
    queryFn: () => membersApi.list({ status: "active" }),
    enabled: canChooseMember,
  });

  const mut = useMutation({
    mutationFn: () => {
      const amount = Number(form.amount);
      const rate = Number(form.interest_rate) / 100;
      const total_due = amount + (amount * rate);
      return financeApi.createLoan({
        membership: form.membership,
        amount,
        interest_rate: Number(form.interest_rate),
        total_due,
        due_date: form.due_date || undefined,
        purpose: form.purpose,
        status: 'pending',
      } as any);
    },
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

  const total = form.amount && form.interest_rate
    ? Number(form.amount) + (Number(form.amount) * Number(form.interest_rate) / 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Demande de prêt</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3">{error}</div>}

        <div className="space-y-3">
          {canChooseMember && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bénéficiaire *</label>
              <select
                value={form.membership}
                onChange={e => setForm({ ...form, membership: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Choisir…</option>
                {currentMembership && (
                  <option value={currentMembership.id}>
                    Moi-même — {currentMembership.user.first_name} {currentMembership.user.last_name}
                  </option>
                )}
                {members.filter(m => m.id !== currentMembership?.id).map(m => (
                  <option key={m.id} value={m.id}>{m.user_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Montant demandé (XAF) *</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              placeholder="100000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Taux d&apos;intérêt (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.interest_rate}
                onChange={e => setForm({ ...form, interest_rate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Échéance</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Motif / objet *</label>
            <textarea
              value={form.purpose}
              onChange={e => setForm({ ...form, purpose: e.target.value })}
              rows={3}
              placeholder="Frais de scolarité, achat équipement, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {total > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
              <p className="text-blue-700">
                Total à rembourser : <strong>{formatXAF(total)}</strong>
                {form.interest_rate && Number(form.interest_rate) > 0 && (
                  <span className="text-blue-600 ml-2">
                    (intérêt : {formatXAF(total - Number(form.amount))})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-4 italic">
          Votre demande sera examinée par le bureau. Vous serez notifié de la décision.
        </p>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Annuler</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.membership || !form.amount || !form.purpose}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            Soumettre la demande
          </button>
        </div>
      </div>
    </div>
  );
}

function LoanActionButtons({
  loan, onLoanAction,
}: {
  loan: Loan;
  onLoanAction: (cfg: {
    actionType: ApprovalActionType;
    title: string;
    fields: any[];
    contextSummary?: string;
  }) => void;
}) {
  const canApprove = loan.status === 'pending';
  const canModify = ['pending', 'approved', 'disbursed'].includes(loan.status);
  const canWriteOff = ['disbursed', 'repaying'].includes(loan.status);

  if (!canApprove && !canModify && !canWriteOff) {
    return <span className="text-xs text-gray-300">—</span>;
  }

  const openApprove = () =>
    onLoanAction({
      actionType: 'loan.approve',
      title: 'Approuver et décaisser le prêt',
      contextSummary: `${formatXAF(Number(loan.amount))} · taux ${Number(loan.interest_rate)}% · total dû ${formatXAF(Number(loan.total_due))}`,
      fields: [],
    });

  const openModify = () =>
    onLoanAction({
      actionType: 'loan.modify',
      title: 'Modifier le prêt',
      contextSummary: `Montant : ${formatXAF(Number(loan.amount))} · taux ${Number(loan.interest_rate)}% · échéance ${loan.due_date ?? '—'}`,
      fields: [
        { name: 'new_amount', label: 'Nouveau montant (XAF)', type: 'number', placeholder: 'Optionnel' },
        { name: 'new_interest_rate', label: 'Nouveau taux (%)', type: 'number', placeholder: 'Optionnel' },
        { name: 'new_due_date', label: 'Nouvelle échéance (YYYY-MM-DD)', type: 'text', placeholder: 'Optionnel' },
      ],
    });

  const openWriteOff = () => {
    const remaining = Number(loan.total_due) - Number(loan.amount_repaid);
    onLoanAction({
      actionType: 'loan.write_off',
      title: 'Radier ce prêt (mise en défaut)',
      contextSummary: `Perte comptable estimée : ${formatXAF(remaining)} XAF`,
      fields: [],
    });
  };

  return (
    <div className="inline-flex items-center gap-1 justify-end">
      {canApprove && (
        <button
          onClick={openApprove}
          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700"
          title="Approuver & décaisser (double validation)"
        >
          <CheckCircle2 size={12} /> Approuver
        </button>
      )}
      {canModify && (
        <button
          onClick={openModify}
          className="inline-flex items-center gap-1 px-2 py-1 border border-blue-300 text-blue-700 text-xs rounded-lg hover:bg-blue-50"
          title="Modifier (double validation)"
        >
          <Edit3 size={12} /> Modifier
        </button>
      )}
      {canWriteOff && (
        <button
          onClick={openWriteOff}
          className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 text-red-700 text-xs rounded-lg hover:bg-red-50"
          title="Radier (double validation)"
        >
          <XCircle size={12} /> Radier
        </button>
      )}
    </div>
  );
}
