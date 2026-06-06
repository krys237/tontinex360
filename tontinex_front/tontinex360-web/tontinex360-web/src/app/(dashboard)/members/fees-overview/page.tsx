"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { memberFeesApi } from "@/lib/api/member-fees";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatXAF } from "@/lib/utils/format";
import {
  ArrowLeft, Users, Coins, AlertTriangle, ChevronRight, Settings as SettingsIcon,
} from "lucide-react";

export default function FeesOverviewPage() {
  const p = usePermissions();
  const canView = p.isBureau || p.isPresident || p.canAny(['*', 'members.*']);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fees-pending-overview"],
    queryFn: () => memberFeesApi.pendingOverview(),
    enabled: canView,
  });

  const totals = useMemo(() => {
    let expected = 0;
    let paid = 0;
    let remaining = 0;
    rows.forEach(r => {
      expected += Number(r.total_expected);
      paid += Number(r.total_paid);
      remaining += Number(r.total_remaining);
    });
    return { expected, paid, remaining, members: rows.length };
  }, [rows]);

  if (!canView) {
    return (
      <>
        <Topbar title="Frais d'adhésion — Vue d'ensemble" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
          Accès réservé au bureau / trésorier.
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Frais d'adhésion — Vue d'ensemble" />

      <div className="flex items-center justify-between mb-4">
        <Link href="/members" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Retour aux membres
        </Link>
        <Link
          href="/settings/membership-fees"
          className="inline-flex items-center gap-1 text-xs text-[#43793F] hover:underline"
        >
          <SettingsIcon size={12} /> Configurer les frais
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Membres en retard" value={totals.members} icon={<Users size={16} />} color="text-amber-600" />
        <StatCard label="Total attendu" value={formatXAF(totals.expected)} icon={<Coins size={16} />} color="text-gray-700" />
        <StatCard label="Total perçu" value={formatXAF(totals.paid)} icon={<Coins size={16} />} color="text-emerald-600" />
        <StatCard label="Reste à percevoir" value={formatXAF(totals.remaining)} icon={<AlertTriangle size={16} />} color="text-red-600" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading && (
          <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>
        )}
        {!isLoading && rows.length === 0 && (
          <div className="p-12 text-center">
            <Coins size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              Aucun membre n'a de frais d'adhésion en retard. 🎉
            </p>
          </div>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 font-medium">Membre</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium text-right">Attendu</th>
                <th className="px-4 py-2 font-medium text-right">Payé</th>
                <th className="px-4 py-2 font-medium text-right">Reste</th>
                <th className="px-4 py-2 font-medium">Frais</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => {
                const isPending = r.member_status === 'pending';
                return (
                  <tr key={r.membership_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/members/${r.membership_id}`}
                        className="text-sm font-medium text-gray-900 hover:underline"
                      >
                        {r.member_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isPending
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isPending ? '⏳ En attente' : '✓ Actif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatXAF(Number(r.total_expected))}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                      {formatXAF(Number(r.total_paid))}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">
                      {formatXAF(Number(r.total_remaining))}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {r.fees.map(f => (
                          <span
                            key={f.id}
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              f.status === 'paid' || f.status === 'waived'
                                ? 'bg-emerald-100 text-emerald-700'
                                : f.status === 'partial'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                            }`}
                            title={`${f.fee_type_display} : ${formatXAF(Number(f.paid_amount))}/${formatXAF(Number(f.expected_amount))}`}
                          >
                            {f.fee_type === 'registration' ? '🪙' : '🐷'} {Math.round(f.progress_pct)}%
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/members/${r.membership_id}`}
                        className="inline-flex items-center gap-1 text-xs text-[#43793F] hover:underline"
                      >
                        Détail <ChevronRight size={12} />
                      </Link>
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

function StatCard({
  label, value, icon, color,
}: { label: string; value: any; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      </div>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
