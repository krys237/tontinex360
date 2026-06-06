"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Loader2 } from "lucide-react";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useCurrentMembership } from "@/lib/hooks/use-current-membership";

export default function ForbiddenPage() {
  const router = useRouter();
  const p = usePermissions();
  const { isLoading } = useCurrentMembership();

  // Si l'utilisateur EST en réalité bureau (membership chargé entre-temps),
  // on le redirige automatiquement vers sa page d'atterrissage.
  useEffect(() => {
    if (!isLoading && p.isBureau) {
      router.replace(p.landingPath);
    }
  }, [isLoading, p.isBureau, p.landingPath]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
        <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={24} className="text-red-600" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          Accès refusé
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          Cette page est réservée aux membres du bureau ayant les permissions requises.
          Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez le président de votre association.
        </p>
        <Link
          href={p.landingPath}
          className="inline-block px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] transition"
        >
          Retour à votre tableau
        </Link>
      </div>
    </div>
  );
}
