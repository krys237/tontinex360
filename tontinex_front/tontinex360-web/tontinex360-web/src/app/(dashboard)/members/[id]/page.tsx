"use client";
import { use, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { membersApi } from "@/lib/api/members";
import { walletsApi } from "@/lib/api/wallets";
import { formatDate, formatXAF, getInitials } from "@/lib/utils/format";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useAuthStore } from "@/lib/stores/auth-store";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature/signature-pad";
import { MembershipFeesSection } from "@/components/members/membership-fees-section";
import { ApprovalRequestModal } from "@/components/approvals/approval-request-modal";
import { ScoreCard } from "@/components/ui/score-card";
import type { ApprovalActionType } from "@/lib/api/approvals";
import {
  ArrowLeft, Phone, Mail, Calendar, Briefcase, MapPin,
  PenLine, Check, Loader2, AlertCircle, Shield, UserX,
  UserMinus, Crown, Users, BadgeCheck,
} from "lucide-react";

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  active: { label: "Actif", color: "bg-emerald-100 text-emerald-700" },
  suspended: { label: "Suspendu", color: "bg-orange-100 text-orange-700" },
  expelled: { label: "Exclu", color: "bg-red-100 text-red-700" },
  resigned: { label: "Démissionnaire", color: "bg-gray-100 text-gray-700" },
};

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: member, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: () => membersApi.get(id),
  });

  if (isLoading) {
    return (
      <>
        <Topbar title="Membre" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          Chargement…
        </div>
      </>
    );
  }

  if (!member) {
    return (
      <>
        <Topbar title="Membre" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          Membre introuvable.
        </div>
      </>
    );
  }

  const status = STATUS_BADGES[member.status] ?? { label: member.status, color: "bg-gray-100 text-gray-700" };
  const fullName = `${member.user.first_name ?? ''} ${member.user.last_name ?? ''}`.trim() || member.user.telephone;

  return (
    <>
      <Topbar title="Détail membre" />

      <Link href="/members"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour
      </Link>

      <MemberHeroCard member={member} status={status} fullName={fullName} />

      {/* Frais d'adhésion (inscription + fond) */}
      <MembershipFeesSection membershipId={member.id} />

      {/* Actions bureau (double validation) */}
      <BureauActionsSection member={member} />

      {/* Signature de référence */}
      <SignatureSection member={member} />

      {member.roles && member.roles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Briefcase size={14} className="text-gray-400" /> Rôles ({member.roles.filter(r => r.is_active).length})
          </h3>
          <div className="space-y-2">
            {member.roles.map(mr => (
              <div key={mr.id} className={`flex items-center gap-3 p-2 rounded-lg ${
                mr.is_active ? "bg-gray-50" : "opacity-50 bg-gray-100"
              }`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{mr.role.name}</p>
                  <p className="text-xs text-gray-500">{mr.role.description || mr.role.permissions.join(", ")}</p>
                </div>
                {mr.role.is_bureau_role && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F1F8E8] text-[#43793F]">
                    Bureau
                  </span>
                )}
                {!mr.is_active && (
                  <span className="text-[10px] text-gray-400">Inactif</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SignatureSection({ member }: { member: any }) {
  const qc = useQueryClient();
  const padRef = useRef<SignaturePadHandle>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mut = useMutation({
    mutationFn: () => {
      const sig = padRef.current?.getDataURL();
      if (!sig) throw new Error("Signature vide.");
      return membersApi.setSignature(member.id, sig);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member", member.id] });
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === 'string' ? data : data?.error || data?.detail || err.message);
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <PenLine size={14} className="text-gray-400" /> Signature de référence
      </h3>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-2 rounded-lg mb-3 flex items-center gap-2">
          <Check size={12} /> Signature enregistrée
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-lg mb-3 flex items-start gap-2">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!editing && member.signature_reference && (
        <div className="space-y-2">
          <div className="border border-gray-200 rounded-lg p-3 inline-block bg-white">
            <img
              src={member.signature_reference}
              alt="Signature de référence"
              className="max-w-xs max-h-32 object-contain"
            />
          </div>
          <p className="text-[10px] text-gray-500">
            Enregistrée le {member.signature_reference_at ? formatDate(member.signature_reference_at) : '—'}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs text-[#43793F] hover:underline"
          >
            <PenLine size={11} /> Mettre à jour la signature
          </button>
        </div>
      )}

      {!editing && !member.signature_reference && (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Aucune signature enregistrée. Une signature de référence permet
            d'authentifier les bordereaux de réception lors des versements.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-xs font-medium rounded-lg hover:bg-[#43793F]"
          >
            <PenLine size={11} /> Enregistrer ma signature
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Signez ci-dessous avec votre doigt (mobile/tablette) ou la souris (web).
            Cette signature sera utilisée comme référence sur tous vos bordereaux.
          </p>
          <SignaturePad ref={padRef} width={500} height={180} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setError(''); mut.mutate(); }}
              disabled={mut.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
            >
              {mut.isPending && <Loader2 size={12} className="animate-spin" />}
              Enregistrer
            </button>
            <button
              onClick={() => { setEditing(false); setError(''); }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type ActionConfig = {
  actionType: ApprovalActionType;
  title: string;
  fields: any[];
  contextSummary?: string;
} | null;

function BureauActionsSection({ member }: { member: any }) {
  const qc = useQueryClient();
  const p = usePermissions();
  const { currentMembership } = useAuthStore();
  const [action, setAction] = useState<ActionConfig>(null);

  const isSelf = currentMembership?.id === member.id;
  const isBureau = p.isBureau || p.isPresident;
  if (!isBureau || isSelf) return null;

  const fullName = `${member.user.first_name ?? ''} ${member.user.last_name ?? ''}`.trim()
    || member.user.telephone;
  const isFounder = !!member.is_founder;

  const { data: bureauPositions = [] } = useQuery({
    queryKey: ["bureau-positions"],
    queryFn: () => membersApi.bureauPositions(),
  });

  const { data: bureauMembers = [] } = useQuery({
    queryKey: ["bureau-members-active", member.id],
    queryFn: () => membersApi.bureauMembers({ is_active: true }),
  });
  const memberActiveBureauRoles = bureauMembers.filter(
    (bm: any) => bm.membership?.id === member.id || bm.membership === member.id,
  );

  const openExpel = () => setAction({
    actionType: 'member.expel',
    title: 'Expulser ce membre',
    contextSummary: `Statut actuel : ${member.status}`,
    fields: [],
  });

  const openSuspend = () => setAction({
    actionType: 'member.suspend',
    title: member.status === 'suspended' ? 'Lever la suspension' : 'Suspendre ce membre',
    contextSummary: `Statut actuel : ${member.status}`,
    fields: [
      {
        name: 'action', label: 'Action', type: 'select', required: true,
        defaultValue: member.status === 'suspended' ? 'unsuspend' : 'suspend',
        options: [
          { value: 'suspend', label: 'Suspendre' },
          { value: 'unsuspend', label: 'Lever la suspension' },
        ],
      },
    ],
  });

  const openTransferFounder = () => setAction({
    actionType: 'member.transfer_founder',
    title: 'Transférer le statut de fondateur',
    contextSummary: `Le nouveau fondateur sera ${fullName}. Action IRRÉVERSIBLE.`,
    fields: [],
  });

  const openAssignBureau = () => setAction({
    actionType: 'member.designate_bureau',
    title: 'Désigner au bureau (hors élection)',
    contextSummary: `${fullName} sera nommé à une position bureau`,
    fields: [
      {
        name: 'action', label: 'Action', type: 'select', required: true,
        defaultValue: 'assign',
        options: [{ value: 'assign', label: 'Désigner' }],
      },
      {
        name: 'position_id', label: 'Position', type: 'select', required: true,
        options: bureauPositions.map((pos: any) => ({
          value: pos.id, label: pos.name,
        })),
      },
    ],
  });

  const openRevokeBureau = (bm: any) => setAction({
    actionType: 'member.designate_bureau',
    title: `Révoquer ${bm.position?.name}`,
    contextSummary: `Révocation hors élection de la position ${bm.position?.name}`,
    fields: [
      {
        name: 'action', label: 'Action', type: 'select', required: true,
        defaultValue: 'revoke',
        options: [{ value: 'revoke', label: 'Révoquer' }],
      },
      {
        name: 'bureau_member_id', label: 'ID du mandat', type: 'text',
        required: true, defaultValue: bm.id,
      },
    ],
  });

  const canExpel = !isFounder && member.status !== 'expelled';
  const canSuspend = !isFounder && member.status !== 'expelled';
  const canTransferFounder = !isFounder && member.status === 'active';
  const canAssignBureau = !isFounder && member.status === 'active';

  return (
    <>
      {action && (
        <ApprovalRequestModal
          title={action.title}
          actionType={action.actionType}
          targetId={member.id}
          targetLabel={fullName}
          contextSummary={action.contextSummary}
          fields={action.fields}
          onClose={() => setAction(null)}
          onSubmitted={() => {
            setAction(null);
            qc.invalidateQueries({ queryKey: ["approvals"] });
            qc.invalidateQueries({ queryKey: ["member", member.id] });
          }}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Shield size={14} className="text-amber-500" /> Actions bureau (double validation)
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Ces actions nécessitent l'approbation du Président + un autre membre du bureau.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {canExpel && (
            <button
              onClick={openExpel}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
            >
              <UserX size={14} /> Expulser
            </button>
          )}
          {canSuspend && (
            <button
              onClick={openSuspend}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
            >
              <UserMinus size={14} />
              {member.status === 'suspended' ? 'Lever la suspension' : 'Suspendre'}
            </button>
          )}
          {canTransferFounder && (
            <button
              onClick={openTransferFounder}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
            >
              <Crown size={14} /> Transférer fondateur
            </button>
          )}
          {canAssignBureau && (
            <button
              onClick={openAssignBureau}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
            >
              <Users size={14} /> Désigner au bureau
            </button>
          )}
        </div>

        {memberActiveBureauRoles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Mandats actifs (révocable hors élection)</p>
            <div className="space-y-1">
              {memberActiveBureauRoles.map((bm: any) => (
                <div key={bm.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                  <span className="font-medium text-gray-900">{bm.position?.name}</span>
                  <button
                    onClick={() => openRevokeBureau(bm)}
                    className="text-red-600 hover:underline"
                  >
                    Révoquer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function MemberHeroCard({
  member, status, fullName,
}: {
  member: any;
  status: { label: string; color: string };
  fullName: string;
}) {
  // Récupère le wallet du membre pour calculer le solde affiché
  const { data: allWallets = [] } = useQuery({
    queryKey: ['member-wallet-lookup', member.id],
    queryFn: () => walletsApi.list(),
  });
  const wallet = allWallets.find((w: any) => w.membership === member.id);
  const balance = Number(wallet?.balance ?? 0);

  // "Score" simple : 100 si actif + signature, sinon moins
  const score =
    (member.status === 'active' ? 60 : 0)
    + (member.has_signature ? 20 : 0)
    + (balance >= 0 ? 20 : 0);
  const scoreLabel =
    score >= 80 ? 'Très engagé' :
    score >= 60 ? 'Engagé' :
    score >= 40 ? 'Moyen' : 'À suivre';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 mb-4">
      {/* Carte gauche : avatar + infos */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-[0_2px_8px_rgba(67,121,63,0.04)]">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white text-xl sm:text-2xl font-bold shrink-0 shadow-[0_4px_12px_rgba(67,121,63,0.2)]">
            {getInitials(member.user.first_name ?? '', member.user.last_name ?? '')}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1E3233] break-words">{fullName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">#{member.member_number}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#F1F8E8] text-[#43793F]">
                {member.is_founder ? 'Fondateur' : 'Membre'}
              </span>
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${status.color}`}>
                ● {status.label}
              </span>
              {member.has_signature && (
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                  <BadgeCheck size={11} /> Signature
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Infos en grille */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm">
            <Phone size={14} className="text-gray-400" />
            <span className="text-gray-700">{member.user.telephone}</span>
          </div>
          {member.user.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail size={14} className="text-gray-400" />
              <span className="text-gray-700">{member.user.email}</span>
            </div>
          )}
          {member.user.profession && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase size={14} className="text-gray-400" />
              <span className="text-gray-700">{member.user.profession}</span>
            </div>
          )}
          {member.user.quartier && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={14} className="text-gray-400" />
              <span className="text-gray-700">{member.user.quartier}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-gray-700">
              Adhésion : {formatDate(member.joined_date)}
            </span>
          </div>
        </div>
      </div>

      {/* Carte droite : Score */}
      <ScoreCard
        score={score}
        label={scoreLabel}
        stats={[
          { label: 'Wallet', value: formatXAF(balance) },
          { label: 'Statut', value: status.label },
        ]}
      />
    </div>
  );
}
