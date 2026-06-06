"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { governanceApi, type PollStatus } from "@/lib/api/governance";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatDate } from "@/lib/utils/format";
import {
  Plus, X, Loader2, Vote as VoteIcon, ChevronRight, Eye, EyeOff,
  CheckSquare, Circle, Trash2,
} from "lucide-react";

const STATUS_META: Record<PollStatus, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  open: { label: "Ouvert", color: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Clôturé", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-700" },
};

export default function PollsPage() {
  const p = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const canCreate = p.isBureau || p.isPresident || p.canAny(['governance.*', '*']);

  const { data: polls = [], isLoading } = useQuery({
    queryKey: ["polls", statusFilter],
    queryFn: () => governanceApi.polls(statusFilter ? { status: statusFilter } : undefined),
  });

  return (
    <>
      <Topbar title="Sondages électroniques" />

      {showForm && (
        <CreatePollModal onClose={() => setShowForm(false)} />
      )}

      <div className="flex items-center justify-between gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
          >
            <Plus size={14} /> Nouveau sondage
          </button>
        )}
      </div>

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          Chargement…
        </div>
      )}
      {!isLoading && polls.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <VoteIcon size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucun sondage pour l'instant.</p>
        </div>
      )}

      <div className="space-y-2">
        {polls.map(p => (
          <Link
            key={p.id}
            href={`/governance/polls/${p.id}`}
            className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-[#43793F]/40 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_META[p.status]?.color}`}>
                    {STATUS_META[p.status]?.label ?? p.status}
                  </span>
                  <span className="text-[10px] text-gray-500 inline-flex items-center gap-1">
                    {p.kind === 'single_choice' ? <Circle size={10} /> : <CheckSquare size={10} />}
                    {p.kind_display}
                  </span>
                  {p.is_anonymous && (
                    <span className="text-[10px] text-purple-700 inline-flex items-center gap-1">
                      <EyeOff size={10} /> Anonyme
                    </span>
                  )}
                  {p.has_voted && (
                    <span className="text-[10px] text-emerald-700 font-medium">✓ Vous avez voté</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{p.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.question}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                  <span>{p.options.length} options</span>
                  {p.total_votes !== null && <span>· {p.total_votes} votes</span>}
                  <span>· créé le {formatDate(p.created_at)}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

// ─── Modal de création ────────────────────────────────────────────

function CreatePollModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '', question: '',
    kind: 'single_choice' as 'single_choice' | 'multi_choice',
    is_anonymous: false,
    allow_change_vote: false,
    max_choices: '',
    results_visible_before_close: true,
    ends_at: '',
  });
  const [options, setOptions] = useState<string[]>(['', '']);
  const [error, setError] = useState('');

  const createMut = useMutation({
    mutationFn: () => governanceApi.createPoll({
      title: form.title.trim(),
      question: form.question.trim(),
      kind: form.kind,
      is_anonymous: form.is_anonymous,
      allow_change_vote: form.allow_change_vote,
      max_choices: form.max_choices ? Number(form.max_choices) : null,
      results_visible_before_close: form.results_visible_before_close,
      ends_at: form.ends_at || null,
      options_input: options
        .map((label, idx) => ({ label: label.trim(), display_order: idx }))
        .filter(o => o.label),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["polls"] });
      onClose();
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === 'string' ? data : data?.error || data?.detail || "Erreur");
    },
  });

  const cleanOptions = options.filter(o => o.trim());
  const canSubmit = form.title.trim() && form.question.trim() && cleanOptions.length >= 2;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-lg w-full p-5 my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Nouveau sondage</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-3">{error}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Date de la prochaine séance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Question *</label>
            <textarea
              value={form.question}
              onChange={e => setForm({ ...form, question: e.target.value })}
              rows={2}
              placeholder="Quel jour vous convient le mieux pour la séance d'octobre ?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Type de vote</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: 'single_choice' })}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                  form.kind === 'single_choice'
                    ? 'border-[#43793F] bg-[#F1F8E8] text-[#43793F]'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                <Circle size={14} /> Un seul choix
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: 'multi_choice' })}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                  form.kind === 'multi_choice'
                    ? 'border-[#43793F] bg-[#F1F8E8] text-[#43793F]'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                <CheckSquare size={14} /> Plusieurs choix
              </button>
            </div>
          </div>

          {form.kind === 'multi_choice' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Maximum d'options sélectionnables (vide = pas de limite)
              </label>
              <input
                type="number" min={1}
                value={form.max_choices}
                onChange={e => setForm({ ...form, max_choices: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Options du sondage ({cleanOptions.length} valides)
            </label>
            <div className="space-y-1">
              {options.map((opt, idx) => (
                <div key={idx} className="flex gap-1">
                  <input
                    type="text"
                    value={opt}
                    onChange={e => {
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                      className="px-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOptions([...options, ''])}
                className="text-xs text-[#43793F] hover:underline"
              >
                + Ajouter une option
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Date de fin (optionnel)</label>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={e => setForm({ ...form, ends_at: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_anonymous}
                onChange={e => setForm({ ...form, is_anonymous: e.target.checked })}
              />
              Vote anonyme (l'identité n'est pas stockée)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.allow_change_vote}
                onChange={e => setForm({ ...form, allow_change_vote: e.target.checked })}
              />
              Autoriser le changement de vote tant que le sondage est ouvert
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.results_visible_before_close}
                onChange={e => setForm({ ...form, results_visible_before_close: e.target.checked })}
              />
              Résultats visibles en temps réel (sinon, visibles après clôture)
            </label>
          </div>

          <p className="text-[10px] text-gray-400 italic">
            Le sondage sera créé en brouillon. Cliquez sur "Ouvrir au vote" depuis le détail pour notifier les membres.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => { setError(''); createMut.mutate(); }}
            disabled={createMut.isPending || !canSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {createMut.isPending && <Loader2 size={12} className="animate-spin" />}
            Créer le sondage
          </button>
        </div>
      </div>
    </div>
  );
}
