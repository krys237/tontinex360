"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { sessionsApi } from "@/lib/api/sessions";
import { potsApi } from "@/lib/api/pots";
import { membersApi } from "@/lib/api/members";
import { formatDate, formatXAF, getInitials } from "@/lib/utils/format";
import { ATTENDANCE_STATUS, SESSION_STATUS } from "@/lib/utils/constants";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { RequirePermission } from "@/components/auth/require-permission";
import { ReceiptSigningModal } from "@/components/signature/receipt-signing-modal";
import { ApprovalRequestModal } from "@/components/approvals/approval-request-modal";
import { SessionLocationPicker } from "@/components/sessions/session-location-picker";
import { cyclesApi } from "@/lib/api/cycles";
import type { BeneficiaryPayout } from "@/lib/types/pot";
import {
  ArrowLeft, Calendar, MapPin, Users, Layers, Check, X, Loader2,
  PlayCircle, StopCircle, Hammer, PenLine, FileText, Download, Ban, Home,
} from "lucide-react";

const SOURCE_BADGES: Record<string, string> = {
  scheduled: "Tour de rôle",
  auction: "Enchère",
  vote: "Vote",
  need: "Besoin",
  manual: "Manuel",
};

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const p = usePermissions();
  const [selectedTab, setSelectedTab] = useState<"attendances" | "pots">("attendances");
  const [signingPayout, setSigningPayout] = useState<BeneficiaryPayout | null>(null);
  const [cancellingSession, setCancellingSession] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [draftLocation, setDraftLocation] = useState<{
    location: string; host_member: string | null;
  }>({ location: '', host_member: null });

  const { data: session } = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionsApi.get(id),
  });

  const { data: attendances = [] } = useQuery({
    queryKey: ["attendances", id],
    queryFn: () => sessionsApi.attendances(id),
  });

  const { data: pots = [] } = useQuery({
    queryKey: ["pots", id],
    queryFn: () => potsApi.list({ session: id }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => membersApi.list({ status: "active" }),
  });

  const setAttendanceMut = useMutation({
    mutationFn: (data: { membership: string; status: any }) =>
      sessionsApi.setAttendance({ session: id, membership: data.membership, status: data.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendances", id] }),
  });

  const closePotMut = useMutation({
    mutationFn: (potId: string) => potsApi.closePot(potId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pots", id] }),
  });

  const { data: cycle } = useQuery({
    queryKey: ["cycle", id, "for-location"],
    queryFn: () => cyclesApi.get((session as any)?.cycle),
    enabled: !!(session as any)?.cycle,
  });

  const updateLocationMut = useMutation({
    mutationFn: (data: { location: string; host_member: string | null }) =>
      sessionsApi.update(id, data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", id] });
      setEditingLocation(false);
    },
  });

  // Suggestion d'hôte = 1er bénéficiaire de la séance (pour tontines random)
  const firstPayout = pots
    .flatMap((p: any) => p.payouts ?? [])
    .find((p: any) => p?.member_name);
  const suggestedHostId = firstPayout?.membership ?? null;
  const suggestedHostLabel = firstPayout?.member_name ?? null;

  if (!session) {
    return <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">Chargement…</div>;
  }

  const st = SESSION_STATUS[session.status as keyof typeof SESSION_STATUS];
  const presentCount = attendances.filter(a => a.status === "present" || a.status === "late").length;
  const canManage = p.isPresident || p.canAny(['*', 'cycles.*', 'sessions.manage']);
  const canRecordAttendance = p.isBureau;

  return (
    <>
      <Topbar title={`Séance n°${session.session_number}`} />

      {cancellingSession && (
        <ApprovalRequestModal
          title="Annuler la séance"
          actionType="session.cancel"
          targetId={id}
          targetLabel={`Séance n°${session.session_number}`}
          contextSummary="Triple validation requise (Président + 2 membres bureau distincts)."
          fields={[]}
          onClose={() => setCancellingSession(false)}
          onSubmitted={() => {
            setCancellingSession(false);
            qc.invalidateQueries({ queryKey: ["approvals"] });
            qc.invalidateQueries({ queryKey: ["session", id] });
          }}
        />
      )}

      {signingPayout && (
        <ReceiptSigningModal
          subject={{
            title: "Bordereau de réception",
            memberName: signingPayout.member_name,
            amount: Number(signingPayout.amount),
            contextLine: `${signingPayout.tontine_name} · Séance n°${signingPayout.session_number} · ${signingPayout.method_display}`,
          }}
          referenceSignatureUrl={null}
          membershipId={signingPayout.membership}
          signFn={(signature, deviceInfo) =>
            potsApi.signReceipt(signingPayout.id, signature, deviceInfo)
          }
          onClose={() => setSigningPayout(null)}
          onSigned={() => {
            setSigningPayout(null);
            qc.invalidateQueries({ queryKey: ["pots", id] });
          }}
        />
      )}

      <Link href="/sessions" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Séance n°{session.session_number}</h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-600 flex-wrap">
              <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(session.date)}</span>
              {(session as any).host_member_name ? (
                <span className="flex items-center gap-1">
                  <Home size={14} /> Chez <strong className="ml-1">{(session as any).host_member_name}</strong>
                  {session.location && <span className="text-gray-500">— {session.location}</span>}
                </span>
              ) : session.location && (
                <span className="flex items-center gap-1"><MapPin size={14} /> {session.location}</span>
              )}
              <span className="flex items-center gap-1"><Users size={14} /> {presentCount}/{attendances.length} présents</span>
              {(p.isBureau || p.isPresident) && !['completed', 'cancelled'].includes(session.status) && (
                <button
                  onClick={() => {
                    setDraftLocation({
                      location: session.location ?? '',
                      host_member: (session as any).host_member ?? null,
                    });
                    setEditingLocation(true);
                  }}
                  className="text-xs text-[#43793F] hover:underline inline-flex items-center gap-1"
                >
                  <PenLine size={11} /> {((session as any).host_member || session.location) ? 'Modifier le lieu' : 'Définir le lieu'}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${st?.color}`}>
              {st?.label || session.status}
            </span>
            {(p.isBureau || p.isPresident) && ['scheduled', 'in_progress', 'postponed'].includes(session.status) && (
              <button
                onClick={() => setCancellingSession(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
                title="Annuler cette séance (triple validation)"
              >
                <Ban size={11} /> Annuler
              </button>
            )}
          </div>
        </div>

        {session.notes && <p className="text-sm text-gray-600 italic">« {session.notes} »</p>}

        {editingLocation && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <SessionLocationPicker
              defaultCycleLocation={cycle?.default_session_location ?? null}
              hostMemberId={(session as any).host_member ?? null}
              location={session.location ?? ''}
              suggestedHostId={suggestedHostId}
              suggestedHostLabel={suggestedHostLabel}
              onChange={(next) => setDraftLocation(next)}
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => setEditingLocation(false)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={() => updateLocationMut.mutate(draftLocation)}
                disabled={updateLocationMut.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-xs rounded-lg disabled:opacity-50"
              >
                {updateLocationMut.isPending && <Loader2 size={11} className="animate-spin" />}
                Enregistrer le lieu
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setSelectedTab("attendances")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            selectedTab === "attendances"
              ? "border-[#43793F] text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Présences
        </button>
        <button
          onClick={() => setSelectedTab("pots")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            selectedTab === "pots"
              ? "border-[#43793F] text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Cagnottes
        </button>
      </div>

      {selectedTab === "attendances" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {members.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400">Aucun membre actif.</p>
          )}
          <div className="divide-y divide-gray-100">
            {members.map(m => {
              const att = attendances.find(a => a.member_name === m.user_name);
              const status = att?.status ?? "absent";
              const badge = ATTENDANCE_STATUS[status as keyof typeof ATTENDANCE_STATUS];
              const [first = '', last = ''] = (m.user_name || '').split(' ');

              return (
                <div key={m.id} className="flex items-center gap-3 p-3">
                  <div className="w-8 h-8 rounded-full bg-[#43793F] flex items-center justify-center text-white text-[10px] font-medium">
                    {getInitials(first, last)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{m.user_name}</p>
                    <p className="text-xs text-gray-500">#{m.member_number}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge?.color}`}>
                    {badge?.label}
                  </span>
                  {canRecordAttendance && (
                    <select
                      value={status}
                      onChange={e => setAttendanceMut.mutate({ membership: m.id, status: e.target.value })}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="present">Présent</option>
                      <option value="absent">Absent</option>
                      <option value="excused">Excusé</option>
                      <option value="late">Retard</option>
                      <option value="represented">Représenté</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedTab === "pots" && (
        <div className="space-y-3">
          {pots.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
              Aucune cagnotte ouverte. {canManage && "Cliquer sur \"Ouvrir un pot\" depuis cette séance."}
            </div>
          )}
          {pots.map(pot => (
            <div key={pot.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Layers size={14} className="text-[#43793F]" />
                    {pot.tontine_name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Méthode : <span className="font-medium">{SOURCE_BADGES[pot.effective_method] ?? pot.effective_method}</span>
                  </p>
                </div>
                {pot.is_closed ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    Clôturée
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Ouverte
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Collecté</p>
                  <p className="text-sm font-semibold">{formatXAF(Number(pot.total_collected))}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Distribué</p>
                  <p className="text-sm font-semibold text-emerald-600">{formatXAF(Number(pot.total_distributed))}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Reliquat</p>
                  <p className="text-sm font-semibold">{formatXAF(Number(pot.remainder))}</p>
                </div>
              </div>

              {pot.payouts && pot.payouts.length > 0 && (
                <div className="border-t border-gray-100 pt-3 space-y-1">
                  <p className="text-xs font-medium text-gray-700 mb-1">Bénéficiaires</p>
                  {pot.payouts.map(po => (
                    <div key={po.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 text-gray-700">{po.member_name}</span>
                      <span className="text-gray-500">{po.shares_claimed}/{po.shares_total} parts</span>
                      <span className="font-medium text-emerald-600">{formatXAF(Number(po.amount))}</span>
                      {po.has_receipt ? (
                        <a
                          href={po.receipt_pdf ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                          title={`Bordereau ${po.receipt_number}`}
                        >
                          <FileText size={12} /> {po.receipt_number}
                          <Download size={10} />
                        </a>
                      ) : (
                        <RequirePermission anyOf={['*', 'cycles.*']} bureau>
                          <button
                            onClick={() => setSigningPayout(po as any)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#43793F] text-white text-[10px] rounded hover:bg-[#43793F]"
                          >
                            <PenLine size={10} /> Signer
                          </button>
                        </RequirePermission>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <RequirePermission anyOf={['*', 'cycles.*']} bureau>
                {!pot.is_closed && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => closePotMut.mutate(pot.id)}
                      disabled={closePotMut.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                    >
                      {closePotMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <StopCircle size={12} />}
                      Clôturer le pot
                    </button>
                    <p className="text-[10px] text-gray-500">
                      La clôture déclenche la distribution sur les wallets (primes, intérêts, sanctions, défauts).
                    </p>
                  </div>
                )}
              </RequirePermission>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
