"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { tontinesApi, type TontineType, type MemberSubscription } from "@/lib/api/tontines";
import { cyclesApi } from "@/lib/api/cycles";
import { sessionsApi } from "@/lib/api/sessions";
import { financeApi } from "@/lib/api/finance";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatXAF, formatShortDate } from "@/lib/utils/format";
import Link from "next/link";
import {
  Plus, Layers, Loader2, X, Info, CreditCard, Gavel,
} from "lucide-react";

export default function MyTontinesPage() {
  const qc = useQueryClient();
  const { currentMembership } = useAuthStore();
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [payingSub, setPayingSub] = useState<MemberSubscription | null>(null);

  const { data: types = [], isLoading: loadingTypes } = useQuery({
    queryKey: ["tontine-types", "active"],
    queryFn: () => tontinesApi.types({ is_active: true }),
  });

  const { data: subscriptions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ["my-subscriptions", currentMembership?.id],
    queryFn: () => tontinesApi.subscriptions(),
    enabled: !!currentMembership,
    select: (all) =>
      all.filter((s) => s.membership === currentMembership?.id),
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles"],
    queryFn: () => cyclesApi.list(),
  });

  const activeCycle = cycles.find((c) => c.status === "active");

  const typesById = useMemo(() => {
    const m = new Map<string, TontineType>();
    types.forEach((t) => m.set(t.id, t));
    return m;
  }, [types]);

  const cyclesById = useMemo(() => {
    const m = new Map<string, (typeof cycles)[number]>();
    cycles.forEach((c) => m.set(c.id, c));
    return m;
  }, [cycles]);

  // Tontines auxquelles le membre N'EST PAS encore souscrit pour le cycle actif
  const subscribableTypes = useMemo(() => {
    if (!activeCycle) return [];
    const subscribedTypeIds = new Set(
      subscriptions
        .filter((s) => s.cycle === activeCycle.id)
        .map((s) => s.tontine_type),
    );
    return types.filter((t) => !subscribedTypeIds.has(t.id));
  }, [types, subscriptions, activeCycle]);

  return (
    <>
      <Topbar title="Mes tontines" />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          Souscrivez aux tontines de l'association et suivez vos parts.
        </p>
        <button
          onClick={() => setShowSubscribe(true)}
          disabled={!activeCycle || subscribableTypes.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !activeCycle
              ? "Aucun cycle actif"
              : subscribableTypes.length === 0
                ? "Vous êtes déjà souscrit à toutes les tontines"
                : ""
          }
        >
          <Plus size={14} /> Souscrire à une tontine
        </button>
      </div>

      {!activeCycle && !loadingSubs && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-2">
          <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            Aucun cycle actif pour le moment. La souscription sera disponible
            dès qu'un cycle sera ouvert par le bureau.
          </p>
        </div>
      )}

      {showSubscribe && currentMembership && activeCycle && (
        <SubscribeModal
          membershipId={currentMembership.id}
          cycleId={activeCycle.id}
          cycleName={activeCycle.name}
          types={subscribableTypes}
          onClose={() => setShowSubscribe(false)}
          onCreated={() => {
            setShowSubscribe(false);
            qc.invalidateQueries({ queryKey: ["my-subscriptions"] });
          }}
        />
      )}

      {(loadingSubs || loadingTypes) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          Chargement…
        </div>
      )}

      {!loadingSubs && !loadingTypes && subscriptions.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Layers size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-600 font-medium">
            Vous n'êtes encore inscrit à aucune tontine.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {activeCycle
              ? "Cliquez sur « Souscrire » pour rejoindre une tontine du cycle en cours."
              : "Attendez l'ouverture d'un cycle pour souscrire."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {subscriptions.map((s) => {
          const type = typesById.get(s.tontine_type);
          const cycle = cyclesById.get(s.cycle);
          const isInKind = type?.contribution_kind === "in_kind";
          const amountPerSession = Number(s.amount_per_session ?? 0);
          const rate = Number(s.rate_per_share);
          const xafEquiv =
            isInKind && type?.in_kind_unit_value
              ? amountPerSession * Number(type.in_kind_unit_value)
              : null;

          return (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F1F8E8] flex items-center justify-center text-[#43793F] shrink-0">
                  <Layers size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {type?.name ?? "Tontine"}
                    </h3>
                    {!s.is_active && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Inactive
                      </span>
                    )}
                    {isInKind && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        🌾 Nature
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Cycle : {cycle?.name ?? "—"}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 uppercase">
                        {type?.share_unit_name || "Parts"}
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {s.num_shares}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 uppercase">
                        Par séance
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {isInKind
                          ? `${amountPerSession} ${type?.in_kind_unit_label || "u."}`
                          : formatXAF(amountPerSession)}
                      </p>
                      {xafEquiv != null && (
                        <p className="text-[10px] text-gray-400">
                          ≈ {formatXAF(xafEquiv)}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 italic mt-2">
                    Taux par {type?.share_unit_name || "part"}
                    {" : "}
                    {isInKind
                      ? `${rate} ${type?.in_kind_unit_label || "u."}`
                      : formatXAF(rate)}
                  </p>

                  {/* Actions membre : cotiser + enchère si tontine en mode auction */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {s.is_active && (
                      <button
                        onClick={() => setPayingSub(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-xs font-semibold rounded-lg hover:bg-[#43793F]"
                      >
                        <CreditCard size={12} /> Cotiser
                      </button>
                    )}
                    {type?.default_acquisition_method === "auction" && (
                      <Link
                        href={`/auctions?tontine=${type.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-50"
                      >
                        <Gavel size={12} /> Voir les enchères
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {payingSub && (
        <ContributeModal
          subscription={payingSub}
          type={typesById.get(payingSub.tontine_type)!}
          cycleId={payingSub.cycle}
          onClose={() => setPayingSub(null)}
          onCreated={() => {
            setPayingSub(null);
            qc.invalidateQueries({ queryKey: ["contributions"] });
            qc.invalidateQueries({ queryKey: ["my-wallet"] });
          }}
        />
      )}
    </>
  );
}

function SubscribeModal({
  membershipId,
  cycleId,
  cycleName,
  types,
  onClose,
  onCreated,
}: {
  membershipId: string;
  cycleId: string;
  cycleName: string;
  types: TontineType[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [numShares, setNumShares] = useState(1);
  const [ratePerShare, setRatePerShare] = useState<string>("");
  const [error, setError] = useState("");

  const type = types.find((t) => t.id === typeId);
  const isInKind = type?.contribution_kind === "in_kind";
  const unitLabel = isInKind
    ? type?.in_kind_unit_label || "unités"
    : type?.currency || "XAF";

  // Pré-remplit le taux selon le mode
  const suggestedRate = useMemo(() => {
    if (!type) return "";
    if (type.rate_mode === "fixed" && type.fixed_rate != null) {
      return String(type.fixed_rate);
    }
    if (type.rate_mode === "range" && type.min_rate != null) {
      return String(type.min_rate);
    }
    return "";
  }, [type]);

  // Reset rate when type changes
  useMemo(() => {
    if (type?.rate_mode === "fixed" && type.fixed_rate != null) {
      setRatePerShare(String(type.fixed_rate));
    } else if (
      type?.rate_mode === "range" &&
      !ratePerShare &&
      type.min_rate != null
    ) {
      setRatePerShare(String(type.min_rate));
    }
  }, [typeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rateNum = Number(ratePerShare || 0);
  const amountPerSession = numShares * rateNum;
  const xafEquiv =
    isInKind && type?.in_kind_unit_value
      ? amountPerSession * Number(type.in_kind_unit_value)
      : null;

  // Validation
  const validationError = useMemo(() => {
    if (!type) return "Choisissez une tontine.";
    if (numShares < 1) return "Au moins 1 part.";
    if (
      type.allows_multiple_shares &&
      type.max_shares_per_member &&
      numShares > type.max_shares_per_member
    ) {
      return `Maximum ${type.max_shares_per_member} ${type.share_unit_name}.`;
    }
    if (!type.allows_multiple_shares && numShares > 1) {
      return "Cette tontine n'autorise qu'une seule part.";
    }
    if (rateNum <= 0) return "Le taux par part doit être positif.";
    if (type.rate_mode === "fixed" && type.fixed_rate != null) {
      if (rateNum !== Number(type.fixed_rate)) {
        return `Taux fixe imposé : ${type.fixed_rate} ${unitLabel}.`;
      }
    }
    if (type.rate_mode === "range") {
      if (type.min_rate != null && rateNum < Number(type.min_rate)) {
        return `Minimum : ${type.min_rate} ${unitLabel}.`;
      }
      if (type.max_rate != null && rateNum > Number(type.max_rate)) {
        return `Maximum : ${type.max_rate} ${unitLabel}.`;
      }
    }
    return null;
  }, [type, numShares, rateNum, unitLabel]);

  const createMut = useMutation({
    mutationFn: () =>
      tontinesApi.createSubscription({
        membership: membershipId,
        tontine_type: typeId,
        cycle: cycleId,
        num_shares: numShares,
        rate_per_share: rateNum,
      }),
    onSuccess: () => onCreated(),
    onError: (err: any) => {
      const data = err.response?.data;
      const msg =
        typeof data === "string"
          ? data
          : data?.detail ||
            (data
              ? Object.entries(data)
                  .map(
                    ([k, v]) =>
                      `${k}: ${Array.isArray(v) ? v.join(" ") : v}`,
                  )
                  .join(" ; ")
              : "") ||
            "Erreur lors de la souscription";
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            Souscrire à une tontine
          </h3>
          <button onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Cycle (en cours)
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              {cycleName}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Tontine *
            </label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.contribution_kind === "in_kind"
                    ? ` (${t.in_kind_unit_label || "nature"})`
                    : ""}
                </option>
              ))}
            </select>
            {type?.description && (
              <p className="text-[10px] text-gray-500 mt-1">
                {type.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                {type?.share_unit_name || "Parts"} *
              </label>
              <input
                type="number"
                min={1}
                max={
                  type?.allows_multiple_shares
                    ? type.max_shares_per_member ?? undefined
                    : 1
                }
                value={numShares}
                onChange={(e) =>
                  setNumShares(Math.max(1, Number(e.target.value || 1)))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              {type?.allows_multiple_shares && type.max_shares_per_member && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Max : {type.max_shares_per_member}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Taux / {type?.share_unit_name || "part"} ({unitLabel}) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={ratePerShare}
                onChange={(e) => setRatePerShare(e.target.value)}
                disabled={
                  type?.rate_mode === "fixed" && type.fixed_rate != null
                }
                placeholder={suggestedRate || (isInKind ? "1" : "10000")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
              {type?.rate_mode === "range" && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Plage : {type.min_rate} – {type.max_rate} {unitLabel}
                </p>
              )}
              {type?.rate_mode === "free" && (
                <p className="text-[10px] text-amber-600 mt-0.5">
                  Mode libre : à vous de fixer.
                </p>
              )}
            </div>
          </div>

          <div className="bg-[#F1F8E8] border border-[#87C241]/30 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase font-medium">
              Engagement par séance
            </p>
            <p className="text-lg font-bold text-[#43793F] mt-0.5">
              {isInKind
                ? `${amountPerSession} ${type?.in_kind_unit_label || "u."}`
                : formatXAF(amountPerSession)}
            </p>
            {xafEquiv != null && (
              <p className="text-xs text-gray-500">
                ≈ {formatXAF(xafEquiv)} (valeur de référence)
              </p>
            )}
          </div>

          {validationError && (
            <p className="text-xs text-red-600">{validationError}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !!validationError}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-sm rounded-lg hover:bg-[#43793F] disabled:opacity-50"
          >
            {createMut.isPending && (
              <Loader2 size={12} className="animate-spin" />
            )}
            Souscrire
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Modal Cotiser : un membre paie sa cotisation pour une séance
// ─────────────────────────────────────────────────────────────────────

const PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: "cash", label: "Espèces" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Virement bancaire" },
  { value: "wallet", label: "Wallet personnel" },
  { value: "other", label: "Autre" },
];

function ContributeModal({
  subscription,
  type,
  cycleId,
  onClose,
  onCreated,
}: {
  subscription: MemberSubscription;
  type: TontineType;
  cycleId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();

  // Toutes les séances du cycle (programmées ou en cours uniquement)
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", cycleId],
    queryFn: () => sessionsApi.list({ cycle: cycleId }),
  });
  const upcoming = useMemo(
    () =>
      sessions
        .filter((s) => ["scheduled", "in_progress"].includes(s.status))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [sessions],
  );

  // Mes cotisations déjà existantes pour ne pas proposer une séance déjà payée
  const { data: myContributions = [] } = useQuery({
    queryKey: ["contributions", "self", subscription.membership, cycleId],
    queryFn: () =>
      financeApi.contributions({
        membership: subscription.membership,
        tontine_type: subscription.tontine_type,
      } as any),
  });
  const paidSessionIds = useMemo(
    () =>
      new Set(
        myContributions
          .filter(
            (c) => c.status === "paid" || c.status === "partial",
          )
          .map((c) => c.session),
      ),
    [myContributions],
  );

  const eligibleSessions = upcoming.filter((s) => !paidSessionIds.has(s.id));
  const isInKind = type.contribution_kind === "in_kind";
  const expected =
    Number(subscription.num_shares) * Number(subscription.rate_per_share);
  const unitLabel = isInKind
    ? type.in_kind_unit_label || "u."
    : type.currency || "XAF";

  const [sessionId, setSessionId] = useState(eligibleSessions[0]?.id ?? "");
  const [amount, setAmount] = useState<string>(String(expected));
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [error, setError] = useState("");

  // En mode libre, le membre choisit son montant ; sinon on impose
  const isFree = type.rate_mode === "free";
  const numericAmount = Number(amount || 0);

  const mut = useMutation({
    mutationFn: () => {
      const isPartial = isFree
        ? false
        : numericAmount > 0 && numericAmount < expected;
      const status = numericAmount <= 0
        ? "pending"
        : isPartial
          ? "partial"
          : "paid";
      return financeApi.createContribution({
        session: sessionId,
        membership: subscription.membership,
        tontine_type: subscription.tontine_type,
        expected_amount: isFree ? numericAmount : expected,
        paid_amount: numericAmount,
        status,
        payment_method: paymentMethod,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contributions"] });
      onCreated();
    },
    onError: (err: any) => {
      const data = err.response?.data;
      const msg =
        typeof data === "string"
          ? data
          : data?.detail ||
            (data
              ? Object.entries(data)
                  .map(([k, v]) =>
                    `${k}: ${Array.isArray(v) ? v.join(" ") : v}`,
                  )
                  .join(" ; ")
              : "") ||
            "Erreur lors de l'enregistrement.";
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            Cotiser à {type.name}
          </h3>
          <button onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3">
            {error}
          </div>
        )}

        {eligibleSessions.length === 0 ? (
          <div className="text-center py-6">
            <Info size={20} className="mx-auto text-amber-500 mb-2" />
            <p className="text-sm text-gray-600">
              Aucune séance ouverte pour cette tontine.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {paidSessionIds.size > 0
                ? "Vous avez déjà cotisé à toutes les séances disponibles."
                : "Attendez qu'une séance soit programmée par le bureau."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Séance *
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
              >
                {eligibleSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    Séance n°{s.session_number} ·{" "}
                    {formatShortDate(s.date)}
                    {s.location ? ` · ${s.location}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                {isFree
                  ? `Montant à verser (${unitLabel}) *`
                  : `Montant attendu (${unitLabel})`}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!isFree}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-700"
              />
              {!isFree && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {subscription.num_shares} × {subscription.rate_per_share}{" "}
                  {unitLabel} = {expected} {unitLabel}.
                  Vous pouvez modifier en cas de versement partiel.
                </p>
              )}
              {!isFree && numericAmount < expected && numericAmount > 0 && (
                <p className="text-[10px] text-amber-700 mt-1">
                  ⚠ Versement partiel : le solde restera dû.
                </p>
              )}
            </div>

            {/* Permet la saisie manuelle en cas de versement partiel */}
            {!isFree && (
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAmount("0");
                    } else {
                      setAmount(String(expected));
                    }
                  }}
                />
                Je verse un montant différent (acompte)
              </label>
            )}
            {/* Quand acompte coché, on rend le champ éditable manuellement */}
            {!isFree && Number(amount) !== expected && (
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-amber-50"
                placeholder={`Montant en ${unitLabel}`}
              />
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Méthode de paiement *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-[#F1F8E8] border border-[#87C241]/30 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Total versé</p>
              <p className="text-lg font-bold text-[#43793F] mt-0.5">
                {isInKind
                  ? `${numericAmount} ${unitLabel}`
                  : formatXAF(numericAmount)}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={
              mut.isPending ||
              !sessionId ||
              numericAmount <= 0 ||
              eligibleSessions.length === 0
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-sm rounded-lg hover:bg-[#43793F] disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
