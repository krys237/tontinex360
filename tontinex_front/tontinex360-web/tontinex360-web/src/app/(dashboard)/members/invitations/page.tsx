"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { invitationsApi } from "@/lib/api/invitations";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHero } from "@/components/ui/page-hero";
import { formatDate, formatRelative } from "@/lib/utils/format";
import {
  Send, BarChart3, MessageCircle, Smartphone, Mail, Search, Filter,
} from "lucide-react";

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  accepted: { label: "Acceptée", color: "bg-emerald-100 text-emerald-700" },
  declined: { label: "Refusée", color: "bg-red-100 text-red-700" },
  expired: { label: "Expirée", color: "bg-gray-100 text-gray-500" },
  revoked: { label: "Révoquée", color: "bg-gray-100 text-gray-500" },
};

export default function InvitationsDashboardPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["invitations", "all"],
    queryFn: () => invitationsApi.list(),
  });

  const stats = useMemo(() => {
    const total = invitations.length;
    const accepted = invitations.filter((i) => i.status === "accepted").length;
    const pending = invitations.filter((i) => i.status === "pending").length;
    const expired = invitations.filter(
      (i) => i.status === "expired" || i.status === "revoked",
    ).length;
    const channelStats: Record<string, { total: number; accepted: number }> = {};
    invitations.forEach((i) => {
      if (!channelStats[i.channel]) {
        channelStats[i.channel] = { total: 0, accepted: 0 };
      }
      channelStats[i.channel].total += 1;
      if (i.status === "accepted") channelStats[i.channel].accepted += 1;
    });
    return { total, accepted, pending, expired, channelStats };
  }, [invitations]);

  const filtered = useMemo(() => {
    return invitations.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const haystack = [inv.name, inv.email, inv.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [invitations, search, statusFilter]);

  const channelRate = (c: string) => {
    const s = stats.channelStats[c];
    if (!s || s.total === 0) return "—";
    return `${Math.round((s.accepted / s.total) * 100)}%`;
  };

  return (
    <>
      <Topbar title="Invitations" />

      <SectionHeader
        eyebrow="Communauté"
        title="Invitations & Onboarding"
        description="Invitez de nouveaux membres, suivez les acceptations et gérez l'intégration dans l'association."
      />

      <PageHero
        title=""
        hero={{
          title: "Gérez vos invitations intelligemment",
          description:
            "Invitations WhatsApp, SMS ou email avec suivi en temps réel des validations, expirations et adhésions.",
          primaryCta: {
            label: "Envoyer une invitation",
            onClick: () => (window.location.href = "/members/invite"),
            icon: <Send size={16} />,
          },
          secondaryCta: {
            label: "Voir les statistiques",
            onClick: () => {
              const el = document.getElementById("invitations-table");
              el?.scrollIntoView({ behavior: "smooth" });
            },
          },
          stats: [
            { label: "Total envoyées", value: stats.total },
            { label: "Acceptées", value: stats.accepted },
            { label: "En attente", value: stats.pending },
            { label: "Expirées", value: stats.expired },
          ],
          statsTitle: "Performance Invitations",
        }}
      />

      {/* Méthodes d'Invitation */}
      <div className="mb-6">
        <h3 className="text-base font-semibold text-[#1E3233]">
          Méthodes d'Invitation
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Choisissez le canal de communication adapté.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ChannelCard
            icon={MessageCircle}
            tint="bg-emerald-50 text-emerald-600"
            name="WhatsApp"
            description="Partage rapide via lien d'invitation sécurisé directement sur WhatsApp."
            metricLabel="Taux de conversion"
            metricValue={channelRate("whatsapp")}
            ctaLabel="Inviter via WhatsApp"
            ctaHref="/members/invite?channel=whatsapp"
          />
          <ChannelCard
            icon={Smartphone}
            tint="bg-blue-50 text-blue-600"
            name="SMS"
            description="Notification accessible même sans smartphone ou connexion Internet."
            metricLabel="Taux de lecture"
            metricValue={channelRate("sms")}
            ctaLabel="Envoyer un SMS"
            ctaHref="/members/invite?channel=sms"
          />
          <ChannelCard
            icon={Mail}
            tint="bg-purple-50 text-purple-600"
            name="Email"
            description="Email professionnel avec détails complets de l'association."
            metricLabel="Ouverture moyenne"
            metricValue={channelRate("email")}
            ctaLabel="Envoyer un email"
            ctaHref="/members/invite?channel=email"
          />
        </div>
      </div>

      {/* Invitations récentes */}
      <div
        id="invitations-table"
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-[#1E3233]">
              Invitations Récentes
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Suivi en temps réel des invitations envoyées.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#43793F]/30 w-full sm:w-56"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            >
              <option value="">Tous statuts</option>
              {Object.entries(STATUS_BADGES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && (
          <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">
            Aucune invitation pour le moment.
          </p>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-[#F1F8E8]/40">
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Invité</th>
                <th className="px-4 py-3 font-medium">Canal</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inv) => {
                const status =
                  STATUS_BADGES[inv.status] ?? {
                    label: inv.status,
                    color: "bg-gray-100 text-gray-700",
                  };
                return (
                  <tr key={inv.id} className="hover:bg-[#F1F8E8]/30 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1E3233]">
                        {inv.name || inv.email || inv.phone || "Sans nom"}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {inv.email || inv.phone}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {inv.channel}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-[13px]">
                      {formatRelative(inv.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}
                      >
                        ● {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inv.status === "pending" && (
                        <Link
                          href={`/members/invite?reuse=${inv.id}`}
                          className="text-[12px] text-[#43793F] font-medium hover:underline"
                        >
                          Relancer
                        </Link>
                      )}
                      {inv.status === "accepted" && inv.resulting_membership && (
                        <Link
                          href={`/members/${inv.resulting_membership}`}
                          className="text-[12px] text-[#43793F] font-medium hover:underline"
                        >
                          Voir le profil
                        </Link>
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
    </>
  );
}

function ChannelCard({
  icon: Icon,
  tint,
  name,
  description,
  metricLabel,
  metricValue,
  ctaLabel,
  ctaHref,
}: {
  icon: any;
  tint: string;
  name: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_2px_8px_rgba(67,121,63,0.04)]">
      <div className={`w-10 h-10 ${tint} rounded-xl flex items-center justify-center mb-3`}>
        <Icon size={18} />
      </div>
      <h4 className="text-base font-bold text-[#1E3233]">{name}</h4>
      <p className="text-xs text-gray-500 mt-1 leading-snug">{description}</p>
      <div className="bg-[#F1F8E8]/60 rounded-lg p-2.5 mt-3">
        <p className="text-[10px] text-gray-500 uppercase">{metricLabel}</p>
        <p className="text-lg font-bold text-[#43793F] mt-0.5">{metricValue}</p>
      </div>
      <Link
        href={ctaHref}
        className="block text-center mt-3 px-3 py-2 bg-[#43793F] text-white text-xs font-medium rounded-lg hover:bg-[#43793F]"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
