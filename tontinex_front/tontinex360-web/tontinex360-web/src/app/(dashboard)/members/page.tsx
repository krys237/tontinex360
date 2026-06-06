"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { membersApi } from "@/lib/api/members";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { getInitials } from "@/lib/utils/format";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { SectionHeader } from "@/components/ui/section-header";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Search, UserPlus, ChevronRight, FileSpreadsheet, Coins,
  Users, UserCheck, Clock, UserMinus,
} from "lucide-react";

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  active: { label: "Actif", color: "bg-emerald-100 text-emerald-700" },
  suspended: { label: "Suspendu", color: "bg-orange-100 text-orange-700" },
  expelled: { label: "Exclu", color: "bg-red-100 text-red-700" },
  resigned: { label: "Démissionnaire", color: "bg-gray-100 text-gray-700" },
};

export default function MembersPage() {
  const p = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", debouncedSearch, statusFilter],
    queryFn: () =>
      membersApi.list({
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  });

  // Pour les KPIs : on récupère TOUS les membres sans filtre (cache séparé)
  const { data: allMembers = [] } = useQuery({
    queryKey: ["members", "all"],
    queryFn: () => membersApi.list(),
  });

  const stats = useMemo(() => {
    const total = allMembers.length;
    const active = allMembers.filter((m) => m.status === "active").length;
    const pending = allMembers.filter((m) => m.status === "pending").length;
    const suspended = allMembers.filter(
      (m) => m.status === "suspended" || m.status === "expelled",
    ).length;
    return { total, active, pending, suspended };
  }, [allMembers]);

  const canInvite = p.isPresident || p.canAny(["members.*", "members.invite"]);

  return (
    <>
      <Topbar title="Membres" />

      <SectionHeader
        eyebrow="Communauté"
        title="Gestion des Membres"
        description="Gérez les adhérents, rôles, statuts, présences et informations communautaires de votre association."
        actions={
          canInvite && (
            <>
              <Link
                href="/members/fees-overview"
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                <Coins size={14} /> Frais d'adhésion
              </Link>
              <Link
                href="/members/import"
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                <FileSpreadsheet size={14} /> Importer
              </Link>
              <Link
                href="/members/invite"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] transition"
              >
                <UserPlus size={14} /> Ajouter un membre
              </Link>
            </>
          )
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard
          icon={Users}
          label="Membres actifs"
          value={stats.active}
          sublabel={`${stats.total} membres total`}
          tint="primary"
        />
        <KpiCard
          icon={UserCheck}
          label="Présence moyenne"
          value={stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : "—"}
          sublabel="Membres actifs / total"
          tint="primary"
        />
        <KpiCard
          icon={Clock}
          label="Demandes en attente"
          value={stats.pending}
          sublabel="À traiter par le bureau"
          tint="accent"
        />
        <KpiCard
          icon={UserMinus}
          label="Suspendus / exclus"
          value={stats.suspended}
          sublabel="Sanctionnés ou exclus"
          tint="danger"
        />
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-[#1E3233]">
              Liste des Membres
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {members.length} membre{members.length > 1 ? "s" : ""} enregistré
              {members.length > 1 ? "s" : ""} dans l'association.
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
                placeholder="Rechercher un membre…"
                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#43793F]/30 w-full sm:w-56 lg:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
            >
              <option value="">Tous statuts</option>
              <option value="active">Actif</option>
              <option value="pending">En attente</option>
              <option value="suspended">Suspendu</option>
              <option value="resigned">Démissionnaire</option>
              <option value="expelled">Exclu</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading && (
          <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>
        )}
        {!isLoading && members.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">
            Aucun membre ne correspond à ces critères.
          </p>
        )}
        {members.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-[#F1F8E8]/40">
              <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Membre</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => {
                const [first = "", last = ""] = (m.user_name || "").split(" ");
                const status =
                  STATUS_BADGES[m.status] ?? {
                    label: m.status,
                    color: "bg-gray-100 text-gray-700",
                  };
                return (
                  <tr
                    key={m.id}
                    className="hover:bg-[#F1F8E8]/30 transition"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/members/${m.id}`}
                        className="flex items-center gap-2.5"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                          {getInitials(first, last)}
                        </div>
                        <div>
                          <p className="font-medium text-[#1E3233]">
                            {m.user_name}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            #{m.member_number}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F1F8E8] text-[#43793F]">
                        {m.is_founder ? "Fondateur" : "Membre"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}
                      >
                        ● {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-[13px]">
                      {m.user_telephone}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/members/${m.id}`}
                        className="text-gray-400 hover:text-[#43793F] transition"
                      >
                        <ChevronRight size={16} />
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
