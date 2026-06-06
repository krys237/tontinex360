"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { RequirePermission } from "@/components/auth/require-permission";
import { ReceiptSigningModal } from "@/components/signature/receipt-signing-modal";
import { potsApi } from "@/lib/api/pots";
import { sessionsApi } from "@/lib/api/sessions";
import { membersApi } from "@/lib/api/members";
import { tontinesApi } from "@/lib/api/tontines";
import { cyclesApi } from "@/lib/api/cycles";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  formatXAF, formatShortDate, getInitials,
  formatContributionAmount, formatInKindEquivalent,
} from "@/lib/utils/format";
import { ApprovalRequestModal } from "@/components/approvals/approval-request-modal";
import { ACQUISITION_METHODS, PAYOUT_STATUS } from "@/lib/utils/constants";
import type { SessionPot, BeneficiaryPayout, AuctionBid } from "@/lib/types/pot";
import type { Session } from "@/lib/types/cycle";
import {
  Layers, DollarSign, ArrowRightLeft, Hammer, Lock,
  ChevronDown, Plus, Check, X, Loader2, FileCheck,
  Download, Users, TrendingUp, ArrowRight, Clock,
  Gift, AlertCircle, Ban, Unlock, PenLine,
} from "lucide-react";

// ── Sous-composants internes ──

function PotKpis({ pot }: { pot: SessionPot }) {
  const pct = pot.total_available > 0
    ? Math.round((pot.total_distributed / pot.total_available) * 100)
    : 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <KpiCard
        icon={DollarSign} tint="primary"
        label="Collecte du jour"
        value={formatXAF(pot.total_collected)}
      />
      <KpiCard
        icon={ArrowRightLeft} tint="accent"
        label="Report + primes"
        value={formatXAF(pot.carry_over_in + pot.auction_premium_in)}
        sublabel={pot.carry_over_in > 0 ? `Report: ${formatXAF(pot.carry_over_in)}` : undefined}
      />
      <KpiCard
        icon={Layers} tint="info"
        label="Cagnotte totale"
        value={formatXAF(pot.total_available)}
      />
      <KpiCard
        icon={TrendingUp} tint={pct >= 100 ? "primary" : "accent"}
        label="Distribue"
        value={`${pct}%`}
        sublabel={`${formatXAF(pot.total_distributed)} / ${formatXAF(pot.total_available)}`}
      />
    </div>
  );
}

