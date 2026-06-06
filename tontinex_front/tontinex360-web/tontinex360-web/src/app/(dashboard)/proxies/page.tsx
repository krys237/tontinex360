"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { proxiesApi } from "@/lib/api/proxies";
import { sessionsApi } from "@/lib/api/sessions";
import { membersApi } from "@/lib/api/members";
import { formatDate } from "@/lib/utils/format";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHero } from "@/components/ui/page-hero";
import { WorkflowSteps } from "@/components/ui/workflow-steps";
import {
  Plus, Check, X, Ban, Loader2, FileText, Send, UserCheck, UserPlus, CheckCircle2,
} from "lucide-react";

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approuvée", color: "bg-emerald-100 text-emerald-700" },
  used: { label: "Utilisée", color: "bg-blue-100 text-blue-700" },
  rejected: { label: "Rejetée", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-700" },
  expired: { label: "Expirée", color: "bg-gray-100 text-gray-500" },
};

export default function ProxiesPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const { currentMembership } = useAuthStore();
  const [tab, setTab] = useState<"mine" | "to-approve" | "received">("mine");
  const [showCreate, setShowCreate] = useState(false);

  const canApprove = p.isPresident || p.canAny(['*', 'proxies.approve']) || p.isBureau;

  const { data: proxies = [], isLoading } = useQuery({
    queryKey: ["proxies", tab, currentMembership?.id],
    queryFn: () => {
      if (!currentMembership) return [];
      if (tab === "mine") return proxiesApi.list({ principal: currentMembership.id });
      if (tab === "received") return proxiesApi.list({ proxy: currentMembership.id });
      return proxiesApi.list({ status: "pending" });
    },
    enabled: !!currentMembership,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => proxiesApi.approve(id, ""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proxies"] }),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => proxiesApi.reject(id, ""),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proxies"] }),
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => proxiesApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proxies"] }),
  });

  // Stats globales (toutes procurations) pour le hero
  const { data: allProxies = [] } = useQuery({
    queryKey: ["proxies", "all"],
    queryFn: () => proxiesApi.list(),
    enabled: canApprove,
  });

  const stats = useMemo(() => {
    const source = canApprove ? allProxies : proxies;
    return {
      total: source.length,
      pending: source.filter((p) => p.status === "pending").length,
      approved: source.filter((p) => p.status === "approved").length,
      rejected: source.filter((p) => p.status === "rejected").length,
    };
  }, [allProxies, proxies, canApprove]);

  return (
    <>
      <Topbar title="Procurations" />

      <SectionHeader
        eyebrow="Communauté"
        title="Procurations & Délégations"
        description="Gérez les représentations officielles, validations du bureau et délégations de collecte pendant les séances."
      />

      <PageHero
        title=""
        hero={{
          title: "Sécurisez les délégations de présence",
          description:
            "Validation des procurations, contrôle des représentants et gestion des documents officiels en temps réel.",
          primaryCta: {
            label: "Créer une procuration",
            onClick: () => setShowCreate(true),
            icon: <Plus size={16} />,
          },
          secondaryCta: {
            label: "Voir les validations",
            onClick: () => setTab("to-approve"),
          },
          stats: [
            { label: "Procurations actives", value: stats.approved },
            { label: "En attente validation", value: stats.pending },
            { label: "Approuvées", value: stats.approved },
            { label: "Refusées", value: stats.rejected },
          ],
          statsTitle: "Résumé Procurations",
        }}
      />

      <WorkflowSteps
        title="Workflow des Procurations"
        description="Cycle complet de validation et de consommation."
        steps={[
          {
            icon: Send,
            label: "Création",
            description: "Le membre principal crée la procuration officielle.",
          },
          {
            icon: UserCheck,
            label: "Validation",
            description: "Le bureau vérifie et approuve la délégation.",
          },
          {
            icon: UserPlus,
            label: "Représentation",
            description: "Le proxy collecte et représente pendant la séance.",
          },
          {
            icon: CheckCircle2,
            label: "Consommée",
            description: "La procuration est utilisée automatiquement.",
          },
        ]}
      />

      {/* Onglets + bouton */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setTab("mine")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === "mine" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Mes procurations
          </button>
          <button
            onClick={() => setTab("received")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === "received" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Reçues
          </button>
          {canApprove && (
            <button
              onClick={() => setTab("to-approve")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === "to-approve" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              À approuver
            </button>
          )}
        </div>

        {tab === "mine" && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] transition"
          >
            <Plus size={14} /> Nouvelle procuration
          </button>
        )}
      </div>

      {showCreate && currentMembership && (
        <CreateProxyModal
          principalId={currentMembership.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["proxies"] });
          }}
        />
      )}

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          Chargement…
        </div>
      )}

      {!isLoading && proxies.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          Aucune procuration.
        </div>
      )}

      <div className="space-y-3">
        {proxies.map(pr => {
          const status = STATUS_BADGES[pr.status] ?? { label: pr.status, color: "bg-gray-100 text-gray-700" };
          const isMine = pr.principal === currentMembership?.id;
          const isPending = pr.status === "pending";
          const isApproved = pr.status === "approved";

          return (
            <div key={pr.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#F1F8E8] flex items-center justify-center text-[#43793F] shrink-0">
                  <FileText size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">
                      {pr.principal_name} → {pr.proxy_name}
                    </p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">
                    Séance n°{pr.session_number ?? '—'} ·
                    {pr.session_date ? ` ${formatDate(pr.session_date)} ·` : ''}
                    {pr.tontine_name ? ` ${pr.tontine_name}` : ' Toutes tontines'}
                  </p>
                  {pr.reason && (
                    <p className="text-sm text-gray-600 italic mt-1">« {pr.reason} »</p>
                  )}
                  {pr.review_note && (
                    <p className="text-xs text-gray-500 mt-1">
                      Note : {pr.review_note}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    {tab === "to-approve" && isPending && canApprove && (
                      <>
                        <button
                          onClick={() => approveMut.mutate(pr.id)}
                          disabled={approveMut.isPending}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {approveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Approuver
                        </button>
                        <button
                          onClick={() => rejectMut.mutate(pr.id)}
                          disabled={rejectMut.isPending}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {rejectMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                          Rejeter
                        </button>
                      </>
                    )}
                    {isMine && (isPending || isApproved) && (
                      <button
                        onClick={() => cancelMut.mutate(pr.id)}
                        disabled={cancelMut.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        {cancelMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CreateProxyModal({
  principalId, onClose, onCreated,
}: {
  principalId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [proxyMember, setProxyMember] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [tontineType, setTontineType] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => membersApi.list({ status: "active" }),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions", "scheduled"],
    queryFn: () => sessionsApi.list({ status: "scheduled" }),
  });

  const createMut = useMutation({
    mutationFn: () => proxiesApi.create({
      proxy: proxyMember,
      session: sessionId,
      tontine_type: tontineType || null,
      reason,
    } as any),
    onSuccess: () => onCreated(),
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.detail || "Erreur lors de la création");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Nouvelle procuration</h3>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Procurataire (membre actif) *</label>
            <select
              value={proxyMember}
              onChange={e => setProxyMember(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
            >
              <option value="">Choisir un membre…</option>
              {members.filter(m => m.id !== principalId).map(m => (
                <option key={m.id} value={m.id}>{m.user_name} (#{m.member_number})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Séance *</label>
            <select
              value={sessionId}
              onChange={e => setSessionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
            >
              <option value="">Choisir une séance…</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  Séance n°{s.session_number} · {formatDate(s.date)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Tontine (optionnel)</label>
            <input
              type="text"
              value={tontineType}
              onChange={e => setTontineType(e.target.value)}
              placeholder="ID de la tontine ou laisser vide pour toutes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Motif</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Raison de la procuration…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#43793F]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !proxyMember || !sessionId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-sm rounded-lg hover:bg-[#43793F] disabled:opacity-50"
          >
            {createMut.isPending && <Loader2 size={12} className="animate-spin" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}
