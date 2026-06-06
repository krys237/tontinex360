"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { potsApi } from "@/lib/api/pots";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatXAF, formatShortDate } from "@/lib/utils/format";
import {
  HandCoins, Download, CheckCircle2, Clock, XCircle, PenLine,
} from "lucide-react";
import Link from "next/link";

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  paid: {
    label: "Versé",
    color: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  pending: {
    label: "En attente",
    color: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  cancelled: {
    label: "Annulé",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
};

export default function MyPayoutsPage() {
  const { currentMembership } = useAuthStore();

  const { data: allPayouts = [], isLoading } = useQuery({
    queryKey: ["my-payouts", currentMembership?.id],
    queryFn: () => potsApi.payouts(),
    enabled: !!currentMembership,
    select: (all) =>
      all.filter((p) => p.membership === currentMembership?.id),
  });

  const stats = useMemo(() => {
    const paid = allPayouts.filter((p) => p.status === "paid");
    const pending = allPayouts.filter((p) => p.status === "pending");
    const totalXAF = paid.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    return {
      paidCount: paid.length,
      pendingCount: pending.length,
      totalXAF,
    };
  }, [allPayouts]);

  return (
    <>
      <Topbar title="Mes versements reçus" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-[#F1F8E8] text-[#43793F] rounded-lg flex items-center justify-center mb-2">
            <HandCoins size={16} />
          </div>
          <p className="text-xs text-gray-500">Total reçu</p>
          <p className="text-2xl font-semibold text-[#43793F]">
            {formatXAF(stats.totalXAF)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-2">
            <CheckCircle2 size={16} />
          </div>
          <p className="text-xs text-gray-500">Versements effectués</p>
          <p className="text-2xl font-semibold text-emerald-600">
            {stats.paidCount}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-2">
            <Clock size={16} />
          </div>
          <p className="text-xs text-gray-500">En attente</p>
          <p className="text-2xl font-semibold text-amber-600">
            {stats.pendingCount}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Historique de mes versements
          </h2>
        </div>

        {isLoading && (
          <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>
        )}

        {!isLoading && allPayouts.length === 0 && (
          <div className="p-8 text-center">
            <HandCoins size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-600">
              Vous n'avez encore reçu aucun versement.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Les versements seront listés ici dès que vous serez désigné·e
              bénéficiaire d'une séance.
            </p>
          </div>
        )}

        {allPayouts.length > 0 && (
          <div className="divide-y divide-gray-100">
            {allPayouts.map((payout) => {
              const meta =
                STATUS_META[payout.status] ?? STATUS_META["pending"];
              const StatusIcon = meta.icon;
              const isInKind = payout.is_in_kind;
              const converted = payout.was_converted_to_cash;
              const qty = Number(payout.in_kind_quantity ?? 0);
              const xafAmount = Number(payout.amount ?? 0);

              return (
                <div
                  key={payout.id}
                  className="flex items-start gap-3 p-4 hover:bg-gray-50 transition"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#F1F8E8] flex items-center justify-center text-[#43793F] shrink-0">
                    <HandCoins size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">
                        {payout.tontine_name}
                      </p>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${meta.color}`}
                      >
                        <StatusIcon size={10} />
                        {meta.label}
                      </span>
                      {isInKind && !converted && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          🌾 En nature
                        </span>
                      )}
                      {converted && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          ↪ Converti en argent
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Séance n°{payout.session_number}
                      {payout.paid_at
                        ? ` · ${formatShortDate(payout.paid_at)}`
                        : ""}
                      {" · "}
                      Méthode : {payout.method_display}
                    </p>
                    {payout.notes && (
                      <p className="text-xs text-gray-500 italic mt-1">
                        « {payout.notes} »
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {isInKind && !converted ? (
                      <>
                        <p className="text-base font-bold text-[#43793F]">
                          {qty} {payout.in_kind_unit_label || "u."}
                        </p>
                        {xafAmount > 0 && (
                          <p className="text-[10px] text-gray-500">
                            ≈ {formatXAF(xafAmount)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-base font-bold text-[#43793F]">
                        {formatXAF(xafAmount)}
                      </p>
                    )}

                    {payout.status === "paid" &&
                      (payout.receipt_pdf ? (
                        <a
                          href={payout.receipt_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-600 hover:underline"
                        >
                          <Download size={11} />
                          Reçu
                        </a>
                      ) : (
                        <Link
                          href={`/pot?payout=${payout.id}`}
                          className="inline-flex items-center gap-1 mt-2 text-xs text-[#43793F] hover:underline"
                        >
                          <PenLine size={11} />
                          Signer
                        </Link>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
