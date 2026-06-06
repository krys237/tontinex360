"use client";
import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { financeApi } from "@/lib/api/finance";
import { formatXAF, formatDate, formatRelative } from "@/lib/utils/format";
import {
  ArrowLeft, Layers, ArrowDownRight, ArrowUpRight, Loader2,
} from "lucide-react";

const TX_TYPE_LABEL: Record<string, string> = {
  contribution: "Cotisation",
  loan_out: "Décaissement prêt",
  loan_repayment: "Remboursement prêt",
  sanction: "Sanction",
  expense: "Dépense",
  income: "Revenu",
  beneficiary_payout: "Versement bénéficiaire",
  adjustment: "Ajustement",
};

export default function TontineBalanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ["tontine-balance", id],
    queryFn: () => financeApi.tontineBalanceDetail(id),
  });

  if (isLoading) {
    return (
      <>
        <Topbar title="Fonds — Trésorerie" />
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Topbar title="Fonds introuvable" />
        <p className="text-sm text-gray-400">Type de cotisation introuvable.</p>
      </>
    );
  }

  const balance = Number(data.balance);
  const totalIn = data.transactions
    .filter(t => !t.is_debit)
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = data.transactions
    .filter(t => t.is_debit)
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <>
      <Topbar title={`Fonds — ${data.tontine_type.name}`} />

      <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour à la trésorerie
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-[#F1F8E8] rounded-lg flex items-center justify-center text-[#43793F]">
            <Layers size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{data.tontine_type.name}</h2>
            <p className="text-xs text-gray-500">Devise : {data.tontine_type.currency}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Solde courant</p>
            <p className={`text-2xl font-bold ${
              balance < 0 ? 'text-red-600' : balance === 0 ? 'text-gray-500' : 'text-emerald-600'
            }`}>
              {formatXAF(balance)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-2">
            <ArrowUpRight size={16} />
          </div>
          <p className="text-xs text-gray-500">Total entrées</p>
          <p className="text-xl font-semibold text-emerald-600">+{formatXAF(totalIn)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center mb-2">
            <ArrowDownRight size={16} />
          </div>
          <p className="text-xs text-gray-500">Total sorties</p>
          <p className="text-xl font-semibold text-red-600">−{formatXAF(totalOut)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Nombre de transactions</p>
          <p className="text-xl font-semibold">{data.transactions.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Historique des transactions</h3>
        </div>

        {data.transactions.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">Aucune transaction sur ce fonds.</p>
        )}

        {data.transactions.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Caisse physique</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.transactions.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">{formatRelative(t.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${
                        t.is_debit ? "bg-red-50" : "bg-emerald-50"
                      }`}>
                        {t.is_debit
                          ? <ArrowDownRight size={12} className="text-red-600" />
                          : <ArrowUpRight size={12} className="text-emerald-600" />
                        }
                      </div>
                      <span className="text-xs text-gray-700">
                        {TX_TYPE_LABEL[t.transaction_type] ?? t.transaction_type}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {(t as any).account_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.description || "—"}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.is_debit ? "text-red-600" : "text-emerald-600"}`}>
                    {t.is_debit ? "−" : "+"}{formatXAF(Number(t.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
