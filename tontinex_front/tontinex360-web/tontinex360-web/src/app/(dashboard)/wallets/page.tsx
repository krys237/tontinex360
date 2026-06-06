"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { walletsApi } from "@/lib/api/wallets";
import { cyclesApi } from "@/lib/api/cycles";
import { formatXAF, getInitials } from "@/lib/utils/format";
import { Snowflake, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

export default function WalletsAdminPage() {
  const [tab, setTab] = useState<"list" | "settlement">("list");
  const [cycleId, setCycleId] = useState<string>("");

  const { data: wallets = [], isLoading } = useQuery({
    queryKey: ["wallets-admin"],
    queryFn: () => walletsApi.list(),
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles"],
    queryFn: () => cyclesApi.list(),
  });

  const { data: settlement } = useQuery({
    queryKey: ["cycle-settlement", cycleId],
    queryFn: () => walletsApi.cycleSettlement(cycleId),
    enabled: !!cycleId && tab === "settlement",
  });

  return (
    <>
      <Topbar title="Wallets — Vue bureau" />

      <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setTab("list")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "list" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Tous les wallets
        </button>
        <button
          onClick={() => setTab("settlement")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            tab === "settlement" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Récap fin de cycle
        </button>
      </div>

      {tab === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading && <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>}
          {!isLoading && wallets.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400">Aucun wallet.</p>
          )}
          {wallets.length > 0 && (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 font-medium">Membre</th>
                  <th className="px-4 py-2 font-medium text-right">Crédits</th>
                  <th className="px-4 py-2 font-medium text-right">Débits</th>
                  <th className="px-4 py-2 font-medium text-right">Solde net</th>
                  <th className="px-4 py-2 font-medium">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {wallets.map(w => {
                  const balance = Number(w.balance ?? 0);
                  const [first = '', last = ''] = (w.member_name || '').split(' ');
                  return (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/members/${w.membership}`} className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#43793F] flex items-center justify-center text-white text-[10px] font-medium">
                            {getInitials(first, last)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{w.member_name}</p>
                            <p className="text-[10px] text-gray-500">#{w.member_number}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        +{formatXAF(Number(w.total_credits ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        −{formatXAF(Number(w.total_debits ?? 0))}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        balance >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {balance >= 0 ? '+' : ''}{formatXAF(balance)}
                      </td>
                      <td className="px-4 py-3">
                        {w.is_frozen ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            <Snowflake size={10} /> Gelé
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Actif
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {tab === "settlement" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <select
              value={cycleId}
              onChange={e => setCycleId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
            >
              <option value="">Choisir un cycle…</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {!cycleId && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
              Sélectionnez un cycle pour voir le récap.
            </div>
          )}

          {cycleId && settlement && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Total crédits</p>
                  <p className="text-xl font-semibold text-emerald-600">
                    +{formatXAF(Number(settlement.totals.credits))}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Total débits</p>
                  <p className="text-xl font-semibold text-red-600">
                    −{formatXAF(Number(settlement.totals.debits))}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Solde net</p>
                  <p className="text-xl font-semibold">{formatXAF(Number(settlement.totals.net))}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <FileSpreadsheet size={14} className="text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Récap par membre — {settlement.cycle_name}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2 font-medium">Membre</th>
                      <th className="px-4 py-2 font-medium text-right">Crédits</th>
                      <th className="px-4 py-2 font-medium text-right">Débits</th>
                      <th className="px-4 py-2 font-medium text-right">Net</th>
                      <th className="px-4 py-2 font-medium">À régler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {settlement.rows.map(r => {
                      const net = Number(r.net ?? 0);
                      return (
                        <tr key={r.wallet_id}>
                          <td className="px-4 py-3 font-medium text-gray-900">{r.member_name}</td>
                          <td className="px-4 py-3 text-right text-emerald-600">+{formatXAF(Number(r.credits))}</td>
                          <td className="px-4 py-3 text-right text-red-600">−{formatXAF(Number(r.debits))}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            net >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {net >= 0 ? '+' : ''}{formatXAF(net)}
                          </td>
                          <td className="px-4 py-3">
                            {r.direction === 'pay_to_member' && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                À verser
                              </span>
                            )}
                            {r.direction === 'owed_by_member' && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                À encaisser
                              </span>
                            )}
                            {r.direction === 'balanced' && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                Soldé
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
