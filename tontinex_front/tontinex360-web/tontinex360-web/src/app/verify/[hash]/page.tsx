"use client";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { formatXAF, formatDate } from "@/lib/utils/format";
import {
  ShieldCheck, ShieldAlert, FileText, Download,
  Building2, User, Calendar, Loader2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tontine-project.onrender.com/api';

const KIND_LABEL: Record<string, string> = {
  payout: "Versement bénéficiaire",
  contribution: "Cotisation",
  loan_repayment: "Remboursement de prêt",
  sanction: "Sanction",
};

export default function VerifyReceiptPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["receipt-verify", hash],
    queryFn: async () => {
      // Endpoint public — pas besoin de token
      const r = await axios.get(`${API_URL}/receipts/verify/${hash}/`);
      return r.data as any;
    },
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 max-w-xl w-full overflow-hidden shadow-sm">
        {/* En-tête coloré */}
        <div className="bg-[#43793F] text-white px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold">TontineX360</h1>
              <p className="text-xs opacity-90">Vérification de bordereau</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoading && (
            <div className="text-center py-8">
              <Loader2 size={28} className="text-gray-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Vérification en cours…</p>
            </div>
          )}

          {isError && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                <ShieldAlert size={24} className="text-red-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Bordereau introuvable
              </h2>
              <p className="text-sm text-gray-500">
                Aucun bordereau ne correspond à ce hash de vérification.
                {' '}Le document a peut-être été modifié, supprimé, ou n'est pas authentique.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4 text-left">
                <p className="text-[10px] text-red-700 font-mono break-all">
                  Hash : {hash}
                </p>
              </div>
            </div>
          )}

          {data && data.is_valid && (
            <>
              {/* État authentique */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-5 flex items-start gap-2">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    Bordereau authentique
                  </p>
                  <p className="text-xs text-emerald-600">
                    L'intégrité de ce document a été vérifiée par hash SHA-256.
                  </p>
                </div>
              </div>

              {/* Type et numéro */}
              <div className="mb-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                  {KIND_LABEL[data.type] ?? data.type}
                </p>
                <p className="text-xl font-bold text-gray-900">
                  N° {data.receipt_number}
                </p>
              </div>

              {/* Association */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                  <Building2 size={12} /> Association
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {data.association.name}
                </p>
                <p className="text-xs text-gray-500">
                  {data.association.city}{data.association.country ? `, ${data.association.country}` : ''}
                </p>
              </div>

              {/* Bénéficiaire / Membre */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                  <User size={12} /> {data.type === 'payout' ? 'Bénéficiaire' : 'Membre'}
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {data.beneficiary.name}
                </p>
                <p className="text-xs text-gray-500">
                  N° membre : {data.beneficiary.member_number}
                </p>
              </div>

              {/* Montant */}
              <div className="bg-[#F1F8E8] rounded-lg p-4 mb-4 text-center">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Montant</p>
                <p className="text-3xl font-bold text-[#43793F]">
                  {formatXAF(Number(data.amount))}
                </p>
              </div>

              {/* Détails contextuels */}
              <div className="border-t border-gray-100 pt-4 mb-4 space-y-1.5">
                {data.tontine_name && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Tontine</span>
                    <span className="text-gray-900 font-medium">{data.tontine_name}</span>
                  </div>
                )}
                {data.session_number != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Séance</span>
                    <span className="text-gray-900 font-medium">
                      n°{data.session_number}{data.session_date ? ` · ${formatDate(data.session_date)}` : ''}
                    </span>
                  </div>
                )}
                {data.method && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Méthode</span>
                    <span className="text-gray-900 font-medium">{data.method}</span>
                  </div>
                )}
                {data.reason && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Motif</span>
                    <span className="text-gray-900 font-medium">{data.reason}</span>
                  </div>
                )}
                {data.signed_at && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Calendar size={11} /> Signé le
                    </span>
                    <span className="text-gray-900 font-medium">
                      {new Date(data.signed_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                )}
              </div>

              {/* Hash */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-[10px] text-gray-500 mb-1">Hash d'intégrité SHA-256</p>
                <p className="font-mono text-[10px] text-gray-700 break-all">
                  {data.receipt_hash}
                </p>
              </div>

              {/* Lien PDF */}
              {data.pdf_url && (
                <a
                  href={data.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
                >
                  <Download size={14} /> Télécharger le bordereau PDF
                </a>
              )}
            </>
          )}

          {data && !data.is_valid && (
            <div className="text-center py-4">
              <ShieldAlert size={28} className="text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {data.error ?? "Ce bordereau n'est pas valide ou n'est pas finalisé."}
              </p>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-center">
          <p className="text-[10px] text-gray-500">
            Vérification effectuée par TontineX360 — Plateforme de gestion d'associations
          </p>
        </div>
      </div>
    </div>
  );
}
