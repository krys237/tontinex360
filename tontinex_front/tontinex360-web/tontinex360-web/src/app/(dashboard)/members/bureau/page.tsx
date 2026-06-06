"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { membersApi } from "@/lib/api/members";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHero } from "@/components/ui/page-hero";
import { KpiCard } from "@/components/ui/kpi-card";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatDate, getInitials } from "@/lib/utils/format";
import {
  Crown, Users, BadgeCheck, ChevronRight, UserPlus, Settings as SettingsIcon,
} from "lucide-react";

export default function BureauPage() {
  const p = usePermissions();
  const canManage =
    p.isPresident || p.canAny(["members.*", "members.designate_bureau", "*"]);

  const { data: positions = [], isLoading: loadingPositions } = useQuery({
    queryKey: ["bureau-positions"],
    queryFn: () => membersApi.bureauPositions(),
  });

  const { data: bureauMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["bureau-members", "active"],
    queryFn: () => membersApi.bureauMembers({ is_active: true }),
  });

  // Regroupe les mandats actifs par position
  const byPosition = useMemo(() => {
    const m: Record<string, typeof bureauMembers> = {};
    bureauMembers.forEach((bm) => {
      const slug = bm.position?.slug || bm.position?.id;
      if (!slug) return;
      if (!m[slug]) m[slug] = [];
      m[slug].push(bm);
    });
    return m;
  }, [bureauMembers]);

  const filledCount = bureauMembers.length;
  const requiredCount = positions.filter((p) => p.is_required).length;
  const totalPositions = positions.length;
  const vacancies = Math.max(0, requiredCount - filledCount);

  return (
    <>
      <Topbar title="Bureau" />

      <SectionHeader
        eyebrow="Communauté"
        title="Bureau de l'Association"
        description="Gérez les responsables, les mandats, les responsabilités officielles et l'organisation communautaire."
        actions={
          canManage && (
            <Link
              href="/governance/elections"
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              <SettingsIcon size={14} /> Élections / Mandats
            </Link>
          )
        }
      />

      <PageHero
        title=""
        hero={{
          title: "Gouvernance active",
          description:
            "Le bureau supervise les finances, les validations, les séances générales et l'organisation stratégique de l'association.",
          primaryCta: {
            label: "Voir les responsables",
            onClick: () => {
              const el = document.getElementById("bureau-list");
              el?.scrollIntoView({ behavior: "smooth" });
            },
            icon: <Users size={16} />,
          },
          ...(canManage && {
            secondaryCta: {
              label: "Configurer les postes",
              onClick: () =>
                (window.location.href = "/governance/elections"),
            },
          }),
          stats: [
            { label: "Postes actifs", value: filledCount },
            { label: "Postes requis", value: requiredCount },
            { label: "Postes total", value: totalPositions },
            { label: "À pourvoir", value: vacancies },
          ],
          statsTitle: "Structure du bureau",
        }}
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={Crown} label="Postes occupés" value={filledCount} tint="primary" />
        <KpiCard
          icon={Users}
          label="Postes requis"
          value={requiredCount}
          sublabel="Définis par l'association"
          tint="primary"
        />
        <KpiCard
          icon={BadgeCheck}
          label="Postes total"
          value={totalPositions}
          tint="accent"
        />
        <KpiCard
          icon={UserPlus}
          label="À pourvoir"
          value={vacancies}
          tint={vacancies > 0 ? "danger" : "primary"}
        />
      </div>

      <div id="bureau-list">
        <h2 className="text-base font-semibold text-[#1E3233] mb-1">
          Responsables Officiels
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Membres actifs du bureau exécutif.
        </p>

        {(loadingPositions || loadingMembers) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-sm text-gray-400">
            Chargement…
          </div>
        )}

        {!loadingPositions && positions.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Crown size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-600">
              Aucune position de bureau définie pour cette association.
            </p>
            {canManage && (
              <Link
                href="/governance/elections"
                className="inline-flex items-center gap-1 mt-3 text-xs text-[#43793F] hover:underline"
              >
                Configurer les positions →
              </Link>
            )}
          </div>
        )}

        {positions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {positions
              .sort((a, b) => a.display_order - b.display_order)
              .map((pos) => {
                const holders = byPosition[pos.slug] || byPosition[pos.id] || [];
                const isVacant = holders.length === 0;
                return (
                  <div
                    key={pos.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-[0_2px_8px_rgba(67,121,63,0.04)]"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {pos.is_required ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Requis
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Optionnel
                        </span>
                      )}
                      {isVacant && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          ● Vacant
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-[#1E3233]">
                      {pos.name}
                    </h3>
                    {pos.description && (
                      <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">
                        {pos.description}
                      </p>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {isVacant ? (
                        <p className="text-xs text-gray-400 italic">
                          Aucun titulaire actuellement.
                        </p>
                      ) : (
                        holders.map((bm) => {
                          const [first = "", last = ""] = (
                            bm.membership?.user_name || ""
                          ).split(" ");
                          return (
                            <Link
                              key={bm.id}
                              href={`/members/${bm.membership?.id}`}
                              className="flex items-center gap-2 p-2 -mx-2 rounded-lg hover:bg-[#F1F8E8]/40 transition group"
                            >
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                                {getInitials(first, last)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[#1E3233] truncate">
                                  {bm.membership?.user_name || "—"}
                                </p>
                                <p className="text-[10px] text-gray-500 truncate">
                                  Depuis {formatDate(bm.start_date)}
                                  {bm.end_date
                                    ? ` · jusqu'au ${formatDate(bm.end_date)}`
                                    : ""}
                                </p>
                              </div>
                              <ChevronRight
                                size={14}
                                className="text-gray-300 group-hover:text-[#43793F] shrink-0"
                              />
                            </Link>
                          );
                        })
                      )}
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