function PayoutRow({
  payout,
  onSign,
  onCorrect,
}: {
  payout: BeneficiaryPayout;
  onSign: (p: BeneficiaryPayout) => void;
  onCorrect?: (p: BeneficiaryPayout) => void;
}) {
  const st = PAYOUT_STATUS[payout.status as keyof typeof PAYOUT_STATUS];
  const initials = payout.member_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div className="flex items-center gap-3 p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
      <div className="w-9 h-9 rounded-full bg-[#F1F8E8] text-[#43793F] flex items-center justify-center text-xs font-semibold shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[#1E3233] truncate">
            {payout.member_name}
          </p>
          <StatusBadge variant={payout.status === "paid" ? "success" : payout.status === "cancelled" ? "danger" : "warning"}>
            {st?.label || payout.status}
          </StatusBadge>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {payout.shares_claimed}/{payout.shares_total} nom{payout.shares_total > 1 ? "s" : ""}
          {" · "}
          {ACQUISITION_METHODS[payout.acquisition_method as keyof typeof ACQUISITION_METHODS] || payout.method_display}
          {payout.receipt_number && (
            <span className="text-[#43793F] ml-2">
              <FileCheck className="inline w-3 h-3 -mt-0.5" /> {payout.receipt_number}
            </span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        {/* Affichage selon mode in_kind ou cash */}
        {payout.is_in_kind && !payout.was_converted_to_cash ? (
          <>
            <p className="text-sm font-bold text-[#1E3233]">
              {formatContributionAmount(Number(payout.in_kind_quantity ?? 0), {
                kind: 'in_kind',
                unitLabel: payout.in_kind_unit_label || payout.tontine_in_kind_unit_label,
              })}
            </p>
            <p className="text-[10px] text-gray-400">
              {formatInKindEquivalent(
                Number(payout.in_kind_quantity ?? 0),
                payout.amount && payout.in_kind_quantity
                  ? Number(payout.amount) / Number(payout.in_kind_quantity)
                  : null,
              ) ?? `≈ ${formatXAF(payout.amount)}`}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-[#1E3233]">{formatXAF(payout.amount)}</p>
            {payout.was_converted_to_cash && payout.tontine_contribution_kind === 'in_kind' && (
              <p className="text-[10px] text-purple-600">↪ Converti en argent</p>
            )}
          </>
        )}
        {payout.status === "paid" && !payout.receipt_signed_at && (
          <button
            onClick={() => onSign(payout)}
            className="text-xs text-[#43793F] hover:underline mt-0.5 flex items-center gap-1 ml-auto"
          >
            <PenLine size={12} /> Signer
          </button>
        )}
        {/* Bouton Corriger : visible si bordereau pas encore signé */}
        {onCorrect && !payout.receipt_pdf && payout.status !== 'cancelled' && (
          <button
            onClick={() => onCorrect(payout)}
            className="text-xs text-amber-600 hover:underline mt-0.5 flex items-center gap-1 ml-auto"
            title="Corriger ce versement (double validation Bureau)"
          >
            <AlertCircle size={12} /> Corriger
          </button>
        )}
        {payout.receipt_pdf && (
          <a
            href={payout.receipt_pdf}
            target="_blank"
            rel="noopener"
            className="text-xs text-blue-600 hover:underline mt-0.5 flex items-center gap-1 ml-auto"
          >
            <Download size={12} /> PDF
          </a>
        )}
      </div>
    </div>
  );
}

function BidRow({ bid }: { bid: AuctionBid }) {
  const initials = bid.member_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const isWon = bid.status === "won";
  return (
    <div className={`flex items-center gap-3 p-3 border-b border-gray-50 last:border-0 ${isWon ? "bg-[#F1F8E8]/50" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
        isWon ? "bg-[#43793F] text-white" : "bg-gray-100 text-gray-600"
      }`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1E3233]">{bid.member_name}</p>
      </div>
      <p className="text-sm font-bold text-[#1E3233]">{formatXAF(bid.bid_amount)}</p>
      <StatusBadge variant={isWon ? "success" : bid.status === "lost" ? "danger" : "warning"}>
        {isWon ? "Gagnant" : bid.status === "lost" ? "Perdu" : "En cours"}
      </StatusBadge>
    </div>
  );
}

// ── Page principale ──

export default function PotPage() {
  const qc = useQueryClient();
  const p = usePermissions();

  // State
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedPotId, setSelectedPotId] = useState<string>("");
  const [tab, setTab] = useState<"payouts" | "auction" | "schedule">("payouts");
  const [signingPayout, setSigningPayout] = useState<BeneficiaryPayout | null>(null);
  const [correctingPayout, setCorrectingPayout] = useState<BeneficiaryPayout | null>(null);

  // Distribution form
  const [distMemberId, setDistMemberId] = useState("");
  const [distShares, setDistShares] = useState<number | "">("");
  const [distOpen, setDistOpen] = useState(false);

  // Auction form
  const [bidMemberId, setBidMemberId] = useState("");
  const [bidAmount, setBidAmount] = useState<number | "">("");

  // Open pot form
  const [openTontineId, setOpenTontineId] = useState("");
  const [openMethod, setOpenMethod] = useState("");
  const [openReason, setOpenReason] = useState("");
  const [openPotDialog, setOpenPotDialog] = useState(false);

  // Queries
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => sessionsApi.list({ status: "in_progress" }),
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ["sessions-all"],
    queryFn: () => sessionsApi.list(),
  });

  const activeSessions = [
    ...sessions,
    ...allSessions.filter(
      (s: Session) => s.status === "completed" && !sessions.find((x: Session) => x.id === s.id)
    ),
  ].slice(0, 20);

  const { data: pots = [], isLoading: potsLoading } = useQuery({
    queryKey: ["pots", selectedSessionId],
    queryFn: () => potsApi.list({ session: selectedSessionId }),
    enabled: !!selectedSessionId,
  });

  const selectedPot = pots.find((pt: SessionPot) => pt.id === selectedPotId) || pots[0];

  const { data: bids = [] } = useQuery({
    queryKey: ["bids", selectedPot?.id],
    queryFn: () => potsApi.bids(selectedPot!.id),
    enabled: !!selectedPot && selectedPot.effective_method === "auction",
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => membersApi.list({ status: "active" }),
  });

  const { data: tontineTypes = [] } = useQuery({
    queryKey: ["tontine-types"],
    queryFn: () => tontinesApi.types({ is_active: true }),
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles"],
    queryFn: () => cyclesApi.list(),
  });

  // Mutations
  const openPotMut = useMutation({
    mutationFn: (data: { tontine_type_id: string; override_method?: string; override_reason?: string }) =>
      potsApi.openPot(selectedSessionId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pots", selectedSessionId] });
      setOpenPotDialog(false);
      setOpenTontineId("");
      setOpenMethod("");
      setOpenReason("");
    },
  });

  const distributeMut = useMutation({
    mutationFn: (data: { membership_id: string; shares_claimed?: number | null }) =>
      potsApi.distribute(selectedPot!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pots", selectedSessionId] });
      setDistMemberId("");
      setDistShares("");
      setDistOpen(false);
    },
  });

  const auctionMut = useMutation({
    mutationFn: (data: { winner_membership_id: string; bid_amount: number | string }) =>
      potsApi.processAuction(selectedPot!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pots", selectedSessionId] });
      qc.invalidateQueries({ queryKey: ["bids", selectedPot?.id] });
      setBidMemberId("");
      setBidAmount("");
    },
  });

  const placeBidMut = useMutation({
    mutationFn: (data: { pot: string; membership: string; bid_amount: number | string }) =>
      potsApi.placeBid(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bids", selectedPot?.id] });
      setBidMemberId("");
      setBidAmount("");
    },
  });

  const closePotMut = useMutation({
    mutationFn: () => potsApi.closePot(selectedPot!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pots", selectedSessionId] });
    },
  });

  // Auto-select first session
  if (!selectedSessionId && activeSessions.length > 0) {
    setSelectedSessionId(activeSessions[0].id);
  }

  const canManage = p.isPresident || p.canAny(["finance.*", "cycles.*", "*"]);
  const remainder = selectedPot ? selectedPot.total_available - selectedPot.total_distributed : 0;

  return (
    <>
      <Topbar title="Cagnotte & Distribution" />

      {/* Selecteur de session */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-gray-400" />
          <select
            value={selectedSessionId}
            onChange={(e) => { setSelectedSessionId(e.target.value); setSelectedPotId(""); }}
            className="px-3 py-2 text-sm font-medium border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#43793F]/30 min-w-[220px]"
          >
            <option value="">Selectionner une seance</option>
            {activeSessions.map((s: Session) => (
              <option key={s.id} value={s.id}>
                Seance {s.session_number} — {formatShortDate(s.date)}
                {s.status === "in_progress" ? " (en cours)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Selecteur de pot si plusieurs */}
        {pots.length > 1 && (
          <select
            value={selectedPotId || selectedPot?.id || ""}
            onChange={(e) => setSelectedPotId(e.target.value)}
            className="px-3 py-2 text-sm font-medium border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
          >
            {pots.map((pt: SessionPot) => (
              <option key={pt.id} value={pt.id}>
                {pt.tontine_name} {pt.is_closed ? "(cloture)" : ""}
              </option>
            ))}
          </select>
        )}

        {/* Ouvrir un nouveau pot */}
        {canManage && selectedSessionId && (
          <button
            onClick={() => setOpenPotDialog(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#43793F] rounded-xl hover:bg-[#356432] transition"
          >
            <Plus size={16} /> Ouvrir un pot
          </button>
        )}
      </div>

      {/* Dialog ouvrir pot */}
      {openPotDialog && (
        <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#1E3233] mb-3">Ouvrir un nouveau pot</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <select
              value={openTontineId}
              onChange={(e) => setOpenTontineId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">Type de tontine</option>
              {tontineTypes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={openMethod}
              onChange={(e) => setOpenMethod(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">Methode (laisser vide = config cycle)</option>
              {Object.entries(ACQUISITION_METHODS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Raison de l'override (optionnel)"
              value={openReason}
              onChange={(e) => setOpenReason(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <button
              disabled={!openTontineId || openPotMut.isPending}
              onClick={() => openPotMut.mutate({
                tontine_type_id: openTontineId,
                override_method: openMethod || undefined,
                override_reason: openReason || undefined,
              })}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#43793F] rounded-lg hover:bg-[#356432] transition disabled:opacity-50"
            >
              {openPotMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
              Calculer la cagnotte
            </button>
            <button onClick={() => setOpenPotDialog(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Annuler
            </button>
          </div>
          {openPotMut.isError && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} /> {(openPotMut.error as any)?.response?.data?.error || "Erreur"}
            </p>
          )}
        </div>
      )}

      {/* Etat vide */}
      {!selectedSessionId && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Clock size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Selectionnez une seance pour voir la cagnotte.</p>
        </div>
      )}

      {selectedSessionId && potsLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[#43793F]" />
        </div>
      )}

      {selectedSessionId && !potsLoading && pots.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Layers size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-3">Aucun pot ouvert pour cette seance.</p>
          {canManage && (
            <button
              onClick={() => setOpenPotDialog(true)}
              className="px-4 py-2 text-sm font-semibold text-[#43793F] border border-[#43793F] rounded-xl hover:bg-[#F1F8E8] transition"
            >
              <Plus size={14} className="inline -mt-0.5 mr-1" /> Ouvrir le premier pot
            </button>
          )}
        </div>
      )}

      {/* Contenu du pot sélectionné */}
      {selectedPot && (
        <>
          {/* En-tete du pot */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F1F8E8] text-[#43793F] flex items-center justify-center">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1E3233]">{selectedPot.tontine_name}</h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{selectedPot.method_display}</span>
                  {selectedPot.is_method_overridden && (
                    <StatusBadge variant="warning">Override</StatusBadge>
                  )}
                  {selectedPot.is_closed ? (
                    <StatusBadge variant="neutral" icon={<Lock size={10} />}>Cloture</StatusBadge>
                  ) : (
                    <StatusBadge variant="success" icon={<Unlock size={10} />}>Ouvert</StatusBadge>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            {canManage && !selectedPot.is_closed && (
              <div className="flex gap-2">
                <button
                  onClick={() => setDistOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#43793F] border border-[#43793F] rounded-xl hover:bg-[#F1F8E8] transition"
                >
                  <Gift size={14} /> Distribuer
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Cloturer ce pot ? Reliquat de ${formatXAF(remainder)} sera reporte.`)) {
                      closePotMut.mutate();
                    }
                  }}
                  disabled={closePotMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
                >
                  {closePotMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                  Cloturer
                </button>
              </div>
            )}
          </div>

          {/* KPIs */}
          <PotKpis pot={selectedPot} />

          {/* Barre reliquat */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Distribue : {formatXAF(selectedPot.total_distributed)}</span>
              <span>Reste : {formatXAF(remainder)}</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#43793F] rounded-full transition-all"
                style={{ width: `${selectedPot.total_available > 0 ? Math.min(100, (selectedPot.total_distributed / selectedPot.total_available) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-gray-100">
            {(["payouts", "auction", "schedule"] as const).map((t) => {
              if (t === "auction" && selectedPot.effective_method !== "auction") return null;
              const labels = { payouts: "Versements", auction: "Encheres", schedule: "Planning" };
              const counts = {
                payouts: selectedPot.payouts?.length || 0,
                auction: bids.length,
                schedule: 0,
              };
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-[1px] ${
                    tab === t
                      ? "border-[#43793F] text-[#43793F]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {labels[t]}
                  {counts[t] > 0 && (
                    <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {counts[t]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab: Versements */}
          {tab === "payouts" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(67,121,63,0.06)]">
              {/* Formulaire de distribution */}
              {distOpen && canManage && !selectedPot.is_closed && (
                <div className="p-4 border-b border-gray-100 bg-[#FAFDF7]">
                  <h4 className="text-sm font-semibold text-[#1E3233] mb-3">Distribuer a un beneficiaire</h4>
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={distMemberId}
                      onChange={(e) => setDistMemberId(e.target.value)}
                      className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    >
                      <option value="">Choisir un membre</option>
                      {(members as any[]).map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.user?.first_name || m.first_name} {m.user?.last_name || m.last_name} — #{m.member_number}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      placeholder="Noms (vide = tout)"
                      value={distShares}
                      onChange={(e) => setDistShares(e.target.value ? parseInt(e.target.value) : "")}
                      className="w-36 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    />
                    <button
                      disabled={!distMemberId || distributeMut.isPending}
                      onClick={() => distributeMut.mutate({
                        membership_id: distMemberId,
                        shares_claimed: distShares || null,
                      })}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#43793F] rounded-lg hover:bg-[#356432] transition disabled:opacity-50"
                    >
                      {distributeMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Verser
                    </button>
                    <button onClick={() => setDistOpen(false)} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
                      <X size={14} />
                    </button>
                  </div>
                  {distributeMut.isError && (
                    <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={12} /> {(distributeMut.error as any)?.response?.data?.error || "Erreur de distribution"}
                    </p>
                  )}
                </div>
              )}

              {/* Liste des versements */}
              {selectedPot.payouts && selectedPot.payouts.length > 0 ? (
                selectedPot.payouts.map((py: BeneficiaryPayout) => (
                  <PayoutRow
                    key={py.id}
                    payout={py}
                    onSign={setSigningPayout}
                    onCorrect={setCorrectingPayout}
                  />
                ))
              ) : (
                <div className="py-10 text-center text-sm text-gray-400">
                  <Gift size={28} className="mx-auto mb-2 text-gray-300" />
                  Aucun versement pour ce pot.
                  {canManage && !selectedPot.is_closed && (
                    <button
                      onClick={() => setDistOpen(true)}
                      className="block mx-auto mt-2 text-[#43793F] hover:underline text-xs"
                    >
                      Distribuer a un beneficiaire
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab: Enchères */}
          {tab === "auction" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(67,121,63,0.06)]">
              {/* Formulaire d'enchère */}
              {canManage && !selectedPot.is_closed && (
                <div className="p-4 border-b border-gray-100 bg-[#FAFDF7]">
                  <h4 className="text-sm font-semibold text-[#1E3233] mb-3">Nouvelle enchere</h4>
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={bidMemberId}
                      onChange={(e) => setBidMemberId(e.target.value)}
                      className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    >
                      <option value="">Choisir un encherisseur</option>
                      {(members as any[]).map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.user?.first_name || m.first_name} {m.user?.last_name || m.last_name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      placeholder="Montant enchere (XAF)"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value ? parseInt(e.target.value) : "")}
                      className="w-48 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    />
                    <button
                      disabled={!bidMemberId || !bidAmount || placeBidMut.isPending}
                      onClick={() => placeBidMut.mutate({
                        pot: selectedPot.id,
                        membership: bidMemberId,
                        bid_amount: bidAmount as number,
                      })}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#9A7A1F] rounded-lg hover:bg-[#7A6118] transition disabled:opacity-50"
                    >
                      {placeBidMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />}
                      Placer l&apos;enchere
                    </button>
                  </div>
                </div>
              )}

              {/* Liste des enchères */}
              {bids.length > 0 ? (
                <>
                  {bids.map((b: AuctionBid) => (
                    <BidRow key={b.id} bid={b} />
                  ))}
                  {/* Bouton attribuer au gagnant */}
                  {canManage && !selectedPot.is_closed && bids.some((b: AuctionBid) => b.status === "active") && (
                    <div className="p-4 border-t border-gray-100">
                      <button
                        disabled={auctionMut.isPending}
                        onClick={() => {
                          const winner = [...bids].sort((a: AuctionBid, b: AuctionBid) => b.bid_amount - a.bid_amount)[0];
                          if (winner && confirm(`Attribuer la cagnotte a ${winner.member_name} pour ${formatXAF(winner.bid_amount)} ?`)) {
                            auctionMut.mutate({
                              winner_membership_id: winner.membership,
                              bid_amount: winner.bid_amount,
                            });
                          }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#43793F] rounded-lg hover:bg-[#356432] transition disabled:opacity-50"
                      >
                        {auctionMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Attribuer au plus offrant
                      </button>
                      {auctionMut.isError && (
                        <p className="mt-2 text-xs text-red-600">
                          {(auctionMut.error as any)?.response?.data?.error || "Erreur"}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-10 text-center text-sm text-gray-400">
                  <Hammer size={28} className="mx-auto mb-2 text-gray-300" />
                  Aucune enchere placee.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal signature bordereau */}
      {signingPayout && (
        <ReceiptSigningModal
          subject={{
            title: `Bordereau — ${signingPayout.tontine_name}`,
            memberName: signingPayout.member_name,
            amount: signingPayout.amount,
            contextLine: `Seance ${signingPayout.session_number} · ${signingPayout.shares_claimed}/${signingPayout.shares_total} nom(s)`,
          }}
          signFn={(sig, dev) => potsApi.signReceipt(signingPayout.id, sig, dev)}
          onClose={() => setSigningPayout(null)}
          onSigned={() => {
            setSigningPayout(null);
            qc.invalidateQueries({ queryKey: ["pots", selectedSessionId] });
          }}
        />
      )}

      {/* Modal correction versement (double validation Bureau) */}
      {correctingPayout && (
        <ApprovalRequestModal
          title="Corriger ce versement"
          actionType="beneficiary_payout.correction"
          targetId={correctingPayout.id}
          targetLabel={`${correctingPayout.member_name} — ${correctingPayout.tontine_name}`}
          contextSummary={
            correctingPayout.is_in_kind && !correctingPayout.was_converted_to_cash
              ? `Quantité actuelle : ${correctingPayout.in_kind_quantity ?? 0} ${correctingPayout.in_kind_unit_label || ''}`
              : `Montant actuel : ${formatXAF(correctingPayout.amount)}`
          }
          fields={[
            ...(correctingPayout.tontine_contribution_kind === 'in_kind'
              ? [
                  {
                    name: 'new_amount',
                    label: `Nouvelle quantité (${correctingPayout.in_kind_unit_label || correctingPayout.tontine_in_kind_unit_label || 'unités'})`,
                    type: 'number' as const,
                    placeholder: 'Optionnel',
                  },
                ]
              : [
                  {
                    name: 'new_amount',
                    label: 'Nouveau montant (XAF)',
                    type: 'number' as const,
                    placeholder: 'Optionnel',
                  },
                ]),
            {
              name: 'new_payout_method',
              label: 'Nouveau mode de versement',
              type: 'select' as const,
              options: [
                { value: 'cash', label: 'Espèces' },
                { value: 'mobile_money', label: 'Mobile Money' },
                { value: 'bank_transfer', label: 'Virement bancaire' },
                { value: 'check', label: 'Chèque' },
              ],
            },
            {
              name: 'new_status',
              label: 'Nouveau statut',
              type: 'select' as const,
              options: [
                { value: 'pending', label: 'En attente' },
                { value: 'paid', label: 'Versé' },
                { value: 'cancelled', label: 'Annulé' },
              ],
            },
          ]}
          onClose={() => setCorrectingPayout(null)}
          onSubmitted={() => {
            setCorrectingPayout(null);
            qc.invalidateQueries({ queryKey: ["approvals"] });
            qc.invalidateQueries({ queryKey: ["pots", selectedSessionId] });
          }}
        />
      )}
    </>
  );
}
