"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { financeApi } from "@/lib/api/finance";
import { formatXAF, formatDate } from "@/lib/utils/format";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

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

export default function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [debitFilter, setDebitFilter] = useState("");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", typeFilter, debitFilter],
    queryFn: () => financeApi.transactions({
      ...(typeFilter ? { transaction_type: typeFilter } : {}),
      ...(debitFilter ? { is_debit: debitFilter } : {}),
    }),
  });

  return (
    <>
      <Topbar title="Transactions" />

      <div className="flex items-center gap-2 mb-4">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          <option value="">Tous types</option>
          {Object.entries(TX_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={debitFilter}
          onChange={e => setDebitFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          <option value="">Entrées + Sorties</option>
          <option value="false">Entrées uniquement</option>
          <option value="true">Sorties uniquement</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading && <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>}
        {!isLoading && transactions.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">Aucune transaction.</p>
        )}
        {transactions.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right">Montant</th>
                <th className="px-4 py-2 font-medium text-right">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(t.created_at)}</td>
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
                  <td className="px-4 py-3 text-sm text-gray-600">{t.description || "—"}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.is_debit ? "text-red-600" : "text-emerald-600"}`}>
                    {t.is_debit ? "−" : "+"}{formatXAF(Number(t.amount))}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">
                    {formatXAF(Number(t.balance_after))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
