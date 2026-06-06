"use client";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";

export default function NoAssociationPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
        <div className="w-14 h-14 bg-[#F1F8E8] rounded-xl flex items-center justify-center mx-auto mb-4">
          <Building2 size={24} className="text-[#43793F]" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          Aucune association
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          Vous n&apos;êtes membre d&apos;aucune association. Vous pouvez en créer une
          (vous en serez fondateur et président) ou attendre une invitation.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/associations/create"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] transition"
          >
            <Plus size={14} /> Créer une association
          </Link>
          <p className="text-xs text-gray-400">
            Vous avez reçu une invitation par e-mail / SMS&nbsp;?
            Cliquez sur le lien d&apos;invitation pour rejoindre l&apos;association.
          </p>
        </div>
      </div>
    </div>
  );
}
