"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotifStore } from "@/lib/stores/notification-store";
import { useSidebarStore } from "@/lib/stores/sidebar-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { getInitials } from "@/lib/utils/format";
import { AssociationSwitcher } from "./association-switcher";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  LayoutDashboard, Users, Layers, Wallet, DollarSign, MessageSquare,
  FileText, Settings, LogOut, HandCoins, Heart, ChevronDown, Crown,
  Calendar, X, Gavel,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavLeaf {
  type?: "leaf";
  href: string;
  icon?: LucideIcon;
  label: string;
  visibleIf?: (p: ReturnType<typeof usePermissions>) => boolean;
  badge?: number;
}

interface NavGroup {
  type: "group";
  label: string;
  icon: LucideIcon;
  /** chemin de base pour décider de l'auto-expansion */
  basePath?: string;
  visibleIf?: (p: ReturnType<typeof usePermissions>) => boolean;
  items: NavLeaf[];
}

type NavEntry = NavLeaf | NavGroup;

interface NavSection {
  section: string;
  visibleIf?: (p: ReturnType<typeof usePermissions>) => boolean;
  items: NavEntry[];
}

function buildNav(
  p: ReturnType<typeof usePermissions>,
  unread: number,
): NavSection[] {
  return [
    {
      section: "Pilotage",
      items: [
        {
          href: "/dashboard",
          icon: LayoutDashboard,
          label: "Tableau de bord",
          visibleIf: () => !!p.membership,
        },
        {
          type: "group",
          label: "Communauté",
          icon: Users,
          basePath: "/members",
          visibleIf: () => p.isBureau,
          items: [
            {
              href: "/members",
              label: "Membres",
              visibleIf: () => p.isBureau,
            },
            {
              href: "/members/bureau",
              label: "Bureau",
              visibleIf: () => p.isBureau,
            },
            {
              href: "/members/invitations",
              label: "Invitations",
              visibleIf: () => p.canAny(["members.*", "*"]) || p.isPresident,
            },
            {
              href: "/proxies",
              label: "Procurations",
              visibleIf: () => p.isBureau,
            },
            {
              href: "/sessions",
              label: "Présences & Séances",
              visibleIf: () => p.isBureau,
            },
            {
              href: "/members/requests",
              label: "Demandes d'adhésion",
              visibleIf: () =>
                p.canAny([
                  "members.*",
                  "members.approve_request",
                  "*",
                ]) || p.isPresident,
            },
            {
              href: "/members/resignations",
              label: "Démissions",
              visibleIf: () =>
                p.canAny([
                  "members.*",
                  "members.approve_resignation",
                  "*",
                ]) || p.isPresident,
            },
          ],
        },
        {
          type: "group",
          label: "Tontines",
          icon: Layers,
          basePath: "/tontines",
          visibleIf: () => p.isBureau,
          items: [
            {
              href: "/tontines",
              label: "Types & Cycles",
              visibleIf: () => p.isBureau,
            },
            {
              href: "/sessions",
              label: "Séances",
              visibleIf: () => p.isBureau,
            },
            {
              href: "/pot",
              label: "Bénéficiaires",
              visibleIf: () => p.isBureau,
            },
          ],
        },
        {
          type: "group",
          label: "Finances",
          icon: DollarSign,
          basePath: "/finance",
          visibleIf: () =>
            p.canAny(["finance.*", "*"]) || p.isPresident || p.isBureau,
          items: [
            {
              href: "/finance/contributions",
              label: "Cotisations",
              visibleIf: () =>
                p.canAny(["finance.*", "finance.collect", "*"]) || p.isPresident,
            },
            {
              href: "/finance/loans",
              label: "Prêts",
              visibleIf: () => !!p.membership,
            },
            {
              href: "/finance",
              label: "Trésorerie",
              visibleIf: () =>
                p.canAny(["finance.*", "*"]) || p.isPresident,
            },
            {
              href: "/wallets",
              label: "Wallets",
              visibleIf: () =>
                p.canAny(["wallets.view_all", "finance.*", "*"]) ||
                p.isPresident,
            },
            {
              href: "/finance/correction-requests",
              label: "Corrections cotis.",
              visibleIf: () =>
                p.canAny(["finance.*", "*"]) || p.isPresident || p.isBureau,
            },
            {
              href: "/approvals",
              label: "Approbations",
              visibleIf: () =>
                p.canAny(["finance.*", "*"]) || p.isPresident || p.isBureau,
            },
          ],
        },
        {
          type: "group",
          label: "Gouvernance",
          icon: Crown,
          basePath: "/governance",
          visibleIf: () =>
            !!p.membership && (p.isBureau || p.canAny(["governance.*", "*"])),
          items: [
            {
              href: "/governance/elections",
              label: "Élections",
              visibleIf: () =>
                p.canAny(["governance.*", "*"]) || p.isBureau,
            },
            {
              href: "/governance/polls",
              label: "Sondages",
              visibleIf: () => true,
            },
            {
              href: "/governance/documents",
              label: "Documents",
              visibleIf: () =>
                p.canAny(["governance.*", "*"]) || p.isPresident,
            },
            {
              href: "/sanctions",
              label: "Sanctions",
              visibleIf: () =>
                p.canAny(["sanctions.*", "*"]) || p.isBureau,
            },
          ],
        },
        {
          type: "group",
          label: "Communication",
          icon: MessageSquare,
          basePath: "/chat",
          visibleIf: () => !!p.membership,
          items: [
            {
              href: "/chat",
              label: "Chat",
              visibleIf: () => p.isBureau,
            },
            {
              href: "/announcements",
              label: "Annonces",
              visibleIf: () => !!p.membership,
            },
            {
              href: "/notifications",
              label: "Notifications",
              badge: unread > 0 ? unread : undefined,
            },
          ],
        },
        {
          href: "/events",
          icon: Calendar,
          label: "Calendrier",
          visibleIf: () => p.isBureau,
        },
      ],
    },
    {
      section: "Mon espace",
      visibleIf: () => !!p.membership,
      items: [
        {
          href: "/tontines/me",
          icon: Heart,
          label: "Mes tontines",
          visibleIf: () => !!p.membership,
        },
        {
          href: "/wallets/me",
          icon: Wallet,
          label: "Mon portefeuille",
          visibleIf: () => !!p.membership,
        },
        {
          href: "/my-payouts",
          icon: HandCoins,
          label: "Mes versements",
          visibleIf: () => !!p.membership,
        },
        {
          href: "/auctions",
          icon: Gavel,
          label: "Enchères",
          visibleIf: () => !!p.membership,
        },
        {
          href: "/proxies",
          icon: FileText,
          label: "Mes procurations",
          visibleIf: () => !p.isBureau && !!p.membership,
        },
      ],
    },
  ];
}

function isActiveHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function isGroupActive(pathname: string, group: NavGroup) {
  if (group.basePath && pathname.startsWith(group.basePath)) return true;
  return group.items.some((it) => isActiveHref(pathname, it.href));
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotifStore();
  const isMobileOpen = useSidebarStore(s => s.isMobileOpen);
  const closeMobile = useSidebarStore(s => s.close);
  const p = usePermissions();

  const sections = buildNav(p, unreadCount);

  // Auto-ouvre le groupe actif au montage
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    sections.forEach((s) => {
      s.items.forEach((it) => {
        if ((it as NavGroup).type === "group") {
          const g = it as NavGroup;
          if (isGroupActive(pathname, g)) defaults[g.label] = true;
        }
      });
    });
    setOpenGroups((prev) => ({ ...defaults, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <aside
      className={`
        bg-white border-r border-gray-200 flex flex-col shrink-0
        w-[260px] sm:w-[280px] lg:w-[240px]
        fixed inset-y-0 left-0 z-40 h-screen transition-transform duration-200
        lg:sticky lg:top-0 lg:translate-x-0
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
    >
      {/* Logo brand + close mobile */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={p.landingPath}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <BrandLogo variant="full" size={36} />
          </Link>
          <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase mt-2 pl-1">
            {p.isPresident
              ? "Espace Président"
              : p.isBureau
                ? "Espace Bureau"
                : "Espace Membre"}
          </p>
        </div>
        <button
          onClick={closeMobile}
          className="lg:hidden p-1.5 -mr-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Fermer le menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Association switcher */}
      <AssociationSwitcher />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section, si) => {
          if (section.visibleIf && !section.visibleIf(p)) return null;

          const visibleItems = section.items.filter((it) => {
            if ((it as NavGroup).type === "group") {
              const g = it as NavGroup;
              if (g.visibleIf && !g.visibleIf(p)) return false;
              // Cache un groupe si AUCUN sous-item visible
              return g.items.some(
                (sub) => !sub.visibleIf || sub.visibleIf(p),
              );
            }
            const l = it as NavLeaf;
            return !l.visibleIf || l.visibleIf(p);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={si} className="mb-2">
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {section.section}
              </div>
              {visibleItems.map((entry) => {
                // Groupe dépliable
                if ((entry as NavGroup).type === "group") {
                  const g = entry as NavGroup;
                  const isOpen = openGroups[g.label] ?? isGroupActive(pathname, g);
                  const isActive = isGroupActive(pathname, g);
                  const Icon = g.icon;
                  const visibleSubItems = g.items.filter(
                    (s) => !s.visibleIf || s.visibleIf(p),
                  );

                  return (
                    <div key={g.label}>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenGroups((prev) => ({
                            ...prev,
                            [g.label]: !isOpen,
                          }))
                        }
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] border-l-[3px] transition-all ${
                          isActive
                            ? "text-[#43793F] bg-[#F1F8E8] border-[#87C241] font-semibold"
                            : "text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="flex-1 text-left truncate">
                          {g.label}
                        </span>
                        <ChevronDown
                          size={14}
                          className={`shrink-0 text-gray-400 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="pl-7 pr-2 pb-1">
                          {visibleSubItems.map((sub) => {
                            const subActive = isActiveHref(pathname, sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={`flex items-center gap-2 px-3 py-1.5 text-[12px] rounded-md transition-all ${
                                  subActive
                                    ? "text-[#43793F] bg-[#F1F8E8] font-semibold"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                }`}
                              >
                                <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-60" />
                                <span className="flex-1 truncate">
                                  {sub.label}
                                </span>
                                {sub.badge && sub.badge > 0 && (
                                  <span className="bg-[#87C241] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                                    {sub.badge}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Feuille simple
                const leaf = entry as NavLeaf;
                const active = isActiveHref(pathname, leaf.href);
                const LeafIcon = leaf.icon;
                return (
                  <Link
                    key={leaf.href}
                    href={leaf.href}
                    className={`flex items-center gap-3 px-4 py-2.5 text-[13px] border-l-[3px] transition-all ${
                      active
                        ? "text-[#43793F] bg-[#F1F8E8] border-[#87C241] font-semibold"
                        : "text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {LeafIcon && <LeafIcon size={16} className="shrink-0" />}
                    <span className="truncate">{leaf.label}</span>
                    {leaf.badge && leaf.badge > 0 && (
                      <span className="ml-auto bg-[#87C241] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {leaf.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 p-3">
        <Link
          href="/settings"
          className="flex items-center gap-2 text-gray-500 hover:text-[#43793F] text-xs mb-3 px-2 py-1.5 rounded-md hover:bg-gray-50 transition"
        >
          <Settings size={14} /> Paramètres
        </Link>
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {user ? getInitials(user.first_name || "", user.last_name || "") : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-[10px] text-gray-500 truncate">
              {p.isPresident ? "Président·e" : p.isBureau ? "Bureau" : "Membre"}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-red-500 transition p-1"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
