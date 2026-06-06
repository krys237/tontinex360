"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { eventsApi, type Event, type AudienceMode } from "@/lib/api/events";
import { cyclesApi } from "@/lib/api/cycles";
import { membersApi } from "@/lib/api/members";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatDate } from "@/lib/utils/format";
import {
  Calendar, MapPin, Plus, Edit2, Trash2, Loader2, X, Clock,
  Users, UserCheck,
} from "lucide-react";

const EVENT_TYPE: Record<string, string> = {
  ag: "Assemblée générale",
  age: "AG extraordinaire",
  meeting: "Réunion",
  celebration: "Célébration",
  workshop: "Atelier",
  other: "Autre",
};

const STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: "Planifié", color: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Confirmé", color: "bg-emerald-100 text-emerald-700" },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700" },
  completed: { label: "Terminé", color: "bg-gray-100 text-gray-700" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-700" },
};

export default function EventsPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const canManage = p.isPresident || p.canAny(['*', 'events.*']);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", statusFilter, typeFilter],
    queryFn: () => eventsApi.list({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { event_type: typeFilter } : {}),
    }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => eventsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  return (
    <>
      <Topbar title="Événements" />

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">Tous types</option>
            {Object.entries(EVENT_TYPE).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">Tous statuts</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {canManage && (
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
          >
            <Plus size={14} /> Nouvel événement
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <EventForm
          event={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["events"] });
          }}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading && <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>}
        {!isLoading && events.length === 0 && (
          <div className="p-12 text-center">
            <Calendar size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun événement programmé.</p>
          </div>
        )}
        {events.length > 0 && (
          <div className="divide-y divide-gray-100">
            {events.map(e => {
              const st = STATUS[e.status] ?? { label: e.status, color: "bg-gray-100 text-gray-700" };
              return (
                <div key={e.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#F1F8E8] rounded-lg flex items-center justify-center text-[#43793F] shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">{e.title}</h3>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                          {EVENT_TYPE[e.event_type] ?? e.event_type}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      {e.description && (
                        <p className="text-sm text-gray-600 mb-2">{e.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {formatDate(e.date)}
                        </span>
                        {e.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {e.start_time.slice(0, 5)}
                            {e.end_time ? ` – ${e.end_time.slice(0, 5)}` : ""}
                          </span>
                        )}
                        {e.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {e.location}
                          </span>
                        )}
                        {e.audience_mode === 'all' ? (
                          <span className="flex items-center gap-1 text-emerald-700">
                            <Users size={11} /> Tous les membres
                            {typeof e.invitees_count === 'number' && ` (${e.invitees_count})`}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-700">
                            <UserCheck size={11} /> {e.invitees_count ?? e.invitee_names?.length ?? 0} invité{(e.invitees_count ?? 0) > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditing(e)}
                          className="p-1.5 text-gray-400 hover:text-[#43793F]"
                          title="Modifier"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer "${e.title}" ?`)) {
                              removeMut.mutate(e.id);
                            }
                          }}
                          disabled={removeMut.isPending}
                          className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function EventForm({ event, onClose, onSaved }: {
  event: Event | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: event?.title ?? "",
    event_type: event?.event_type ?? "meeting",
    description: event?.description ?? "",
    date: event?.date ?? "",
    start_time: event?.start_time?.slice(0, 5) ?? "",
    end_time: event?.end_time?.slice(0, 5) ?? "",
    location: event?.location ?? "",
    status: event?.status ?? "planned" as Event['status'],
    cycle: event?.cycle ?? "",
    // Audience
    audience_mode: (event?.audience_mode ?? "all") as AudienceMode,
    invitees: (event?.invitees ?? event?.invitee_names?.map(i => i.id) ?? []) as string[],
  });
  const [error, setError] = useState("");

  const { data: cycles = [] } = useQuery({
    queryKey: ["cycles"],
    queryFn: () => cyclesApi.list(),
  });

  // Chargement des membres actifs (uniquement si mode 'specific')
  const { data: activeMembers = [] } = useQuery({
    queryKey: ["members", "active"],
    queryFn: () => membersApi.list({ status: "active" }),
    enabled: form.audience_mode === 'specific',
  });

  const toggleInvitee = (id: string) => {
    setForm(prev => ({
      ...prev,
      invitees: prev.invitees.includes(id)
        ? prev.invitees.filter(x => x !== id)
        : [...prev.invitees, id],
    }));
  };

  const mut = useMutation({
    mutationFn: () => {
      const formatTime = (t: string) =>
        t ? (t.length === 5 ? t + ':00' : t) : null;
      const payload: any = {
        ...form,
        start_time: formatTime(form.start_time),
        end_time: formatTime(form.end_time),
        cycle: form.cycle || null,
        // Si audience='all', on ignore la liste invitees (le backend la garde
        // mais ne s'en sert pas — on envoie [] pour ne pas la polluer).
        invitees: form.audience_mode === 'specific' ? form.invitees : [],
      };
      return event
        ? eventsApi.update(event.id, payload)
        : eventsApi.create(payload);
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => {
      const data = err.response?.data;
      const msg = typeof data === "string"
        ? data
        : data?.detail
          || (data ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' ; ') : '')
          || "Erreur";
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {event ? "Modifier l'événement" : "Nouvel événement"}
          </h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Assemblée générale 2026"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type *</label>
              <select
                value={form.event_type}
                onChange={e => setForm({ ...form, event_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="ag">Assemblée générale</option>
                <option value="age">AG extraordinaire</option>
                <option value="meeting">Réunion</option>
                <option value="celebration">Célébration</option>
                <option value="workshop">Atelier</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Statut</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="planned">Planifié</option>
                <option value="confirmed">Confirmé</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Terminé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Ordre du jour, informations importantes…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Heure début</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Heure fin</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Lieu</label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="Salle des fêtes, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Cycle (optionnel)</label>
            <select
              value={form.cycle}
              onChange={e => setForm({ ...form, cycle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Aucun cycle</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* ── Audience : tous les membres ou sélection ─────────────── */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <label className="text-xs text-amber-900 font-medium block">
              Qui est concerné par cet événement ?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, audience_mode: 'all', invitees: [] })}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition ${
                  form.audience_mode === 'all'
                    ? 'border-[#43793F] bg-white text-[#43793F] font-medium'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                <Users size={14} /> Tous les membres
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, audience_mode: 'specific' })}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition ${
                  form.audience_mode === 'specific'
                    ? 'border-[#43793F] bg-white text-[#43793F] font-medium'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                <UserCheck size={14} /> Membres sélectionnés
              </button>
            </div>

            {form.audience_mode === 'specific' && (
              <div className="pt-2 border-t border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-900">
                    {form.invitees.length} membre{form.invitees.length > 1 ? 's' : ''} sélectionné{form.invitees.length > 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        invitees: activeMembers.map((m: any) => m.id),
                      })}
                      className="text-[10px] text-[#43793F] hover:underline"
                    >
                      Tout sélectionner
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, invitees: [] })}
                      className="text-[10px] text-gray-500 hover:underline"
                    >
                      Tout désélectionner
                    </button>
                  </div>
                </div>
                <div className="bg-white border border-amber-200 rounded-lg max-h-44 overflow-y-auto">
                  {activeMembers.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-3 text-center">
                      Aucun membre actif disponible.
                    </p>
                  ) : (
                    activeMembers.map((m: any) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-amber-50 text-xs border-b border-amber-100 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={form.invitees.includes(m.id)}
                          onChange={() => toggleInvitee(m.id)}
                        />
                        <span className="flex-1">{m.user_name ?? m.id}</span>
                        {m.member_number && (
                          <span className="text-[10px] text-gray-400">
                            #{m.member_number}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
                {form.invitees.length === 0 && (
                  <p className="text-[10px] text-red-600">
                    Sélectionnez au moins un membre.
                  </p>
                )}
              </div>
            )}

            {form.audience_mode === 'all' && (
              <p className="text-[10px] text-amber-700">
                Tous les membres actifs de l'association recevront une notification
                et seront listés dans le pointage de présence.
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Annuler</button>
          <button
            onClick={() => mut.mutate()}
            disabled={
              mut.isPending
              || !form.title
              || !form.date
              || (form.audience_mode === 'specific' && form.invitees.length === 0)
            }
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            {event ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
