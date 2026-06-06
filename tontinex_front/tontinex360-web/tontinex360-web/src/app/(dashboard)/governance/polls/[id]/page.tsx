"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { governanceApi } from "@/lib/api/governance";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatDate } from "@/lib/utils/format";
import {
  ArrowLeft, CheckCircle2, Loader2, PlayCircle, StopCircle,
  Vote as VoteIcon, AlertCircle, EyeOff,
} from "lucide-react";

export default function PollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const p = usePermissions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const { data: poll, isLoading } = useQuery({
    queryKey: ["poll", id],
    queryFn: () => governanceApi.getPoll(id),
    refetchInterval: (q) => {
      const data = q.state.data;
      // Si le sondage est ouvert et résultats visibles → refresh toutes les 10s
      return data?.is_open_now && data?.results_visible_before_close ? 10000 : false;
    },
  });

  // Charge la sélection actuelle si modification autorisée
  useEffect(() => { setSelectedIds([]); }, [id]);

  const voteMut = useMutation({
    mutationFn: () => governanceApi.votePoll(id, selectedIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["poll", id] });
      setSelectedIds([]);
      setError('');
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === 'string' ? data : data?.error || data?.detail || "Erreur de vote");
    },
  });

  const openMut = useMutation({
    mutationFn: () => governanceApi.openPoll(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["poll", id] }),
  });
  const closeMut = useMutation({
    mutationFn: () => governanceApi.closePoll(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["poll", id] }),
  });

  if (isLoading || !poll) {
    return (
      <>
        <Topbar title="Sondage" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          Chargement…
        </div>
      </>
    );
  }

  const canManage = p.isBureau || p.isPresident || p.canAny(['governance.*', '*']);
  const showResults = poll.status === 'closed' || poll.results_visible_before_close;
  const isOpen = poll.is_open_now;
  const canVote = isOpen && !poll.has_voted && !!p.membership;
  const canChangeVote = isOpen && poll.has_voted && poll.allow_change_vote;

  const totalVotes = poll.options.reduce((s, o) => s + (o.votes_count ?? 0), 0);

  const toggleOption = (optId: string) => {
    if (poll.kind === 'single_choice') {
      setSelectedIds([optId]);
    } else {
      setSelectedIds(prev => prev.includes(optId)
        ? prev.filter(x => x !== optId)
        : [...prev, optId]
      );
    }
  };

  return (
    <>
      <Topbar title="Sondage" />

      <Link href="/governance/polls" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                poll.status === 'open' ? 'bg-emerald-100 text-emerald-700'
                : poll.status === 'closed' ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
              }`}>
                {poll.status_display}
              </span>
              <span className="text-[10px] text-gray-500">{poll.kind_display}</span>
              {poll.is_anonymous && (
                <span className="text-[10px] text-purple-700 inline-flex items-center gap-1">
                  <EyeOff size={10} /> Anonyme
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{poll.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{poll.question}</p>
            <p className="text-[10px] text-gray-400 mt-2">
              Créé par {poll.created_by_name || '—'} · {formatDate(poll.created_at)}
              {poll.ends_at && ` · Clôture prévue le ${formatDate(poll.ends_at)}`}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-col gap-1 shrink-0">
              {poll.status === 'draft' && (
                <button
                  onClick={() => openMut.mutate()}
                  disabled={openMut.isPending}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-xs rounded-lg disabled:opacity-50"
                >
                  {openMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <PlayCircle size={12} />}
                  Ouvrir
                </button>
              )}
              {poll.status === 'open' && (
                <button
                  onClick={() => closeMut.mutate()}
                  disabled={closeMut.isPending}
                  className="inline-flex items-center gap-1 px-2 py-1 border border-blue-300 text-blue-700 text-xs rounded-lg disabled:opacity-50"
                >
                  {closeMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <StopCircle size={12} />}
                  Clôturer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bandeau état */}
        {poll.status === 'open' && !isOpen && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded-lg flex items-center gap-2">
            <AlertCircle size={12} /> Le sondage est ouvert mais hors de la fenêtre de vote actuelle.
          </div>
        )}
        {poll.has_voted && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-2 rounded-lg flex items-center gap-2 mb-2">
            <CheckCircle2 size={12} />
            Vous avez voté.{poll.allow_change_vote && isOpen ? ' Vous pouvez modifier votre choix.' : ''}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-lg mt-2 flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        {/* Options + résultats */}
        <div className="mt-4 space-y-2">
          {poll.options.map(opt => {
            const checked = selectedIds.includes(opt.id);
            const votesCount = opt.votes_count ?? 0;
            const pct = totalVotes > 0 && showResults ? (votesCount / totalVotes) * 100 : 0;

            return (
              <div
                key={opt.id}
                onClick={() => (canVote || canChangeVote) && toggleOption(opt.id)}
                className={`relative border-2 rounded-lg p-3 transition ${
                  (canVote || canChangeVote)
                    ? 'cursor-pointer hover:border-[#43793F]'
                    : 'cursor-default'
                } ${checked ? 'border-[#43793F] bg-[#F1F8E8]' : 'border-gray-200'}`}
              >
                {/* Barre de progression résultats */}
                {showResults && totalVotes > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-gray-100 rounded-lg opacity-50 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {poll.kind === 'single_choice' ? (
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        checked ? 'border-[#43793F]' : 'border-gray-300'
                      }`}>
                        {checked && <div className="w-2 h-2 rounded-full bg-[#43793F]" />}
                      </div>
                    ) : (
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        checked ? 'border-[#43793F] bg-[#43793F]' : 'border-gray-300'
                      }`}>
                        {checked && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                  </div>
                  {showResults && (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{votesCount}</p>
                      <p className="text-[10px] text-gray-500">
                        {totalVotes > 0 ? `${pct.toFixed(1)}%` : '0%'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bouton voter */}
        {(canVote || canChangeVote) && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={() => { setError(''); voteMut.mutate(); }}
              disabled={voteMut.isPending || selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50 hover:bg-[#43793F]"
            >
              {voteMut.isPending && <Loader2 size={12} className="animate-spin" />}
              <VoteIcon size={14} />
              {canChangeVote ? "Modifier mon vote" : "Envoyer mon vote"}
            </button>
          </div>
        )}

        {showResults && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
            <span>Total : <strong className="text-gray-900">{totalVotes}</strong> votes</span>
            {poll.is_open_now && poll.results_visible_before_close && (
              <span className="text-emerald-600">● Mise à jour en temps réel</span>
            )}
          </div>
        )}

        {!showResults && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 flex items-center gap-2">
            <EyeOff size={12} /> Les résultats seront visibles après la clôture du sondage.
          </div>
        )}
      </div>
    </>
  );
}
