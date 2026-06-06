"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { governanceApi, type Election, type ElectionCandidate } from "@/lib/api/governance";
import { ApprovalRequestModal } from "@/components/approvals/approval-request-modal";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatDate } from "@/lib/utils/format";
import {
  ArrowLeft, CheckCircle2, Loader2, AlertCircle, Trophy,
  Save, ShieldCheck,
} from "lucide-react";

interface CandidateEdit {
  id: string;
  votes_count: number;
  is_elected: boolean;
}

export default function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const p = usePermissions();
  const [edits, setEdits] = useState<Record<string, CandidateEdit>>({});
  const [error, setError] = useState('');
  const [showValidationModal, setShowValidationModal] = useState(false);

  const { data: elections = [] } = useQuery({
    queryKey: ["elections"],
    queryFn: () => governanceApi.elections(),
  });
  const election = elections.find(e => e.id === id) as Election | undefined;

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["candidates", id],
    queryFn: () => governanceApi.candidates(id),
  });

  // Initialise edits depuis les candidats
  useEffect(() => {
    if (candidates.length > 0 && Object.keys(edits).length === 0) {
      const next: Record<string, CandidateEdit> = {};
      candidates.forEach(c => {
        next[c.id] = {
          id: c.id,
          votes_count: c.votes_count,
          is_elected: c.is_elected,
        };
      });
      setEdits(next);
    }
  }, [candidates]);

  const saveMut = useMutation({
    mutationFn: () => governanceApi.saveElectionResults(
      id,
      Object.values(edits).map(e => ({
        candidate_id: e.id,
        votes_count: e.votes_count,
        is_elected: e.is_elected,
      })),
    ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["candidates", id] });
      qc.invalidateQueries({ queryKey: ["elections"] });
      setError('');
      if (data.errors?.length) {
        setError(`Erreurs sur ${data.errors.length} candidats : ${data.errors.map((e: any) => e.error).join(' • ')}`);
      }
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === 'string' ? data : data?.error || data?.detail || "Erreur");
    },
  });

  const canManage = p.isBureau || p.isPresident || p.canAny(['governance.*', '*']);

  if (!election || isLoading) {
    return (
      <>
        <Topbar title="Élection" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          Chargement…
        </div>
      </>
    );
  }

  // Trier par position puis par votes_count décroissant
  const candidatesByPosition: Record<string, ElectionCandidate[]> = {};
  candidates.forEach(c => {
    const k = (c as any).position_name ?? c.position;
    if (!candidatesByPosition[k]) candidatesByPosition[k] = [];
    candidatesByPosition[k].push(c);
  });
  Object.values(candidatesByPosition).forEach(list =>
    list.sort((a, b) => (edits[b.id]?.votes_count ?? b.votes_count) - (edits[a.id]?.votes_count ?? a.votes_count))
  );

  const electedCount = Object.values(edits).filter(e => e.is_elected).length;
  const canValidateResults = (
    canManage && election.status !== 'completed' && election.status !== 'cancelled'
    && electedCount > 0
  );

  return (
    <>
      <Topbar title="Élection" />

      {showValidationModal && (
        <ApprovalRequestModal
          title="Officialiser les résultats de l'élection"
          actionType="election.validate_results"
          targetId={election.id}
          targetLabel={election.title}
          contextSummary={`${electedCount} candidat(s) élu(s) — création des BureauMember après triple validation`}
          fields={[]}
          onClose={() => setShowValidationModal(false)}
          onSubmitted={() => {
            setShowValidationModal(false);
            qc.invalidateQueries({ queryKey: ["approvals"] });
          }}
        />
      )}

      <Link href="/governance/elections" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{election.title}</h2>
            <p className="text-xs text-gray-500 mt-1">
              {election.method === 'secret' && 'Vote à bulletin secret'}
              {election.method === 'open' && 'Vote à main levée'}
              {election.method === 'consensus' && 'Consensus'}
              {election.method === 'designation' && 'Désignation'}
              {' · '}{election.date ? formatDate(election.date) : '—'}
            </p>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            election.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
            : election.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
            : election.status === 'cancelled' ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-700'
          }`}>
            {election.status}
          </span>
        </div>

        {election.notes && (
          <p className="text-sm text-gray-600 italic mt-3">« {election.notes} »</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {canManage && election.status !== 'completed' && election.status !== 'cancelled' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg mb-4">
          <p className="font-semibold mb-1">💡 Saisie post-AG</p>
          <p>
            Après le vote en présentiel, saisissez les voix obtenues par chaque candidat
            puis cochez les élus. Sauvegardez avant d'officialiser les résultats
            (triple validation requise pour créer les BureauMember).
          </p>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">Aucun candidat enregistré pour cette élection.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(candidatesByPosition).map(([positionName, list]) => (
            <div key={positionName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">{positionName}</h3>
                <p className="text-[10px] text-gray-500">{list.length} candidat(s)</p>
              </div>

              <div className="divide-y divide-gray-100">
                {list.map(c => {
                  const edit = edits[c.id] ?? { id: c.id, votes_count: c.votes_count, is_elected: c.is_elected };
                  const memberName = (c as any).member_name ?? c.membership;
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{memberName}</p>
                        {edit.is_elected && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 mt-0.5">
                            <Trophy size={10} /> Élu
                          </span>
                        )}
                      </div>

                      {canManage && election.status !== 'completed' && election.status !== 'cancelled' ? (
                        <>
                          <div className="text-right">
                            <label className="text-[10px] text-gray-500 block">Voix</label>
                            <input
                              type="number"
                              min={0}
                              value={edit.votes_count}
                              onChange={e => setEdits({
                                ...edits,
                                [c.id]: { ...edit, votes_count: Number(e.target.value) || 0 },
                              })}
                              className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm text-right"
                            />
                          </div>
                          <label className="flex flex-col items-center gap-1 cursor-pointer">
                            <span className="text-[10px] text-gray-500">Élu</span>
                            <input
                              type="checkbox"
                              checked={edit.is_elected}
                              onChange={e => setEdits({
                                ...edits,
                                [c.id]: { ...edit, is_elected: e.target.checked },
                              })}
                              className="w-4 h-4"
                            />
                          </label>
                        </>
                      ) : (
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{edit.votes_count} voix</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {canManage && election.status !== 'completed' && election.status !== 'cancelled' && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => { setError(''); saveMut.mutate(); }}
                disabled={saveMut.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50 hover:bg-[#43793F]"
              >
                {saveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={14} />}
                Enregistrer les résultats
              </button>
              {canValidateResults && (
                <button
                  onClick={() => setShowValidationModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                >
                  <ShieldCheck size={14} /> Officialiser ({electedCount} élu{electedCount > 1 ? 's' : ''})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
