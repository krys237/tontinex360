"use client";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { membersApi } from "@/lib/api/members";
import { sessionsApi } from "@/lib/api/sessions";
import { financeApi } from "@/lib/api/finance";
import { tontinesApi } from "@/lib/api/tontines";
import { cyclesApi } from "@/lib/api/cycles";
import { invitationsApi } from "@/lib/api/invitations";
import { walletsApi } from "@/lib/api/wallets";
import { potsApi } from "@/lib/api/pots";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useCurrentMembership } from "@/lib/hooks/use-current-membership";
import { RequirePermission } from "@/components/auth/require-permission";
import { SignatureNudge } from "@/components/signature/signature-nudge";
import { formatXAF, formatShortDate, formatRelative, getInitials } from "@/lib/utils/format";
import { SESSION_STATUS } from "@/lib/utils/constants";
import {
  Users, DollarSign, TrendingUp, CalendarDays,
  Plus, UserPlus, CreditCard, Layers, Settings,
  CheckCircle2, Circle, Loader2, Send, Mail, Phone,
  Wallet, HandCoins, Heart, FileCheck, FileText,
} from "lucide-react";
import Link from "next/link";
import { PageHero } from "@/components/ui/page-hero";

function MemberDashboard({
  memberName, walletBalance, subscriptionCount, payoutCount, nextSession,
}: {
  memberName: string;
  walletBalance: number;
  subscriptionCount: number;
  payoutCount: number;
  nextSession?: { id: string; date: string; session_number: number; location?: string };
}) {
  return (
    <>
      <div className="bg-gradient-to-br from-[#43793F] to-[#87C241] rounded-2xl p-6 mb-6 text-white">
        <p className="text-sm opacity-90">Bonjour {memberName} 👋</p>
        <h1 className="text-2xl font-bold mt-1">Mon espace membre</h1>
        <p className="text-sm opacity-90 mt-1">
          Retrouvez vos tontines, votre portefeuille et vos versements en un coup d'œil.
        </p>
        {nextSession && (
          <div className="bg-white/15 backdrop-blur rounded-xl p-3 mt-4 flex items-center gap-3">
            <CalendarDays size={20} />
            <div className="flex-1">
              <p className="text-xs opacity-90">Prochaine séance</p>
              <p className="text-sm font-semibold">
                N°{nextSession.session_number} ·{" "}
                {formatShortDate(nextSession.date)}
                {nextSession.location ? ` · ${nextSession.location}` : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Link
          href="/wallets/me"
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_8px_rgba(67,121,63,0.06)] hover:shadow-[0_4px_12px_rgba(67,121,63,0.1)] transition"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Mon portefeuille
            </p>
            <div className="w-9 h-9 bg-[#F1F8E8] text-[#43793F] rounded-full flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
          <p
            className={`text-2xl font-bold ${
              walletBalance >= 0 ? "text-[#43793F]" : "text-red-600"
            }`}
          >
            {walletBalance >= 0 ? "+" : ""}
            {formatXAF(walletBalance)}
          </p>
        </Link>

        <Link
          href="/tontines/me"
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_8px_rgba(67,121,63,0.06)] hover:shadow-[0_4px_12px_rgba(67,121,63,0.1)] transition"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Mes tontines
            </p>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
              <Heart size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#1E3233]">
            {subscriptionCount}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            {subscriptionCount === 0 ? "Souscrivez à une tontine →" : "Voir mes souscriptions →"}
          </p>
        </Link>

        <Link
          href="/my-payouts"
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_8px_rgba(67,121,63,0.06)] hover:shadow-[0_4px_12px_rgba(67,121,63,0.1)] transition"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Versements reçus
            </p>
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
              <HandCoins size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-[#1E3233]">{payoutCount}</p>
          <p className="text-[10px] text-gray-500 mt-1">Voir l'historique →</p>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            href: "/tontines/me",
            icon: Heart,
            label: "Souscrire à une tontine",
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
          {
            href: "/finance/loans",
            icon: FileCheck,
            label: "Demander un prêt",
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            href: "/proxies",
            icon: FileText,
            label: "Donner procuration",
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            href: "/governance/polls",
            icon: CheckCircle2,
            label: "Voter aux sondages",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-[#43793F] hover:bg-[#F1F8E8] transition group"
          >
            <div
              className={`w-9 h-9 ${a.bg} ${a.color} rounded-lg flex items-center justify-center shrink-0`}
            >
              <a.icon size={18} />
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#43793F]">
              {a.label}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

function KpiCard({ icon: Icon, iconBg, label, value, unit, change }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_8px_rgba(67,121,63,0.06)] hover:shadow-[0_4px_12px_rgba(67,121,63,0.1)] transition">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</p>
        <div className={`w-9 h-9 ${iconBg} rounded-full flex items-center justify-center`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-[#1E3233]">{value}</span>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
        {change && (
          <span className={`text-xs font-semibold ${change > 0 ? "text-[#43793F]" : "text-red-500"}`}>
            {change > 0 ? "↑" : "↓"} {change}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const p = usePermissions();
  const { currentMembership, activeAssociation } = useAuthStore();
  const { isLoading: membershipLoading } = useCurrentMembership();

  const canSeeMembers = p.isPresident || p.canAny(['members.*', '*']);
  const canSeeFinance = p.isPresident || p.canAny(['finance.*', '*']);
  const canSeeSessions = p.isBureau;
  const showMemberView = !!p.membership && !p.isBureau;
  const associationName = activeAssociation?.name || "votre association";

  const { data: members } = useQuery({
    queryKey: ["members"],
    queryFn: () => membersApi.list(),
    enabled: canSeeMembers,
  });
  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => sessionsApi.list(),
    enabled: canSeeSessions,
  });
  const { data: treasury } = useQuery({
    queryKey: ["treasury"],
    queryFn: () => financeApi.treasury(),
    enabled: canSeeFinance,
  });
  const { data: tontineTypes } = useQuery({
    queryKey: ["tontine-types"],
    queryFn: () => tontinesApi.types(),
    enabled: p.isBureau,
  });
  const { data: cycles } = useQuery({
    queryKey: ["cycles"],
    queryFn: () => cyclesApi.list(),
    enabled: p.isBureau,
  });
  const { data: invitations } = useQuery({
    queryKey: ["invitations", "pending"],
    queryFn: () => invitationsApi.list({ status: "pending" }),
    enabled: canSeeMembers,
  });

  // ── Données spécifiques au "Mode membre simple" ─────────────────────
  const { data: myWallet } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => walletsApi.myWallet(),
    enabled: showMemberView,
  });
  const { data: mySubscriptions = [] } = useQuery({
    queryKey: ['my-subscriptions', currentMembership?.id],
    queryFn: () => tontinesApi.subscriptions(),
    enabled: showMemberView && !!currentMembership,
    select: (all) => all.filter(s => s.membership === currentMembership?.id),
  });
  const { data: myPayouts = [] } = useQuery({
    queryKey: ['my-payouts', currentMembership?.id],
    queryFn: () => potsApi.payouts(),
    enabled: showMemberView && !!currentMembership,
    select: (all) => all.filter(p => p.membership === currentMembership?.id),
  });
  const { data: upcomingSessions = [] } = useQuery({
    queryKey: ['upcoming-sessions'],
    queryFn: () => sessionsApi.list({ status: 'scheduled' }),
    enabled: showMemberView,
  });

  const activeMembers = members?.filter(m => m.is_active).length || 0;
  const totalBalance = treasury?.reduce((s, a) => s + Number(a.balance ?? 0), 0) || 0;
  const nextSession = sessions?.find(s => s.status === "scheduled");

  // État de démarrage : aucune tontine, aucun cycle, peu de membres ?
  const showOnboarding = p.isPresident
    && (tontineTypes?.length ?? 0) === 0
    && (cycles?.length ?? 0) === 0;

  // Pendant le chargement du membership, on évite la page vide
  if (membershipLoading && !p.membership) {
    return (
      <>
        <Topbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar />

      <SignatureNudge />

      {/* ─── MODE MEMBRE SIMPLE ───────────────────────────────────── */}
      {showMemberView && (
        <MemberDashboard
          memberName={`${currentMembership?.user?.first_name ?? ''}`}
          walletBalance={Number(myWallet?.balance ?? 0)}
          subscriptionCount={mySubscriptions.length}
          payoutCount={myPayouts.filter(p => p.status === 'paid').length}
          nextSession={upcomingSessions[0]}
        />
      )}

      {/* Hero bureau — affiche le nom RÉEL de l'association */}
      {p.isBureau && !showOnboarding && (
        <PageHero
          breadcrumb="Tableau de bord"
          title={associationName}
          description="Vue d'ensemble en temps réel de l'activité de l'association."
          hero={{
            title: associationName,
            description: "Pilotage en temps réel — cotisations, prêts et cycles en un coup d'œil.",
            primaryCta: {
              label: "Ouvrir une séance",
              onClick: () => window.location.assign("/sessions/create"),
              icon: <Plus size={16} />,
            },
            secondaryCta: {
              label: "Voir les finances",
              onClick: () => window.location.assign("/finance"),
            },
            stats: [
              { label: "Membres actifs", value: activeMembers },
              { label: "Trésorerie", value: formatXAF(totalBalance).replace(" XAF", "") + " XAF" },
              { label: "Cycles actifs", value: cycles?.length ?? 0 },
              { label: "Séances", value: sessions?.length ?? 0 },
            ],
            statsTitle: "Vue d'ensemble",
          }}
        />
      )}

      {showOnboarding && (
        <div className="bg-gradient-to-br from-[#F1F8E8] to-white border border-[#43793F]/20 rounded-xl p-5 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            Bienvenue président·e ! 👋
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Pour démarrer votre association, voici les étapes recommandées :
          </p>
          <div className="space-y-2">
            {[
              {
                href: "/settings/association",
                icon: Settings,
                label: "Configurer l'association",
                desc: "Devise, message de bienvenue, règles wallet/procurations",
                done: !!p.membership?.association && !!(p.membership as any)?.welcome_message,
              },
              {
                href: "/tontines",
                icon: Layers,
                label: "Créer le 1er type de tontine",
                desc: "Définir le mode de cotisation, le montant, etc.",
                done: (tontineTypes?.length ?? 0) > 0,
              },
              {
                href: "/tontines",
                icon: CalendarDays,
                label: "Démarrer un cycle",
                desc: "Période d'activité (généralement 1 an)",
                done: (cycles?.length ?? 0) > 0,
              },
              {
                href: "/members/invite",
                icon: UserPlus,
                label: "Inviter les premiers membres",
                desc: "Envoi par email, SMS ou lien",
                done: (members?.length ?? 0) > 1,
              },
            ].map((step, i) => (
              <Link
                key={i}
                href={step.href}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-[#43793F] transition group"
              >
                {step.done
                  ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  : <Circle size={18} className="text-gray-300 shrink-0" />}
                <step.icon size={16} className="text-[#43793F] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{step.label}</p>
                  <p className="text-xs text-gray-500">{step.desc}</p>
                </div>
                <span className="text-xs text-gray-400 group-hover:text-[#43793F]">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <RequirePermission anyOf={['members.*', '*']} president fallback={null}>
          <KpiCard
            icon={Users} iconBg="bg-emerald-50 text-emerald-600"
            label="Membres actifs" value={activeMembers}
          />
        </RequirePermission>

        <RequirePermission anyOf={['finance.*', '*']} president fallback={null}>
          <KpiCard
            icon={DollarSign} iconBg="bg-[#F1F8E8] text-[#43793F]"
            label="Trésorerie" value={formatXAF(totalBalance).replace(" XAF", "")} unit="XAF"
          />
        </RequirePermission>

        <RequirePermission president fallback={null}>
          <KpiCard
            icon={TrendingUp} iconBg="bg-purple-50 text-purple-600"
            label="Taux cotisation" value="—"
          />
        </RequirePermission>

        <RequirePermission bureau fallback={null}>
          <KpiCard
            icon={CalendarDays} iconBg="bg-blue-50 text-blue-600"
            label="Prochaine séance"
            value={nextSession ? formatShortDate(nextSession.date) : "—"}
          />
        </RequirePermission>
      </div>

      {/* Actions rapides — visibles selon permissions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { href: "/sessions/create", icon: Plus, label: "Nouvelle séance",
            color: "text-[#43793F]", visible: p.isBureau },
          { href: "/members/invite", icon: UserPlus, label: "Inviter membre",
            color: "text-emerald-600", visible: canSeeMembers },
          { href: "/finance/contributions", icon: CreditCard, label: "Saisir cotisations",
            color: "text-purple-600", visible: canSeeFinance },
          { href: "/sessions", icon: Layers, label: "Distribuer cagnotte",
            color: "text-blue-600", visible: p.isBureau },
          { href: "/finance/loans", icon: DollarSign, label: "Gérer prêts",
            color: "text-amber-600", visible: canSeeFinance },
        ].filter(a => a.visible).map(a => (
          <Link key={a.href} href={a.href}
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition text-sm font-medium text-gray-700">
            <a.icon size={16} className={a.color} /> {a.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {canSeeSessions && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="text-sm font-semibold text-gray-900">Séances récentes</h2>
              <Link href="/sessions" className="text-xs text-[#43793F]">Voir tout</Link>
            </div>
            <div className="px-4 pb-4 space-y-1">
              {(sessions || []).slice(0, 5).map(s => {
                const st = SESSION_STATUS[s.status as keyof typeof SESSION_STATUS];
                return (
                  <Link key={s.id} href={`/sessions/${s.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                      s.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                      s.status === "scheduled" ? "bg-blue-50 text-blue-600" :
                      "bg-amber-50 text-amber-600"
                    }`}>S{s.session_number}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">Séance {s.session_number}</p>
                      <p className="text-xs text-gray-500">
                        {formatShortDate(s.date)}{s.location ? ` — ${s.location}` : ""}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      st?.color || "bg-gray-100 text-gray-600"
                    }`}>
                      {st?.label || s.status}
                    </span>
                  </Link>
                );
              })}
              {(!sessions || sessions.length === 0) && (
                <p className="text-sm text-gray-400 py-4 text-center">Aucune séance pour le moment</p>
              )}
            </div>
          </div>
        )}

        {canSeeMembers && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="text-sm font-semibold text-gray-900">Membres récents</h2>
                <Link href="/members" className="text-xs text-[#43793F]">Tous</Link>
              </div>
              <div className="px-4 pb-4 space-y-1">
                {(members || []).slice(0, 4).map(m => {
                  const [first = '', last = ''] = (m.user_name || '').split(' ');
                  return (
                    <Link key={m.id} href={`/members/${m.id}`}
                      className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-gray-50">
                      <div className="w-7 h-7 rounded-full bg-[#43793F] flex items-center justify-center text-white text-[10px] font-medium">
                        {getInitials(first, last)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{m.user_name}</p>
                        <p className="text-[10px] text-gray-500">#{m.member_number}</p>
                      </div>
                    </Link>
                  );
                })}
                {(!members || members.length === 0) && (
                  <p className="text-xs text-gray-400 py-2 text-center">Aucun membre</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Send size={12} className="text-[#43793F]" />
                  Invitations en attente
                  {invitations && invitations.length > 0 && (
                    <span className="bg-[#43793F] text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {invitations.length}
                    </span>
                  )}
                </h2>
                <Link href="/members/invite" className="text-xs text-[#43793F]">+ Inviter</Link>
              </div>
              <div className="px-4 pb-4 space-y-1.5">
                {(!invitations || invitations.length === 0) && (
                  <p className="text-xs text-gray-400 py-2 text-center">
                    Aucune invitation en attente
                  </p>
                )}
                {(invitations || []).slice(0, 5).map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#F1F8E8] flex items-center justify-center text-[#43793F]">
                      {inv.channel === "email" ? <Mail size={12} /> :
                       inv.channel === "sms" || inv.channel === "whatsapp" ? <Phone size={12} /> :
                       <Send size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {inv.name || inv.email || inv.phone || "Sans nom"}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {inv.email || inv.phone} · {formatRelative(inv.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
