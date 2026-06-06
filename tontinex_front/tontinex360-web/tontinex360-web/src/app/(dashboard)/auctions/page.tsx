"use client";
import { Suspense, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { SectionHeader } from "@/components/ui/section-header";
import { potsApi } from "@/lib/api/pots";
import { sessionsApi } from "@/lib/api/sessions";
import { tontinesApi } from "@/lib/api/tontines";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatXAF, formatShortDate } from "@/lib/utils/format";
import {
  Gavel, Loader2, Trophy, TrendingUp, AlertCircle, Calendar,
} from "lucide-react";
import type { SessionPot, AuctionBid } from "@/lib/types/pot";

function AuctionsPageInner() {
  const params = useSearchParams();
  const tontineFilter = params.get("tontine");
  const { currentMembership } = useAuthStore();

  // On récupère tous les pots ouverts en mode enchère
  const { data: pots = [], isLoading } = useQuery({
    queryKey: ["pots", "auction-open"],
    queryFn: () => potsApi.list({ is_closed: false }),
    select: (all) =>
      all.filter(
        (p) =>
          p.effective_method === "auction" &&
          (!tontineFilter || p.tontine_type === tontineFilter),
      ),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => sessionsApi.list(),
  });

  const { data: types = [] } = useQuery({
    queryKey: ["tontine-types", "active"],
    queryFn: () => tontinesApi.types({ is_active: true }),
  });

  return (
    <>
      <Topbar title="Enchères" />

      <SectionHeader
        eyebrow="Tontines"
        title="Enchères en cours"
        description="Participez aux enchères pour remporter les cagnottes des tontines fonctionnant à l'enchère. Le plus offrant gagne."
      />

      {isLoading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">
          Chargement…
        </div>
      )}

      {!isLoading && pots.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Gavel size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">
            Aucune enchère ouverte pour le moment.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {tontineFilter
              ? "Aucun pot en enchère pour cette tontine."
              : "Les pots en mode enchère apparaîtront ici dès qu'ils seront ouverts."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pots.map((pot) => {
          const session = sessions.find((s) => s.id === pot.session);
          const type = types.find((t) => t.id === pot.tontine_type);
          return (
            <AuctionPotCard
              key={pot.id}
              pot={pot}
              session={session}
              currency={type?.currency || "XAF"}
              currentMembershipId={currentMembership?.id}
            />
          );
        })}
      </div>
    </>
  );
}

function AuctionPotCard({
  pot,
  session,
  currency,
  currentMembershipId,
}: {
  pot: SessionPot;
  session?: { id: string; session_number: number; date: string; location?: string };
  currency: string;
  currentMembershipId?: string;
}) {
  const qc = useQueryClient();
  const { data: bids = [] } = useQuery({
    queryKey: ["bids", pot.id],
    queryFn: () => potsApi.bids(pot.id),
    refetchInterval: 8000,
  });

  const sortedBids = useMemo(
    () => [...bids].sort((a, b) => Number(b.bid_amount) - Number(a.bid_amount)),
    [bids],
  );
  const highestBid = sortedBids[0];
  const myBid = sortedBids.find(
    (b) => b.membership === currentMembershipId && b.status === "active",
  );

  const [amount, setAmount] = useState<string>("");
  const [error, setError] = useState("");

  // Le montant minimum doit dépasser strictement la meilleure offre
  const minNextBid = highestBid
    ? Number(highestBid.bid_amount) + 1
    : Math.ceil(Number(pot.total_available) * 0.05); // 5% du pot comme suggestion

  const placeBid = useMutation({
    mutationFn: () =>
      potsApi.placeBid({
        pot: pot.id,
        membership: currentMembershipId!,
        bid_amount: Number(amount),
      }),
    onSuccess: () => {
      setAmount("");
      qc.invalidateQueries({ queryKey: ["bids", pot.id] });
    },
    onError: (err: any) => {
      const data = err.response?.data;
      const msg =
        typeof data === "string"
          ? data
          : data?.detail || data?.error || "Erreur";
      setError(msg);
    },
  });

  const numericAmount = Number(amount || 0);
  const isValid =
    numericAmount > 0 &&
    numericAmount >= minNextBid &&
    !!currentMembershipId;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 border-b border-amber-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Gavel size={14} className="text-amber-600" />
              <h3 className="text-sm font-bold text-[#1E3233]">
                {pot.tontine_name}
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                ENCHÈRE
              </span>
            </div>
            {session && (
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                <Calendar size={11} />
                Séance n°{session.session_number} ·{" "}
                {formatShortDate(session.date)}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-500 uppercase">Cagnotte</p>
            <p className="text-lg font-bold text-amber-700">
              {formatXAF(Number(pot.total_available))}
            </p>
          </div>
        </div>
      </div>

      {/* Bid status */}
      <div className="p-4 space-y-3">
        {highestBid ? (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                <Trophy size={11} className="text-amber-500" />
                Meilleure offre actuelle
              </span>
              <span className="text-base font-bold text-[#43793F]">
                {formatXAF(Number(highestBid.bid_amount))} {currency}
              </span>
            </div>
            <p className="text-[10px] text-gray-500">
              par <strong>{highestBid.member_name}</strong>
              {highestBid.membership === currentMembershipId && (
                <span className="ml-1 text-emerald-600">(vous)</span>
              )}
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">
              Aucune enchère pour l'instant. Soyez le premier !
            </p>
          </div>
        )}

        {myBid && highestBid?.membership !== currentMembershipId && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 flex items-start gap-1.5">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>
              Votre offre actuelle de{" "}
              <strong>{formatXAF(Number(myBid.bid_amount))}</strong> a été
              dépassée.
            </span>
          </div>
        )}

        {/* Formulaire d'enchère */}
        <div className="border-t border-gray-100 pt-3">
          <label className="text-xs text-gray-500 block mb-1.5">
            <TrendingUp size={11} className="inline mr-1" />
            Surenchérir (minimum {formatXAF(minNextBid)})
          </label>
          {error && (
            <p className="text-xs text-red-600 mb-2">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={minNextBid}
              step="1"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              placeholder={`${minNextBid}`}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            <button
              onClick={() => placeBid.mutate()}
              disabled={!isValid || placeBid.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {placeBid.isPending && (
                <Loader2 size={12} className="animate-spin" />
              )}
              <Gavel size={12} />
              Enchérir
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Votre enchère devient publique immédiatement et peut être surenchérie
            par d'autres membres jusqu'à la clôture par le bureau.
          </p>
        </div>

        {/* Historique top 5 */}
        {sortedBids.length > 1 && (
          <details className="border-t border-gray-100 pt-3">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Voir les {sortedBids.length} enchères
            </summary>
            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
              {sortedBids.slice(0, 10).map((b, i) => (
                <BidRow
                  key={b.id}
                  bid={b}
                  rank={i + 1}
                  isMine={b.membership === currentMembershipId}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function BidRow({
  bid,
  rank,
  isMine,
}: {
  bid: AuctionBid;
  rank: number;
  isMine: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
        isMine ? "bg-[#F1F8E8]" : "bg-gray-50"
      }`}
    >
      <span className="text-gray-600">
        #{rank} {bid.member_name}
        {isMine && (
          <span className="ml-1 text-[10px] text-emerald-600">(vous)</span>
        )}
      </span>
      <span className="font-semibold text-gray-900">
        {formatXAF(Number(bid.bid_amount))}
      </span>
    </div>
  );
}

export default function AuctionsPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <Loader2 size={20} className="animate-spin text-gray-400 mx-auto" />
        </div>
      }
    >
      <AuctionsPageInner />
    </Suspense>
  );
}
