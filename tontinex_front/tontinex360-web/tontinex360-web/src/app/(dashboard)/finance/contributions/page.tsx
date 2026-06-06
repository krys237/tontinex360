"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { financeApi } from "@/lib/api/finance";
import { sessionsApi } from "@/lib/api/sessions";
import { membersApi } from "@/lib/api/members";
import { formatXAF, formatDate, formatContributionAmount, formatInKindEquivalent } from "@/lib/utils/format";
import { ReceiptSigningModal } from "@/components/signature/receipt-signing-modal";
import { CorrectionRequestModal } from "@/components/finance/correction-request-modal";
import type { Contribution } from "@/lib/types/finance";
import { PenLine, FileText, Download, AlertTriangle, Clock } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Payée", color: "bg-emerald-100 text-emerald-700" },
  partial: { label: "Partielle", color: "bg-orange-100 text-orange-700" },
  defaulted: { label: "Impayée", color: "bg-red-100 text-red-700" },
};

export default function ContributionsPage() {
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [signing, setSigning] = useState<Contribution | null>(null);
  const [correcting, setCorrecting] = useState<Contribution | null>(null);
  const [refSigUrl, setRefSigUrl] = useState<string | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => sessionsApi.list(),
  });

  const { data: contributions = [], isLoading } = useQuery({
    queryKey: ["contributions", sessionId, status],
    queryFn: () => financeApi.contributions({
      ...(sessionId ? { session: sessionId } : {}),
      ...(status ? { status } : {}),
    }),
  });

  const totals = contributions.reduce(
    (acc, c) => {
      acc.expected += Number(c.expected_amount ?? 0);
      acc.paid += Number(c.paid_amount ?? 0);
      return acc;
    },
    { expected: 0, paid: 0 },
  );

  const openSigning = async (c: Contribution) => {
    setSigning(c);
    setRefSigUrl(null);
    try {
      const m = await membersApi.get(c.membership);
      setRefSigUrl(m.signature_reference ?? null);
    } catch {
      setRefSigUrl(null);
    }
  };

  return (
    <>
      <Topbar title="Cotisations" />

      {correcting && (
        <CorrectionRequestModal
          contribution={correcting}
          onClose={() => setCorrecting(null)}
          onSubmitted={() => {
            setCorrecting(null);
            qc.invalidateQueries({ queryKey: ["contributions"] });
            qc.invalidateQueries({ queryKey: ["correction-requests"] });
          }}
        />
      )}

      {signing && (
        <ReceiptSigningModal
          subject={{
            title: "Bordereau de cotisation",
            memberName: signing.member_name ?? "Membre",
            amount: Number(signing.paid_amount || signing.expected_amount),
            contextLine: `Cotisation · ${signing.tontine_type}`,
          }}
          referenceSignatureUrl={refSigUrl}
          membershipId={signing.membership}
          signFn={(signature, deviceInfo) =>
            financeApi.signContributionReceipt(signing.id, signature, deviceInfo)
              .then(c => ({
                receipt_number: c.receipt_number,
                receipt_hash: c.receipt_hash,
                receipt_pdf: c.receipt_pdf ?? null,
              }))
          }
          onClose={() => { setSigning(null); setRefSigUrl(null); }}
          onSigned={() => {
            qc.invalidateQueries({ queryKey: ["contributions"] });
          }}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total attendu</p>
          <p className="text-xl font-semibold text-gray-900">{formatXAF(totals.expected)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total payé</p>
          <p className="text-xl font-semibold text-emerald-600">{formatXAF(totals.paid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Reste à percevoir</p>
          <p className="text-xl font-semibold text-red-600">{formatXAF(totals.expected - totals.paid)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select
          value={sessionId}
          onChange={e => setSessionId(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
        >
          <option value="">Toutes les séances</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              Séance n°{s.session_number} · {formatDate(s.date)}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
        >
          <option value="">Tous statuts</option>
          <option value="pending">En attente</option>
          <option value="paid">Payée</option>
          <option value="partial">Partielle</option>
          <option value="defaulted">Impayée</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading && <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>}
        {!isLoading && contributions.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">Aucune cotisation.</p>
        )}
        {contributions.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 font-medium">Membre</th>
                <th className="px-4 py-2 font-medium">Tontine</th>
                <th className="px-4 py-2 font-medium text-right">Attendu</th>
                <th className="px-4 py-2 font-medium text-right">Payé</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium text-right">Bordereau</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contributions.map(c => {
                const st = STATUS[c.status] ?? { label: c.status, color: "bg-gray-100 text-gray-700" };
                const canSign = (c.status === 'paid' || c.status === 'partial') && !c.has_receipt;
                const canCorrect = !c.has_receipt && !c.has_pending_correction;
                const isInKind = c.contribution_kind === 'in_kind';
                const expectedFmt = formatContributionAmount(Number(c.expected_amount), {
                  kind: c.contribution_kind, unitLabel: c.in_kind_unit_label,
                });
                const paidFmt = formatContributionAmount(Number(c.paid_amount), {
                  kind: c.contribution_kind, unitLabel: c.in_kind_unit_label,
                });
                const expectedEq = isInKind
                  ? formatInKindEquivalent(Number(c.expected_amount), c.in_kind_unit_value)
                  : null;
                const paidEq = isInKind
                  ? formatInKindEquivalent(Number(c.paid_amount), c.in_kind_unit_value)
                  : null;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{c.member_name ?? c.membership}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.tontine_type}
                      {isInKind && <span className="ml-1 text-[10px] text-amber-600">🌾</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {expectedFmt}
                      {expectedEq && <div className="text-[10px] text-gray-400">{expectedEq}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">
                      {paidFmt}
                      {paidEq && <div className="text-[10px] text-gray-400">{paidEq}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                      {c.has_pending_correction && (
                        <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          <Clock size={10} /> Correction en cours
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {c.paid_at ? formatDate(c.paid_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        {canCorrect && (
                          <button
                            onClick={() => setCorrecting(c)}
                            className="inline-flex items-center gap-1 px-2 py-1 border border-amber-300 text-amber-700 text-xs rounded-lg hover:bg-amber-50"
                            title="Demander une correction"
                          >
                            <AlertTriangle size={11} /> Corriger
                          </button>
                        )}
                        {c.has_receipt && c.receipt_pdf ? (
                          <a
                            href={c.receipt_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                          >
                            <Download size={12} /> PDF
                          </a>
                        ) : canSign ? (
                          <button
                            onClick={() => openSigning(c)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#43793F] text-white text-xs rounded-lg hover:bg-[#43793F]"
                          >
                            <PenLine size={12} /> Signer
                          </button>
                        ) : !c.has_pending_correction && (
                          <span className="text-xs text-gray-300"><FileText size={12} /></span>
                        )}
                      </div>
                    </td>
                  </tr>
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
