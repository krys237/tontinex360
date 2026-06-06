"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { financeApi } from "@/lib/api/finance";
import { formatXAF, formatRelative } from "@/lib/utils/format";
import {
  CreditCard, FileCheck, ArrowDownRight, ArrowUpRight,
  Wallet as WalletIcon, Building, Smartphone, Banknote, Layers,
} from "lucide-react";

const ACCOUNT_ICON: Record<string, any> = {
  cash: Banknote,
  bank: Building,
  mobile_money: Smartphone,
  other: WalletIcon,
};

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

export default function FinanceDashboardPage() {
  const [view, setView] = useState<"physical" | "virtual">("physical");

  const { data: accounts = [] } = useQuery({
    queryKey: ["treasury"],
    queryFn: () => financeApi.treasury(),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: () => financeApi.transactions(),
  });

  const { data: balances } = useQuery({
    queryKey: ["tontine-balances"],
    queryFn: () => financeApi.tontineBalances(),
  });

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0);
  const recent = transactions.slice(0, 8);

  return (
    <>
      <Topbar title="Trésorerie" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-[#F1F8E8] text-[#43793F] rounded-lg flex items-center justify-center mb-2">
            <WalletIcon size={16} />
          </div>
          <p className="text-xs text-gray-500">Solde total</p>
          <p className="text-2xl font-semibold">{formatXAF(totalBalance)}</p>
        </div>
        <Link href="/finance/contributions"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition">
          <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-2">
            <CreditCard size={16} />
          </div>
          <p className="text-xs text-gray-500">Cotisations</p>
          <p className="text-sm font-medium text-gray-700">Voir le détail →</p>
        </Link>
        <Link href="/finance/loans"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition">
          <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-2">
            <FileCheck size={16} />
          </div>
          <p className="text-xs text-gray-500">Prêts</p>
          <p className="text-sm font-medium text-gray-700">Voir le détail →</p>
        </Link>
      </div>

      {/* Toggle vue caisses physiques / fonds virtuels */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setView("physical")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            view === "physical" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🏦 Vue par caisse physique
        </button>
        <button
          onClick={() => setView("virtual")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            view === "virtual" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          🎯 Vue par fonds (cotisation)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {view === "physical" ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Comptes de trésorerie</h2>
              <p className="text-xs text-gray-500">« Où est l'argent ? »</p>
            </div>
            <div className="divide-y divide-gray-100">
              {accounts.length === 0 && (
                <p className="p-4 text-sm text-gray-400 text-center">Aucun compte</p>
              )}
              {accounts.map(a => {
                const Icon = ACCOUNT_ICON[a.account_type] ?? WalletIcon;
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3">
                    <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center text-gray-600">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase">{a.account_type}</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatXAF(Number(a.balance ?? 0))}
                    </p>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 p-3 bg-gray-50">
                <div className="w-9 h-9" />
                <p className="flex-1 text-sm font-semibold text-gray-900">Total physique</p>
                <p className="text-base font-bold text-[#43793F]">{formatXAF(totalBalance)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Soldes par fonds (cotisation)</h2>
              <p className="text-xs text-gray-500">« À qui appartient l'argent ? »</p>
            </div>
            <div className="divide-y divide-gray-100">
              {!balances && (
                <p className="p-4 text-sm text-gray-400 text-center">Chargement…</p>
              )}
              {balances?.funds.map(f => {
                const bal = Number(f.balance);
                return (
                  <Link
                    key={f.tontine_type_id}
                    href={`/finance/tontine-balances/${f.tontine_type_id}`}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 transition"
                  >
                    <div className="w-9 h-9 bg-[#F1F8E8] rounded-lg flex items-center justify-center text-[#43793F]">
                      <Layers size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{f.name}</p>
                      <p className="text-[10px] text-gray-500">
                        +{formatXAF(Number(f.credits))} − {formatXAF(Number(f.debits))}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${
                      bal < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {formatXAF(bal)}
                    </p>
                  </Link>
                );
              })}
              {balances?.unassigned && Number(balances.unassigned.balance) !== 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-50/50">
                  <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                    <WalletIcon size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">Non affecté</p>
                    <p className="text-[10px] text-amber-600 italic">
                      Frais admin / transactions sans tag
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-amber-900">
                    {formatXAF(Number(balances.unassigned.balance))}
                  </p>
                </div>
              )}
              {balances && (
                <div className="flex items-center gap-3 p-3 bg-gray-50">
                  <div className="w-9 h-9" />
                  <p className="flex-1 text-sm font-semibold text-gray-900">Total virtuel</p>
                  <p className="text-base font-bold text-[#43793F]">
                    {formatXAF(Number(balances.total))}
                  </p>
                </div>
              )}
            </div>
            <div className="p-3 bg-blue-50 border-t border-blue-100">
              <p className="text-[10px] text-blue-700 italic">
                ℹ Le total virtuel est égal au total physique. C'est la même argent, vue
                sous deux angles.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Dernières transactions</h2>
            <Link href="/finance/transactions" className="text-xs text-[#43793F]">Tout voir</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recent.length === 0 && (
              <p className="p-4 text-sm text-gray-400 text-center">Aucune transaction</p>
            )}
            {recent.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  t.is_debit ? "bg-red-50" : "bg-emerald-50"
                }`}>
                  {t.is_debit
                    ? <ArrowDownRight size={14} className="text-red-600" />
                    : <ArrowUpRight size={14} className="text-emerald-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    {TX_TYPE_LABEL[t.transaction_type] ?? t.transaction_type}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {t.description || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-semibold ${t.is_debit ? "text-red-600" : "text-emerald-600"}`}>
                    {t.is_debit ? "−" : "+"}{formatXAF(Number(t.amount))}
                  </p>
                  <p className="text-[10px] text-gray-400">{formatRelative(t.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
