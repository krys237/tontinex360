"use client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotifStore } from "@/lib/stores/notification-store";
import { useSidebarStore } from "@/lib/stores/sidebar-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  Bell, Search, Crown, Briefcase, User as UserIcon, Menu,
} from "lucide-react";
import Link from "next/link";
import { getInitials } from "@/lib/utils/format";

function RoleBadge() {
  const p = usePermissions();
  if (!p.membership) return null;

  if (p.isPresident) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#F1F8E8] text-[#43793F] px-2.5 py-1 rounded-full border border-[#C7E29F]">
        <Crown size={11} /> Président·e
      </span>
    );
  }
  if (p.isBureau) {
    const firstBureauRole = p.roles.find(r => r.is_bureau_role);
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#F1F8E8] text-[#43793F] px-2.5 py-1 rounded-full border border-[#C7E29F]">
        <Briefcase size={11} /> {firstBureauRole?.name ?? 'Bureau'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full border border-gray-200">
      <UserIcon size={11} /> Membre
    </span>
  );
}

export function Topbar({ title }: { title?: string }) {
  const { user, activeAssociation } = useAuthStore();
  const { unreadCount } = useNotifStore();
  const openSidebar = useSidebarStore(s => s.open);
  const greeting = user?.first_name ? `Bonjour ${user.first_name} 👋` : 'Bonjour 👋';

  return (
    <header className="flex items-center justify-between gap-3 mb-4 sm:mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 px-3 sm:px-5 py-3 sm:py-3.5">
      {/* Burger mobile + Greeting */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={openSidebar}
          className="lg:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 shrink-0"
          aria-label="Ouvrir le menu"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-gray-500 leading-none mb-0.5 sm:mb-1 truncate">
            {greeting}
          </p>
          <h1 className="text-sm sm:text-base font-bold text-[#1E3233] truncate">
            {title || activeAssociation?.name || "Dashboard"}
          </h1>
        </div>
        <div className="hidden md:block">
          <RoleBadge />
        </div>
      </div>

      {/* Right tools */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Search : caché < md, étroit md, large lg */}
        <div className="relative hidden md:block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl w-44 lg:w-64 focus:outline-none focus:ring-2 focus:ring-[#87C241]/40 focus:border-[#87C241] transition"
          />
        </div>
        <Link
          href="/notifications"
          className="relative p-2 sm:p-2.5 border border-gray-200 rounded-xl hover:bg-[#F1F8E8] hover:border-[#C7E29F] transition group"
          aria-label="Notifications"
        >
          <Bell size={16} className="text-gray-600 group-hover:text-[#43793F]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white text-[10px] sm:text-xs font-bold shadow-sm shrink-0">
          {user ? getInitials(user.first_name || '', user.last_name || '') : '?'}
        </div>
      </div>
    </header>
  );
}
