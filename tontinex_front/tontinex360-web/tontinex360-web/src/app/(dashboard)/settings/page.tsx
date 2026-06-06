"use client";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { User, Building2, CreditCard, Shield, ChevronRight, Bell, Coins } from "lucide-react";

export default function SettingsPage() {
  const { activeAssociation } = useAuthStore();
  const p = usePermissions();

  const items = [
    { href: "/settings/profile", icon: User, label: "Mon profil",
      description: "Modifier mes informations personnelles", visible: true },
    { href: "/notifications", icon: Bell, label: "Notifications",
      description: "Préférences de notifications", visible: true },
    { href: `/settings/association`, icon: Building2, label: "Association",
      description: "Devise, message de bienvenue, wallets, procurations", visible: p.isPresident || p.canAny(['*', 'association.update']) },
    { href: "/settings/subscription", icon: CreditCard, label: "Abonnement",
      description: "Plan, facturation, paiements", visible: p.isPresident },
    { href: "/settings/roles", icon: Shield, label: "Rôles & permissions",
      description: "Créer/modifier les rôles personnalisés", visible: p.isPresident || p.canAny(['*', 'members.*']) },
    { href: "/settings/membership-fees", icon: Coins, label: "Frais d'adhésion",
      description: "Inscription + fond de membre (montants, échelonnement, scope)", visible: p.isPresident || p.canAny(['*', 'members.*']) },
  ].filter(i => i.visible);

  return (
    <>
      <Topbar title="Paramètres" />

      <div className="grid grid-cols-2 gap-3 max-w-3xl">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-[#F1F8E8] rounded-lg flex items-center justify-center text-[#43793F]">
              <item.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
        ))}
      </div>
    </>
  );
}
