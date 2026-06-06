"use client";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { walletsApi } from "@/lib/api/wallets";
import { formatXAF, formatShortDate } from "@/lib/utils/format";
import { SignatureNudge } from "@/components/signature/signature-nudge";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Snowflake, RefreshCw,
} from "lucide-react";

const SOURCE_ICON: Record<string, { label: string; color: string }> = {
  auction_premium: { label: "Prime d'enchère", color: "text-emerald-600" },
  loan_interest: { label: "Intérêt prêt", color: "text-emerald-600" },
  sanction_payment: { label: "Sanction payée", color: "text-emerald-600" },
  contribution_default: { label: "Cotisation impayée", color: "text-red-600" },
  default_compensation: { label: "Compensation collective", color: "text-red-600" },
  expense: { label: "Dépense distribuée", color: "text-red-600" },
  manual_adjustment: { label: "Ajustement manuel", color: "text-gray-600" },
};

export default function MyWalletPage() {
  const { data: wallet, isLoading: loadingWallet } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => walletsApi.myWallet(),
  });

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['my-wallet-entries'],
    queryFn: () => walletsApi.myEntries(),
  });

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['my-wallet-summary'],
    queryFn: () => walletsApi.mySummary(),
  });

  const balance = Number(wallet?.balance ?? 0);
  const credits = Number(wallet?.total_credits ?? 0);
  const debits = Number(wallet?.total_debits ?? 0);

  return (
    <>
      <Topbar title="Mon portefeuille" />

      <SignatureNudge />

      {wallet?.is_frozen && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
          <Snowflake size={16} /> Votre portefeuille est gelé suite à votre démission.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-[#F1F8E8] text-[#43793F] rounded-lg flex items-center justify-center mb-2">
            <Wallet size={16} />
          </div>
          <p className="text-xs text-gray-500">Solde net</p>
          <p className={`text-2xl font-semibold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {balance >= 0 ? '+' : ''}{formatXAF(balance)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-2">
            <ArrowUpRight size={16} />
          </div>
          <p className="text-xs text-gray-500">Total crédits</p>
          <p className="text-2xl font-semibold text-emerald-600">{formatXAF(credits)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center mb-2">
            <ArrowDownLeft size={16} />
          </div>
          <p className="text-xs text-gray-500">Total débits</p>
          <p className="text-2xl font-semibold text-red-600">{formatXAF(debits)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Historique des écritures</h2>
          <button
            onClick={() => refetchSummary()}
            className="flex items-center gap-1 text-xs text-[#43793F] hover:underline"
          >
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>

        {(loadingWallet || loadingEntries) && (
          <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>
        )}

        {!loadingEntries && entries.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">
            Aucune écriture pour le moment.
          </p>
        )}

        {entries.length > 0 && (
          <div className="divide-y divide-gray-100">
            {entries.map(e => {
              const meta = SOURCE_ICON[e.source_type] ?? { label: e.source_type, color: 'text-gray-600' };
              const isCredit = e.direction === 'credit';
              return (
                <div key={e.id} className="flex items-center gap-3 p-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isCredit ? 'bg-emerald-50' : 'bg-red-50'
                  }`}>
                    {isCredit ? (
                      <ArrowUpRight size={14} className="text-emerald-600" />
                    ) : (
                      <ArrowDownLeft size={14} className="text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {e.description || meta.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {meta.label}
                      {e.session_number ? ` · Séance ${e.session_number}` : ''}
                      {e.session_date ? ` · ${formatShortDate(e.session_date)}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isCredit ? '+' : '−'}{formatXAF(Number(e.amount))}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Solde: {formatXAF(Number(e.balance_after))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {summary && summary.breakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mt-4 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Répartition par source</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {summary.breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-gray-600">
                  {SOURCE_ICON[b.source_type]?.label ?? b.source_type}
                </span>
                <span className={`font-medium ${b.direction === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {b.direction === 'credit' ? '+' : '−'}{formatXAF(Number(b.total))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
