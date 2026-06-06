"use client";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { membersApi } from "@/lib/api/members";
import { formatXAF } from "@/lib/utils/format";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import { X, Loader2, Download, FileCheck, AlertCircle } from "lucide-react";

export interface SignReceiptResult {
  receipt_number?: string;
  receipt_hash?: string;
  receipt_pdf?: string | null;
}

export interface ReceiptSubject {
  title: string;
  memberName: string;
  amount: number | string;
  contextLine?: string;
}

interface Props {
  subject: ReceiptSubject;
  referenceSignatureUrl?: string | null;
  membershipId?: string;
  signFn: (signature: string, deviceInfo: Record<string, any>) => Promise<SignReceiptResult>;
  onClose: () => void;
  onSigned: (result: SignReceiptResult) => void;
}

export function ReceiptSigningModal({
  subject, referenceSignatureUrl, membershipId, signFn, onClose, onSigned,
}: Props) {
  const liveRef = useRef<SignaturePadHandle>(null);
  const refRef = useRef<SignaturePadHandle>(null);
  const [error, setError] = useState("");
  const [also_save_as_reference, setAlsoSaveAsRef] = useState(!referenceSignatureUrl);
  const [signedResult, setSignedResult] = useState<SignReceiptResult | null>(null);

  const collectDeviceInfo = () => ({
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    language: typeof navigator !== 'undefined' ? navigator.language : 'fr',
    screen: typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'unknown',
  });

  const signMut = useMutation({
    mutationFn: async () => {
      const liveSig = liveRef.current?.getDataURL();
      if (!liveSig) throw new Error("Veuillez signer dans la zone du jour.");

      if (!referenceSignatureUrl && also_save_as_reference && membershipId) {
        const refSig = refRef.current?.getDataURL() ?? liveSig;
        try {
          await membersApi.setSignature(membershipId, refSig);
        } catch (e) {
          console.warn("Échec enregistrement signature de référence", e);
        }
      }

      return await signFn(liveSig, collectDeviceInfo());
    },
    onSuccess: (updated) => {
      setSignedResult(updated);
      onSigned(updated);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(
        typeof data === 'string' ? data
        : data?.error || data?.detail || err.message || "Erreur de signature",
      );
    },
  });

  if (signedResult?.receipt_pdf) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FileCheck size={24} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Bordereau signé ✓</h3>
          {signedResult.receipt_number && (
            <p className="text-sm text-gray-500 mb-4">
              Reçu n° <strong>{signedResult.receipt_number}</strong>
            </p>
          )}

          {signedResult.receipt_hash && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-left mb-4">
              <p className="text-gray-500 mb-1">Hash d'intégrité (SHA-256)</p>
              <p className="font-mono text-[10px] break-all text-gray-700">
                {signedResult.receipt_hash}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <a
              href={signedResult.receipt_pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
            >
              <Download size={14} /> Télécharger le PDF
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold">{subject.title}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="bg-[#F1F8E8] rounded-lg p-3">
            <p className="text-lg font-semibold text-gray-900">{subject.memberName}</p>
            <p className="text-2xl font-bold text-[#43793F] mt-1">
              {formatXAF(Number(subject.amount))}
            </p>
            {subject.contextLine && (
              <p className="text-xs text-gray-500 mt-1">{subject.contextLine}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {referenceSignatureUrl ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Signature de référence</p>
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-white" style={{ height: 180 }}>
                  <img
                    src={referenceSignatureUrl}
                    alt="Signature de référence"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Enregistrée précédemment</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Signature du jour *</p>
                <SignaturePad ref={liveRef} width={300} height={180} />
              </div>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs p-2 rounded-lg">
                ℹ Aucune signature de référence enregistrée pour ce membre.
                Vous pouvez signer une fois et l'enregistrer comme référence
                pour les futurs bordereaux.
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Signature du jour *</p>
                <SignaturePad ref={liveRef} width={500} height={180} />
              </div>

              {membershipId && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={also_save_as_reference}
                    onChange={(e) => setAlsoSaveAsRef(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700">
                    Enregistrer aussi comme <strong>signature de référence</strong> du membre
                    (gain de temps pour les futurs bordereaux)
                  </span>
                </label>
              )}

              {membershipId && !also_save_as_reference && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">
                    Signature de référence (optionnel — différente)
                  </p>
                  <SignaturePad ref={refRef} width={500} height={180} />
                </div>
              )}
            </>
          )}

          <p className="text-[10px] text-gray-500 italic">
            En signant, le bénéficiaire confirme l'opération indiquée.
            Un bordereau PDF horodaté avec hash d'intégrité sera généré automatiquement.
          </p>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => { setError(''); signMut.mutate(); }}
            disabled={signMut.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {signMut.isPending && <Loader2 size={12} className="animate-spin" />}
            Signer et générer le bordereau
          </button>
        </div>
      </div>
    </div>
  );
}
