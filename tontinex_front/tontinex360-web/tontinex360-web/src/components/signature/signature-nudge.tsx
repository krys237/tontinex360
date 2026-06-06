"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { membersApi } from "@/lib/api/members";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import { PenLine, X, Loader2, Check } from "lucide-react";

/**
 * Banner qui s'affiche tant que le membre n'a pas enregistré sa signature
 * de référence. Peut être dismissé pour la session (sessionStorage).
 */
export function SignatureNudge() {
  const qc = useQueryClient();
  const { currentMembership } = useAuthStore();
  const padRef = useRef<SignaturePadHandle>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(
    typeof window !== 'undefined'
      ? sessionStorage.getItem('signature_nudge_dismissed') === '1'
      : false,
  );
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      const sig = padRef.current?.getDataURL();
      if (!sig) throw new Error("Veuillez signer dans la zone.");
      if (!currentMembership) throw new Error("Membership non trouvé.");
      return membersApi.setSignature(currentMembership.id, sig);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["current-membership"] });
      setSuccess(true);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === 'string' ? data : data?.error || data?.detail || err.message);
    },
  });

  // Cacher si signature déjà enregistrée ou pas de membership ou dismissed
  if (!currentMembership) return null;
  if ((currentMembership as any).has_signature || (currentMembership as any).signature_reference) return null;
  if (dismissed) return null;

  if (success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-3">
        <Check size={16} className="text-emerald-600" />
        <p className="text-sm text-emerald-700">Signature enregistrée. Merci !</p>
        <button
          onClick={() => setSuccess(false)}
          className="ml-auto text-emerald-600 hover:text-emerald-800"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="bg-[#F1F8E8] border border-[#43793F]/30 rounded-xl p-4 mb-4 flex items-start gap-3">
        <div className="w-9 h-9 bg-[#43793F] rounded-lg flex items-center justify-center text-white shrink-0">
          <PenLine size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 mb-0.5">
            Enregistrez votre signature de référence
          </p>
          <p className="text-xs text-gray-600">
            Une signature unique enregistrée à l'avance vous fera gagner
            du temps sur tous les bordereaux à venir (versements, cotisations, sanctions…).
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#43793F] text-white text-xs font-medium rounded-lg hover:bg-[#43793F]"
          >
            <PenLine size={11} /> Signer maintenant
          </button>
          <button
            onClick={() => {
              sessionStorage.setItem('signature_nudge_dismissed', '1');
              setDismissed(true);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-700"
            title="Plus tard"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-[#43793F]/30 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Votre signature de référence</p>
          <p className="text-xs text-gray-500">
            Signez avec le doigt (mobile/tablette) ou la souris (web).
          </p>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="text-gray-400 hover:text-gray-700"
        >
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-lg mb-2">
          {error}
        </div>
      )}

      <SignaturePad ref={padRef} width={500} height={150} />

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => { setError(''); mut.mutate(); }}
          disabled={mut.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
        >
          {mut.isPending && <Loader2 size={12} className="animate-spin" />}
          Enregistrer ma signature
        </button>
        <Link
          href={`/members/${currentMembership.id}`}
          className="px-3 py-1.5 text-xs text-[#43793F] hover:underline"
        >
          Voir sur ma fiche →
        </Link>
      </div>
    </div>
  );
}
