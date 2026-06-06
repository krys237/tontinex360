"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { cyclesApi } from "@/lib/api/cycles";
import { tontinesApi, type TontineType } from "@/lib/api/tontines";
import { financeApi } from "@/lib/api/finance";
import { formatXAF, formatDate } from "@/lib/utils/format";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { ApprovalRequestModal } from "@/components/approvals/approval-request-modal";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHero } from "@/components/ui/page-hero";
import { KpiCard } from "@/components/ui/kpi-card";
import type { Cycle } from "@/lib/types/cycle";
import {
  Plus, Layers, Calendar, Loader2, Lock, Edit3, Dice5, Gavel, Vote, Settings2,
} from "lucide-react";

const CYCLE_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  active: { label: "En cours", color: "bg-emerald-100 text-emerald-700" },
  completed: { label: "Terminé", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-700" },
};

export default function TontinesPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const [tab, setTab] = useState<"cycles" | "types">("cycles");
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [editingType, setEditingType] = useState<TontineType | null>(null);
  const [closingCycle, setClosingCycle] = useState<{ id: string; name: string } | null>(null);

  const canManage = p.isPresident || p.canAny(['*', 'tontines.*', 'cycles.*']);

  const { data: cycles = [], isLoading: loadingCycles } = useQuery({
    queryKey: ["cycles"],
    queryFn: () => cyclesApi.list(),
  });
  const { data: types = [], isLoading: loadingTypes } = useQuery({
    queryKey: ["tontine-types"],
    queryFn: () => tontinesApi.types(),
  });

  const activeTypes = types.filter((t) => t.is_active);
  const activeCycles = cycles.filter((c) => c.status === "active");
  const totalParticipants = useMemo(() => {
    return cycles.reduce(
      (s, c) => s + (c.tontine_configs?.length ?? 0) * 0,
      0,
    );
  }, [cycles]);

  return (
    <>
      <Topbar title="Tontines" />

      <SectionHeader
        eyebrow="Tontines"
        title="Gestion des Tontines"
        description="Créez, organisez et pilotez toutes les tontines de votre association avec des règles automatisées et un suivi complet des cycles."
        actions={
          canManage && (
            <>
              <button
                onClick={() =>
                  setTab(tab === "cycles" ? "types" : "cycles")
                }
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                <Settings2 size={14} /> {tab === "cycles" ? "Types de tontine" : "Cycles"}
              </button>
              <button
                onClick={() =>
                  tab === "cycles" ? setShowNewCycle(true) : setShowNewType(true)
                }
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
              >
                <Plus size={14} /> {tab === "cycles" ? "Nouveau cycle" : "Nouveau type"}
              </button>
            </>
          )
        }
      />

      {closingCycle && (
        <ApprovalRequestModal
          title="Clôturer le cycle"
          actionType="cycle.close"
          targetId={closingCycle.id}
          targetLabel={closingCycle.name}
          contextSummary="Triple validation requise (Président + 2 membres bureau distincts). Action quasi-irréversible."
          fields={[]}
          onClose={() => setClosingCycle(null)}
          onSubmitted={() => {
            setClosingCycle(null);
            qc.invalidateQueries({ queryKey: ["approvals"] });
            qc.invalidateQueries({ queryKey: ["cycles"] });
          }}
        />
      )}

      <PageHero
        title=""
        hero={{
          title: "Automatisez vos tontines communautaires",
          description:
            "Gérez les types de tontines, les règles de participation, les distributions et les méthodes d'attribution des bénéficiaires.",
          primaryCta: {
            label: "Créer une tontine",
            onClick: () => setShowNewType(true),
            icon: <Plus size={16} />,
          },
          secondaryCta: {
            label: "Voir les performances",
            onClick: () => (window.location.href = "/sessions"),
          },
          stats: [
            { label: "Tontines actives", value: activeTypes.length },
            { label: "Cycles en cours", value: activeCycles.length },
            { label: "Cycles total", value: cycles.length },
            { label: "Types configurés", value: types.length },
          ],
          statsTitle: "Résumé Général",
        }}
      />

      {/* Méthodes d'attribution (cartes éducatives style Figma) */}
      <div className="mb-6">
        <h3 className="text-base font-semibold text-[#1E3233]">
          Types de Tontines
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Différentes méthodes d'attribution des cagnottes.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MethodCard
            icon={Dice5}
            tint="bg-blue-50 text-blue-600"
            name="Tirage aléatoire"
            description="Attribution automatique des bénéficiaires par tirage au sort."
            count={activeTypes.filter(t => t.payout_pattern === 'rotating' && t.default_acquisition_method === 'random').length}
          />
          <MethodCard
            icon={Gavel}
            tint="bg-amber-50 text-amber-600"
            name="Enchères"
            description="Les membres enchérissent pour obtenir la cagnotte en premier."
            count={activeTypes.filter(t => t.payout_pattern === 'rotating' && t.default_acquisition_method === 'auction').length}
          />
          <MethodCard
            icon={Vote}
            tint="bg-purple-50 text-purple-600"
            name="Vote communautaire"
            description="Les bénéficiaires sont choisis par vote des membres."
            count={activeTypes.filter(t => t.payout_pattern === 'rotating' && t.default_acquisition_method === 'vote').length}
          />
        </div>
      </div>

      {/* Onglets restant */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setTab("cycles")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === "cycles" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Cycles ({cycles.length})
          </button>
          <button
            onClick={() => setTab("types")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === "types" ? "border-[#43793F] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Types de cotisation ({types.length})
          </button>
        </div>
      </div>

      {showNewCycle && <CreateCycleModal onClose={() => setShowNewCycle(false)} />}
      {editingCycle && (
        <CreateCycleModal
          cycle={editingCycle}
          onClose={() => setEditingCycle(null)}
        />
      )}
      {showNewType && <CreateTontineTypeModal onClose={() => setShowNewType(false)} />}
      {editingType && (
        <CreateTontineTypeModal
          type={editingType}
          onClose={() => setEditingType(null)}
        />
      )}

      {tab === "cycles" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loadingCycles && <p className="col-span-1 sm:col-span-2 p-6 text-center text-sm text-gray-400">Chargement…</p>}
          {!loadingCycles && cycles.length === 0 && (
            <p className="col-span-2 p-6 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              Aucun cycle. Créez-en un pour démarrer.
            </p>
          )}
          {cycles.map(c => {
            const st = CYCLE_STATUS[c.status] ?? { label: c.status, color: "bg-gray-100 text-gray-700" };
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{c.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Calendar size={10} />
                      {formatDate(c.start_date)}
                      {c.end_date ? ` → ${formatDate(c.end_date)}` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                    {st.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
                  <span>📅 {c.session_count} séance{c.session_count > 1 ? "s" : ""}</span>
                  <span>📋 {c.tontine_configs?.length ?? 0} config{(c.tontine_configs?.length ?? 0) > 1 ? "s" : ""}</span>
                  {c.recurrence_kind && c.recurrence_kind !== 'none' && (
                    <span className="text-amber-600">🔄 Auto-récurrent</span>
                  )}
                </div>

                {canManage && (c.status === 'draft' || c.status === 'active') && (
                  <div className="flex items-center gap-2 mt-3">
                    {c.status === 'draft' && (
                      <button
                        onClick={() => setEditingCycle(c)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-[#43793F] text-[#43793F] rounded-lg hover:bg-[#F1F8E8]"
                        title="Modifier ce cycle (uniquement en brouillon)"
                      >
                        <Edit3 size={12} /> Modifier
                      </button>
                    )}
                    {c.status === 'active' && (
                      <button
                        onClick={() => setClosingCycle({ id: c.id, name: c.name })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
                        title="Clôturer ce cycle (triple validation)"
                      >
                        <Lock size={12} /> Clôturer
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "types" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loadingTypes && <p className="col-span-1 sm:col-span-2 p-6 text-center text-sm text-gray-400">Chargement…</p>}
          {!loadingTypes && types.length === 0 && (
            <p className="col-span-1 sm:col-span-2 p-6 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
              Aucun type de cotisation.
            </p>
          )}
          {types.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#F1F8E8] rounded-lg flex items-center justify-center text-[#43793F] shrink-0">
                  <Layers size={16} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description || "—"}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px]">
                    {t.contribution_kind === 'in_kind' ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        🌾 Nature · {t.in_kind_unit_label || 'unités'}
                        {t.in_kind_unit_value
                          ? ` (1 ≈ ${formatXAF(Number(t.in_kind_unit_value))})`
                          : ''}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        💰 Argent
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      Mode : {t.rate_mode === "fixed" ? "Fixe" : t.rate_mode === "range" ? "Plage" : "Libre"}
                    </span>
                    {t.rate_mode === "fixed" && t.fixed_rate && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {t.contribution_kind === 'in_kind'
                          ? `${Number(t.fixed_rate)} ${t.in_kind_unit_label || 'unités'}/part`
                          : formatXAF(Number(t.fixed_rate))}
                      </span>
                    )}
                    {t.allows_multiple_shares && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        Multi-{t.share_unit_name}
                      </span>
                    )}
                    {/* Pattern de restitution */}
                    {t.payout_pattern === 'individual_savings' ? (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        🏦 Banque scolaire
                      </span>
                    ) : t.payout_pattern === 'collective_savings' ? (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        🏛 Caisse commune
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#F1F8E8] text-[#43793F]">
                        🔄 Rotative ·{' '}
                        {t.default_acquisition_method === 'random' && 'Tirage'}
                        {t.default_acquisition_method === 'sequential' && 'Tour de rôle'}
                        {t.default_acquisition_method === 'auction' && 'Enchère'}
                        {t.default_acquisition_method === 'vote' && 'Vote'}
                        {t.default_acquisition_method === 'need_based' && 'Besoin'}
                        {t.default_acquisition_method === 'manual' && 'Manuel'}
                        {!t.default_acquisition_method && 'Tirage'}
                      </span>
                    )}
                    {!t.is_active && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">
                        Inactif
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => setEditingType(t)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs text-[#43793F] hover:underline"
                    title="Modifier ce type de cotisation"
                  >
                    <Edit3 size={12} /> Modifier
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function MethodCard({
  icon: Icon,
  tint,
  name,
  description,
  count,
}: {
  icon: any;
  tint: string;
  name: string;
  description: string;
  count: number;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-[0_2px_8px_rgba(67,121,63,0.04)]">
      <div className={`w-10 h-10 ${tint} rounded-xl flex items-center justify-center mb-3`}>
        <Icon size={18} />
      </div>
      <h4 className="text-base font-bold text-[#1E3233]">{name}</h4>
      <p className="text-xs text-gray-500 mt-1 leading-snug">{description}</p>
      <div className="bg-[#F1F8E8]/60 rounded-lg p-2.5 mt-3">
        <p className="text-[10px] text-gray-500 uppercase">Tontines actives</p>
        <p className="text-lg font-bold text-[#43793F] mt-0.5">{count}</p>
      </div>
    </div>
  );
}

function CreateCycleModal({
  onClose,
  cycle,
}: {
  onClose: () => void;
  cycle?: Cycle;            // Si fourni → mode édition
}) {
  const qc = useQueryClient();
  const isEdit = !!cycle;

  const [form, setForm] = useState({
    name: cycle?.name ?? "",
    start_date: cycle?.start_date ?? "",
    end_date: cycle?.end_date ?? "",
    session_frequency: cycle?.session_frequency ?? "monthly",
    default_session_day: cycle?.default_session_day ?? 5,
    default_session_time: (cycle?.default_session_time ?? "18:00").slice(0, 5),
    default_session_location: cycle?.default_session_location ?? "",
    status: (cycle?.status as "draft" | "active") ?? "draft",
    recurrence_kind: (cycle?.recurrence_kind ?? "none") as "none" | "fixed_day_of_month" | "nth_weekday" | "every_weekday",
    recurrence_nth: cycle?.recurrence_nth ?? 3,
    recurrence_weekday: cycle?.recurrence_weekday ?? 5,
    recurrence_day_of_month: cycle?.recurrence_day_of_month ?? 15,
  });
  const [error, setError] = useState("");
  const [previewDates, setPreviewDates] = useState<string[]>([]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: any = {
        ...form,
        default_session_time: form.default_session_time
          ? (form.default_session_time.length === 5
              ? form.default_session_time + ':00'
              : form.default_session_time)
          : null,
        recurrence_nth: form.recurrence_kind === 'nth_weekday' ? form.recurrence_nth : null,
        recurrence_weekday: (form.recurrence_kind === 'nth_weekday' || form.recurrence_kind === 'every_weekday')
          ? form.recurrence_weekday : null,
        recurrence_day_of_month: form.recurrence_kind === 'fixed_day_of_month'
          ? form.recurrence_day_of_month : null,
      };
      return isEdit
        ? cyclesApi.update(cycle!.id, payload)
        : cyclesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycles"] });
      onClose();
    },
    onError: (err: any) => {
      const data = err.response?.data;
      const msg = typeof data === "string"
        ? data
        : data?.detail
          || data?.error
          || (data ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' ; ') : '')
          || (isEdit ? "Erreur lors de la mise à jour" : "Erreur lors de la création");
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          {isEdit ? `Modifier le cycle "${cycle?.name}"` : 'Nouveau cycle'}
        </h3>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Cycle 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Début *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fin</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fréquence</label>
              <select
                value={form.session_frequency}
                onChange={e => setForm({ ...form, session_frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="weekly">Hebdomadaire</option>
                <option value="biweekly">Bimensuel</option>
                <option value="monthly">Mensuel</option>
                <option value="quarterly">Trimestriel</option>
                <option value="custom">Personnalisé</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Statut</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as 'draft' | 'active' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="draft">Brouillon</option>
                <option value="active">Actif</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Jour de la semaine</label>
              <select
                value={form.default_session_day}
                onChange={e => setForm({ ...form, default_session_day: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value={0}>Lundi</option>
                <option value={1}>Mardi</option>
                <option value={2}>Mercredi</option>
                <option value={3}>Jeudi</option>
                <option value={4}>Vendredi</option>
                <option value={5}>Samedi</option>
                <option value={6}>Dimanche</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Heure habituelle</label>
              <input
                type="time"
                value={form.default_session_time}
                onChange={e => setForm({ ...form, default_session_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Lieu habituel</label>
            <input
              type="text"
              value={form.default_session_location}
              onChange={e => setForm({ ...form, default_session_location: e.target.value })}
              placeholder="Siège de l'association"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Pattern de récurrence (auto-génération des séances) */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div>
              <label className="text-xs text-amber-900 font-medium block mb-1">
                Pattern d'auto-génération des séances
              </label>
              <select
                value={form.recurrence_kind}
                onChange={e => {
                  setForm({ ...form, recurrence_kind: e.target.value as any });
                  setPreviewDates([]);
                }}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
              >
                <option value="none">Aucun (créer les séances manuellement)</option>
                <option value="fixed_day_of_month">Jour fixe du mois (ex : le 15)</option>
                <option value="nth_weekday">Nᵉ jour de semaine du mois (ex : 3ᵉ samedi)</option>
                <option value="every_weekday">Chaque semaine, un jour précis</option>
              </select>
            </div>

            {form.recurrence_kind === 'fixed_day_of_month' && (
              <div>
                <label className="text-xs text-amber-900 block mb-1">Jour du mois (1-31)</label>
                <input
                  type="number" min={1} max={31}
                  value={form.recurrence_day_of_month}
                  onChange={e => setForm({ ...form, recurrence_day_of_month: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                />
              </div>
            )}

            {form.recurrence_kind === 'nth_weekday' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-amber-900 block mb-1">Occurrence</label>
                  <select
                    value={form.recurrence_nth}
                    onChange={e => setForm({ ...form, recurrence_nth: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                  >
                    <option value={1}>1er</option>
                    <option value={2}>2ᵉ</option>
                    <option value={3}>3ᵉ</option>
                    <option value={4}>4ᵉ</option>
                    <option value={5}>Dernier</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-amber-900 block mb-1">Jour</label>
                  <select
                    value={form.recurrence_weekday}
                    onChange={e => setForm({ ...form, recurrence_weekday: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                  >
                    <option value={0}>Lundi</option>
                    <option value={1}>Mardi</option>
                    <option value={2}>Mercredi</option>
                    <option value={3}>Jeudi</option>
                    <option value={4}>Vendredi</option>
                    <option value={5}>Samedi</option>
                    <option value={6}>Dimanche</option>
                  </select>
                </div>
              </div>
            )}

            {form.recurrence_kind === 'every_weekday' && (
              <div>
                <label className="text-xs text-amber-900 block mb-1">Jour de la semaine</label>
                <select
                  value={form.recurrence_weekday}
                  onChange={e => setForm({ ...form, recurrence_weekday: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                >
                  <option value={0}>Lundi</option>
                  <option value={1}>Mardi</option>
                  <option value={2}>Mercredi</option>
                  <option value={3}>Jeudi</option>
                  <option value={4}>Vendredi</option>
                  <option value={5}>Samedi</option>
                  <option value={6}>Dimanche</option>
                </select>
                <p className="text-[10px] text-amber-700 mt-1">
                  L'intervalle (chaque semaine / 2 semaines) suit la <strong>Fréquence</strong> ci-dessus.
                </p>
              </div>
            )}

            {form.recurrence_kind !== 'none' && form.start_date && (
              <button
                type="button"
                onClick={() => {
                  setPreviewDates(computePreviewDates(form, 8));
                }}
                className="text-xs text-amber-900 underline"
              >
                Prévisualiser les 8 prochaines dates
              </button>
            )}

            {previewDates.length > 0 && (
              <div className="bg-white border border-amber-200 rounded p-2 max-h-32 overflow-y-auto">
                <ul className="text-xs text-gray-700 space-y-0.5">
                  {previewDates.map(d => (
                    <li key={d}>• {new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <p className="text-[10px] text-gray-400 italic">
            {form.recurrence_kind === 'none'
              ? "Sans pattern : aucune séance n'est créée automatiquement."
              : "Les séances seront auto-générées dès que le cycle passera à 'Actif'."}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Annuler</button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.name || !form.start_date}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {saveMut.isPending && <Loader2 size={12} className="animate-spin" />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTontineTypeModal({
  onClose,
  type,
}: {
  onClose: () => void;
  type?: TontineType;  // Si fourni → mode édition
}) {
  const qc = useQueryClient();
  const isEdit = !!type;
  const [form, setForm] = useState({
    name: type?.name ?? "",
    slug: type?.slug ?? "",
    description: type?.description ?? "",
    contribution_kind: (type?.contribution_kind ?? "cash") as "cash" | "in_kind",
    in_kind_unit_label: type?.in_kind_unit_label ?? "",
    in_kind_unit_value: type?.in_kind_unit_value != null ? String(type.in_kind_unit_value) : "",
    rate_mode: (type?.rate_mode ?? "fixed") as "fixed" | "range" | "free",
    fixed_rate: type?.fixed_rate != null ? String(type.fixed_rate) : "",
    min_rate: type?.min_rate != null ? String(type.min_rate) : "",
    max_rate: type?.max_rate != null ? String(type.max_rate) : "",
    currency: type?.currency ?? "XAF",
    allows_multiple_shares: type?.allows_multiple_shares ?? false,
    max_shares_per_member: type?.max_shares_per_member ?? 5,
    share_unit_name: type?.share_unit_name ?? "nom",
    has_beneficiary: type?.has_beneficiary ?? true,
    payout_pattern: (type?.payout_pattern ?? "rotating") as
      "rotating" | "individual_savings" | "collective_savings",
    default_acquisition_method: (type?.default_acquisition_method ?? "random") as
      "random" | "sequential" | "auction" | "vote" | "need_based" | "manual",
    is_active: type?.is_active ?? true,
    default_account: type?.default_account ?? "",
  });
  const [error, setError] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["treasury"],
    queryFn: () => financeApi.treasury(),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: any = {
        ...form,
        slug: form.slug || form.name.toLowerCase().normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        fixed_rate: form.rate_mode === "fixed" ? form.fixed_rate || null : null,
        min_rate: form.rate_mode === "range" ? form.min_rate || null : null,
        max_rate: form.rate_mode === "range" ? form.max_rate || null : null,
        default_account: form.default_account || null,
        // Nettoyage des champs in_kind si mode cash (et vice-versa)
        in_kind_unit_label: form.contribution_kind === 'in_kind'
          ? form.in_kind_unit_label.trim() : '',
        in_kind_unit_value: form.contribution_kind === 'in_kind'
          ? (form.in_kind_unit_value || null) : null,
      };
      return isEdit
        ? tontinesApi.updateType(type!.id, payload)
        : tontinesApi.createType(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tontine-types"] });
      onClose();
    },
    onError: (err: any) => {
      const data = err.response?.data;
      const msg = typeof data === "string"
        ? data
        : data?.detail
          || data?.error
          || (Array.isArray(data?.non_field_errors) ? data.non_field_errors.join(' ') : '')
          || (data ? Object.entries(data)
              .filter(([k]) => k !== 'non_field_errors')
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' ; ') : '')
          || (isEdit ? "Erreur lors de la mise à jour" : "Erreur lors de la création");
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          {isEdit ? `Modifier "${type?.name}"` : 'Nouveau type de cotisation'}
        </h3>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Tontine principale"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* ── Type de cotisation : argent ou nature ── */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <label className="text-xs text-amber-900 font-medium block">
              Type de cotisation
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, contribution_kind: 'cash' })}
                className={`px-3 py-2 rounded-lg text-sm border transition ${
                  form.contribution_kind === 'cash'
                    ? 'border-[#43793F] bg-white text-[#43793F] font-medium'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                💰 En argent
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, contribution_kind: 'in_kind' })}
                className={`px-3 py-2 rounded-lg text-sm border transition ${
                  form.contribution_kind === 'in_kind'
                    ? 'border-[#43793F] bg-white text-[#43793F] font-medium'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                🌾 En nature
              </button>
            </div>

            {form.contribution_kind === 'in_kind' && (
              <div className="space-y-2 pt-2 border-t border-amber-200">
                <div>
                  <label className="text-xs text-amber-900 block mb-1">
                    Unité * <span className="text-amber-700">(ex: Sac de riz 25kg)</span>
                  </label>
                  <input
                    type="text"
                    value={form.in_kind_unit_label}
                    onChange={e => setForm({ ...form, in_kind_unit_label: e.target.value })}
                    placeholder="Sac de riz 25kg"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-amber-900 block mb-1">
                    Valeur de référence par unité (XAF) *
                    <span className="text-amber-700"> — pour rapports financiers</span>
                  </label>
                  <input
                    type="number"
                    min="0" step="any"
                    value={form.in_kind_unit_value}
                    onChange={e => setForm({ ...form, in_kind_unit_value: e.target.value })}
                    placeholder="15000"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white"
                  />
                </div>
                <p className="text-[10px] text-amber-700">
                  Les seuils d'abonnement (cagnotte max/mois) utilisent la valeur de référence
                  pour mesurer l'équivalent monétaire de la collecte.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Mode de cotisation</label>
            <select
              value={form.rate_mode}
              onChange={e => setForm({ ...form, rate_mode: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="fixed">Fixe</option>
              <option value="range">Plage min/max</option>
              <option value="free">Libre</option>
            </select>
          </div>
          {form.rate_mode === "fixed" && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                {form.contribution_kind === 'in_kind'
                  ? `Quantité par part (${form.in_kind_unit_label || 'unités'}) *`
                  : `Montant par part (${form.currency}) *`}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.fixed_rate}
                onChange={e => setForm({ ...form, fixed_rate: e.target.value })}
                placeholder={form.contribution_kind === 'in_kind' ? '1' : '10000'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          {form.rate_mode === "range" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Min ({form.contribution_kind === 'in_kind'
                    ? (form.in_kind_unit_label || 'unités')
                    : form.currency}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.min_rate}
                  onChange={e => setForm({ ...form, min_rate: e.target.value })}
                  placeholder={form.contribution_kind === 'in_kind' ? '1' : '5000'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Max ({form.contribution_kind === 'in_kind'
                    ? (form.in_kind_unit_label || 'unités')
                    : form.currency}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.max_rate}
                  onChange={e => setForm({ ...form, max_rate: e.target.value })}
                  placeholder={form.contribution_kind === 'in_kind' ? '5' : '50000'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {form.rate_mode === "free" && (
            <p className="text-[10px] text-amber-600 italic">
              Mode libre : chaque membre choisit
              {form.contribution_kind === 'in_kind' ? ' sa propre quantité' : ' son propre montant'}
              {' à la souscription.'}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Devise</label>
              <input
                type="text"
                value={form.currency}
                onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Unité (nom local)</label>
              <input
                type="text"
                value={form.share_unit_name}
                onChange={e => setForm({ ...form, share_unit_name: e.target.value })}
                placeholder="nom, bouche, main..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Caisse physique par défaut (optionnel)
            </label>
            <select
              value={form.default_account}
              onChange={e => setForm({ ...form, default_account: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">— Caisse principale (par défaut) —</option>
              {accounts.filter(a => a.is_active).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.account_type})</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1 italic">
              Caisse physique où entrent par défaut les flux de cette cotisation.
              Le solde virtuel sera traçable séparément.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="multi-shares"
              checked={form.allows_multiple_shares}
              onChange={e => setForm({ ...form, allows_multiple_shares: e.target.checked })}
            />
            <label htmlFor="multi-shares" className="text-xs text-gray-700">
              Permettre plusieurs parts par membre
            </label>
          </div>

          {form.allows_multiple_shares && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Maximum de parts par membre
              </label>
              <input
                type="number"
                min="1"
                value={form.max_shares_per_member}
                onChange={e => setForm({ ...form, max_shares_per_member: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          {/* ── Pattern de restitution + méthode d'attribution ────── */}
          <div className="bg-[#F1F8E8]/60 border border-[#87C241]/30 rounded-lg p-3 space-y-3">
            <div>
              <label className="text-xs text-[#43793F] font-semibold block mb-1">
                Mode de restitution des fonds *
              </label>
              <select
                value={form.payout_pattern}
                onChange={e => setForm({
                  ...form,
                  payout_pattern: e.target.value as typeof form.payout_pattern,
                  // Banque scolaire impose le mode libre
                  rate_mode: e.target.value === 'individual_savings' ? 'free' : form.rate_mode,
                })}
                className="w-full px-3 py-2 border border-[#87C241]/40 rounded-lg text-sm bg-white"
              >
                <option value="rotating">
                  Tontine rotative — 1 bénéficiaire / séance
                </option>
                <option value="individual_savings">
                  Épargne individuelle — banque scolaire (cumul personnel restitué en fin de cycle)
                </option>
                <option value="collective_savings">
                  Caisse commune — pas de bénéficiaire désigné
                </option>
              </select>
              {form.payout_pattern === 'individual_savings' && (
                <p className="text-[10px] text-amber-700 mt-1 leading-snug">
                  ⚠ La banque scolaire force le mode <strong>Libre</strong> : chaque
                  membre choisit son montant à chaque séance. Aucune distribution
                  n'a lieu pendant le cycle — les restitutions sont générées
                  automatiquement à la clôture du cycle.
                </p>
              )}
            </div>

            {form.payout_pattern === 'rotating' && (
              <div>
                <label className="text-xs text-[#43793F] font-semibold block mb-1">
                  Méthode d'attribution par défaut *
                </label>
                <select
                  value={form.default_acquisition_method}
                  onChange={e => setForm({
                    ...form,
                    default_acquisition_method: e.target.value as typeof form.default_acquisition_method,
                  })}
                  className="w-full px-3 py-2 border border-[#87C241]/40 rounded-lg text-sm bg-white"
                >
                  <option value="random">Tirage aléatoire</option>
                  <option value="sequential">Tour de rôle</option>
                  <option value="auction">Enchère (plus offrant)</option>
                  <option value="vote">Vote des membres</option>
                  <option value="need_based">Selon le besoin (décision bureau)</option>
                  <option value="manual">Attribution manuelle</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Cette méthode est appliquée par défaut à chaque cycle utilisant cette tontine.
                  Le bureau peut toujours l'overrider au cycle ou à la séance.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Annuler</button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.name}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {saveMut.isPending && <Loader2 size={12} className="animate-spin" />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Calcule les N prochaines dates de séance pour le formulaire de création
// (preview local, sans round-trip backend). Reproduit la logique de
// apps/cycles/session_generation.py.
function computePreviewDates(
  form: {
    start_date: string; end_date: string;
    session_frequency: string;
    recurrence_kind: string;
    recurrence_nth: number;
    recurrence_weekday: number;
    recurrence_day_of_month: number;
  },
  limit: number,
): string[] {
  if (!form.start_date || form.recurrence_kind === 'none') return [];
  const start = new Date(form.start_date + 'T00:00:00');
  const end = form.end_date
    ? new Date(form.end_date + 'T00:00:00')
    : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  const out: string[] = [];

  const pyWeekday = (d: Date) => (d.getDay() + 6) % 7; // 0=lundi

  if (form.recurrence_kind === 'fixed_day_of_month') {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end && out.length < limit) {
      const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      const actualDay = Math.min(form.recurrence_day_of_month, lastDay);
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), actualDay);
      if (d >= start && d <= end) out.push(d.toISOString().slice(0, 10));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return out;
  }

  if (form.recurrence_kind === 'nth_weekday') {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end && out.length < limit) {
      const firstWd = pyWeekday(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
      const offset = (form.recurrence_weekday - firstWd + 7) % 7;
      const firstOccDay = 1 + offset;
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      let day: number;
      if (form.recurrence_nth === 5) {
        day = firstOccDay + 28;
        if (day > daysInMonth) day = firstOccDay + 21;
      } else {
        day = firstOccDay + (form.recurrence_nth - 1) * 7;
      }
      if (day <= daysInMonth) {
        const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
        if (d >= start && d <= end) out.push(d.toISOString().slice(0, 10));
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return out;
  }

  if (form.recurrence_kind === 'every_weekday') {
    const daysOffset = (form.recurrence_weekday - pyWeekday(start) + 7) % 7;
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() + daysOffset);
    const stepDays = form.session_frequency === 'biweekly' ? 14 : 7;
    while (cursor <= end && out.length < limit) {
      if (cursor >= start) out.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + stepDays);
    }
    return out;
  }

  return out;
}
