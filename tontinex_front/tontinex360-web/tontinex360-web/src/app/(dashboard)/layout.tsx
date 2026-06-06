"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotifStore } from "@/lib/stores/notification-store";
import { useSidebarStore } from "@/lib/stores/sidebar-store";
import { authApi } from "@/lib/api/auth";
import { notificationsApi } from "@/lib/api/notifications";
import { useCurrentMembership } from "@/lib/hooks/use-current-membership";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { AuthDebug } from "@/components/debug/auth-debug";

// Pages accessibles à tout membre actif (lambda compris)
const MEMBER_PREFIXES = [
  '/wallets/me',
  '/proxies',
  '/notifications',
  '/settings/profile',
  '/forbidden',
  '/no-association',
];

// Pages accessibles sans aucune association (onboarding)
const NO_TENANT_PREFIXES = [
  '/no-association',
  '/associations/create',
  '/settings/profile',
];

function isMemberRoute(pathname: string): boolean {
  return MEMBER_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

function isNoTenantRoute(pathname: string): boolean {
  return NO_TENANT_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user, associations, activeAssociation,
    setUser, setAssociations, setActiveAssociation,
  } = useAuthStore();
  const { setUnreadCount } = useNotifStore();
  const { membership, isLoading: membershipLoading } = useCurrentMembership();
  const p = usePermissions();
  const [bootstrapped, setBootstrapped] = useState(false);

  // Bootstrap : charger user + associations
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      router.replace("/login");
      return;
    }

    const bootstrap = async () => {
      try {
        if (!user) {
          const me = await authApi.me();
          setUser(me);
        }
        if (associations.length === 0) {
          const { associations: list, active_slug } = await authApi.myAssociations();
          setAssociations(list);
          const slug = active_slug || localStorage.getItem("active_association");
          const active = list.find(x => x.slug === slug) || list[0];
          if (active) setActiveAssociation(active);
        }
      } catch {
        router.replace("/login");
        return;
      }
      setBootstrapped(true);
    };
    bootstrap();

    notificationsApi.unreadCount().then(setUnreadCount).catch(() => {});
  }, []);

  // Redirection si pas d'association
  useEffect(() => {
    if (!bootstrapped) return;
    if (associations.length === 0 && !isNoTenantRoute(pathname)) {
      router.replace('/no-association');
    }
  }, [bootstrapped, associations.length, pathname]);

  // Garde rôle-aware : un membre lambda ne peut accéder qu'aux pages /membres.
  // On n'agit JAMAIS pendant le chargement du membership pour éviter les
  // redirections intempestives (race condition « lambda apparent puis bureau »).
  useEffect(() => {
    if (!bootstrapped || !activeAssociation || !membership || membershipLoading) return;
    if (p.isLambda && !isMemberRoute(pathname)) {
      router.replace('/forbidden');
    }
  }, [bootstrapped, membership, membershipLoading, pathname, p.isLambda, activeAssociation]);

  const sidebarOpen = useSidebarStore(s => s.isMobileOpen);
  const closeSidebar = useSidebarStore(s => s.close);

  // Ferme la sidebar mobile au changement de route
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          aria-hidden="true"
        />
      )}

      <Sidebar />

      <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto min-w-0">
        {children}
      </main>
      <AuthDebug />
    </div>
  );
}
