"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { membersApi } from "@/lib/api/members";
import { formatDate, getInitials } from "@/lib/utils/format";
import { Check, X, Loader2 } from "lucide-react";

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approuvée", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejetée", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-700" },
};

export default function ResignationsPage() {
  const qc = useQueryClient();
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [effectiveDate, setEffectiveDate] = useState<Record<string, string>>({});

  const { data: resignations = [], isLoading } = useQuery({
    queryKey: ["resignations"],
    queryFn: () => membersApi.resignations(),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, note, effective }: { id: string; note: string; effective?: string }) =>
      membersApi.approveResignation(id, {
        review_note: note,
        ...(effective ? { effective_date: effective } : {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resignations"] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      membersApi.rejectResignation(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resignations"] }),
  });

  return (
    <>
      <Topbar title="Démissions" />

      <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
        <Link href="/members"
          className="px-4 py-2 text-sm text-gray-500 border-b-2 border-transparent hover:text-gray-700">
          Tous les membres
        </Link>
        <Link href="/members/requests"
          className="px-4 py-2 text-sm text-gray-500 border-b-2 border-transparent hover:text-gray-700">
          Demandes d&apos;adhésion
        </Link>
        <Link href="/members/resignations"
          className="px-4 py-2 text-sm font-medium border-b-2 border-[#43793F] text-gray-900">
          Démissions
        </Link>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
            Chargement…
          </div>
        )}
        {!isLoading && resignations.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
            Aucune démission.
          </div>
        )}
        {resignations.map(r => {
          const [first = '', last = ''] = (r.membership.user_name || '').split(' ');
          const status = STATUS_BADGES[r.status] ?? { label: r.status, color: "bg-gray-100 text-gray-700" };
          const isPending = r.status === "pending";

          return (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#43793F] flex items-center justify-center text-white text-xs font-medium shrink-0">
                  {getInitials(first, last)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900">{r.membership.user_name}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {r.membership.user_telephone} · #{r.membership.member_number} ·
                    Soumise le {formatDate(r.created_at)}
                    {r.effective_date && ` · Effet : ${formatDate(r.effective_date)}`}
                  </p>

                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2 mb-3">
                    Motif : « {r.reason} »
                  </p>

                  {r.status !== "pending" && r.review_note && (
                    <p className="text-xs text-gray-500 italic mb-2">
                      Note du bureau : {r.review_note}
                    </p>
                  )}

                  {isPending && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                        <textarea
                          value={reviewNote[r.id] ?? ""}
                          onChange={e => setReviewNote(s => ({ ...s, [r.id]: e.target.value }))}
                          placeholder="Note du bureau (optionnel)"
                          rows={2}
                          className="text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
                        />
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Date d&apos;effet</label>
                          <input
                            type="date"
                            value={effectiveDate[r.id] ?? r.effective_date ?? ""}
                            onChange={e => setEffectiveDate(s => ({ ...s, [r.id]: e.target.value }))}
                            className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveMut.mutate({
                            id: r.id,
                            note: reviewNote[r.id] ?? "",
                            effective: effectiveDate[r.id] || r.effective_date || undefined,
                          })}
                          disabled={approveMut.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          {approveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Approuver la démission
                        </button>
                        <button
                          onClick={() => rejectMut.mutate({ id: r.id, note: reviewNote[r.id] ?? "" })}
                          disabled={rejectMut.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                        >
                          {rejectMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                          Rejeter
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
