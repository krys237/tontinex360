"use client";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { subscriptionsApi } from "@/lib/api/subscriptions";
import { formatXAF, formatDate } from "@/lib/utils/format";
import { CreditCard, Calendar, Receipt } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  trialing: { label: "Période d'essai", color: "bg-blue-100 text-blue-700" },
  active: { label: "Actif", color: "bg-emerald-100 text-emerald-700" },
  past_due: { label: "Paiement en retard", color: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Annulé", color: "bg-gray-100 text-gray-700" },
  expired: { label: "Expiré", color: "bg-red-100 text-red-700" },
  suspended: { label: "Suspendu", color: "bg-red-100 text-red-700" },
};

export default function SubscriptionPage() {
  const { data: subscription } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => subscriptionsApi.mySubscription(),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: () => subscriptionsApi.plans(),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: () => subscriptionsApi.payments(),
  });

  const currentPlan = typeof subscription?.plan === "object"
    ? subscription.plan
    : plans.find(p => p.id === subscription?.plan);
  const st = subscription ? STATUS[subscription.status] : null;

  return (
    <>
      <Topbar title="Abonnement" />

      {subscription && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {currentPlan?.name ?? "Plan inconnu"}
              </h2>
              {st && (
                <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                  {st.label}
                </span>
              )}
            </div>
            <CreditCard size={20} className="text-gray-300" />
          </div>

          {currentPlan && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Mensuel</p>
                <p className="text-sm font-semibold">{formatXAF(Number(currentPlan.price_monthly))}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Annuel</p>
                <p className="text-sm font-semibold">{formatXAF(Number(currentPlan.price_yearly))}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Cycle</p>
                <p className="text-sm font-semibold capitalize">{subscription.billing_cycle}</p>
              </div>
            </div>
          )}

          {(subscription.trial_end || subscription.current_period_end) && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar size={12} />
              {subscription.status === "trialing" && subscription.trial_end
                ? `Essai jusqu'au ${formatDate(subscription.trial_end)}`
                : subscription.current_period_end
                ? `Renouvellement le ${formatDate(subscription.current_period_end)}`
                : null}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Receipt size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Historique des paiements</h3>
        </div>
        {payments.length === 0 && (
          <p className="p-4 text-sm text-gray-400 text-center">Aucun paiement.</p>
        )}
        {payments.length > 0 && (
          <div className="divide-y divide-gray-100">
            {payments.map(pay => (
              <div key={pay.id} className="flex items-center gap-3 p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{pay.description || "Paiement"}</p>
                  <p className="text-xs text-gray-500">
                    {pay.payment_method} · {pay.paid_at ? formatDate(pay.paid_at) : "—"}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  pay.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                  pay.status === "pending" ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {pay.status}
                </span>
                <p className="text-sm font-semibold">{formatXAF(Number(pay.amount))}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Plans disponibles</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
          {plans.map(p => (
            <div
              key={p.id}
              className={`rounded-lg border p-4 ${
                currentPlan?.id === p.id ? "border-[#43793F] bg-[#F1F8E8]" : "border-gray-200"
              }`}
            >
              <h4 className="text-sm font-semibold text-gray-900">{p.name}</h4>
              <p className="text-xs text-gray-500 mt-1 mb-3">{p.description}</p>
              <p className="text-xl font-semibold">{formatXAF(Number(p.price_monthly))}<span className="text-xs text-gray-400">/mois</span></p>
              <ul className="text-xs text-gray-600 mt-3 space-y-1">
                <li>{p.max_members} membres max</li>
                <li>{p.max_tontine_types} tontines max</li>
                <li>{p.max_cycles} cycles</li>
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
