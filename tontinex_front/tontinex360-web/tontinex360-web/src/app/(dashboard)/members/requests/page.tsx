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

export default function MembershipRequestsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["membership-requests", filter],
    queryFn: () => membersApi.membershipRequests(filter ? { status: filter } : undefined),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      membersApi.approveMembershipRequest(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership-requests"] }),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      membersApi.rejectMembershipRequest(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership-requests"] }),
  });

  return (
    <>
      <Topbar title="Demandes d&apos;adhésion" />

      <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
        <Link href="/members"
          className="px-4 py-2 text-sm text-gray-500 border-b-2 border-transparent hover:text-gray-700">
          Tous les membres
        </Link>
        <Link href="/members/requests"
          className="px-4 py-2 text-sm font-medium border-b-2 border-[#43793F] text-gray-900">
          Demandes d&apos;adhésion
        </Link>
        <Link href="/members/resignations"
          className="px-4 py-2 text-sm text-gray-500 border-b-2 border-transparent hover:text-gray-700">
          Démissions
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {[
          { v: "pending", l: "En attente" },
          { v: "approved", l: "Approuvées" },
          { v: "rejected", l: "Rejetées" },
          { v: "", l: "Toutes" },
        ].map(b => (
          <button
            key={b.v}
            onClick={() => setFilter(b.v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full ${
              filter === b.v
                ? "bg-[#43793F] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {b.l}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
            Chargement…
          </div>
        )}
        {!isLoading && requests.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
            Aucune demande.
          </div>
        )}
        {requests.map(r => {
          const fullName = `${r.user.first_name ?? ''} ${r.user.last_name ?? ''}`.trim() || r.user.telephone;
          const status = STATUS_BADGES[r.status] ?? { label: r.status, color: "bg-gray-100 text-gray-700" };
          const isPending = r.status === "pending";

          return (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#43793F] flex items-center justify-center text-white text-xs font-medium shrink-0">
                  {getInitials(r.user.first_name ?? '', r.user.last_name ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900">{fullName}</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {r.user.telephone}
                    {r.contact_email ? ` · ${r.contact_email}` : ""} · {formatDate(r.created_at)}
                  </p>

                  {r.motivation && (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2 mb-3">
                      « {r.motivation} »
                    </p>
                  )}

                  {r.status !== "pending" && r.review_note && (
                    <p className="text-xs text-gray-500 italic mb-2">
                      Note du bureau : {r.review_note}
                    </p>
                  )}

                  {isPending && (
                    <>
                      <textarea
                        value={reviewNote[r.id] ?? ""}
                        onChange={e => setReviewNote(s => ({ ...s, [r.id]: e.target.value }))}
                        placeholder="Note (optionnel)"
                        rows={2}
                        className="w-full text-sm border border-gray-200 rounded-lg p-2 mb-2 focus:outline-none focus:ring-2 focus:ring-[#43793F]/30"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveMut.mutate({ id: r.id, note: reviewNote[r.id] ?? "" })}
                          disabled={approveMut.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          {approveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Approuver
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
