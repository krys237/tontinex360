"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { governanceApi, type Announcement } from "@/lib/api/governance";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatRelative } from "@/lib/utils/format";
import {
  Plus, Pin, AlertTriangle, Info, Bell, Edit2, Trash2,
  Loader2, X, CheckCheck, Paperclip,
} from "lucide-react";



const PRIORITY_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  urgent:  { label: 'Urgent',     cls: 'bg-red-100 text-red-700 border-red-200',    icon: AlertTriangle },
  high:    { label: 'Important',  cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Bell },
  normal:  { label: 'Normal',     cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: Info },
  low:     { label: 'Information',cls: 'bg-gray-100 text-gray-700 border-gray-200', icon: Info },
};

const AUDIENCE: Record<string, string> = {
  all: 'Tous les membres',
  bureau: 'Bureau uniquement',
  active: 'Membres actifs',
};

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const canManage = p.isPresident || p.canAny(['*', 'governance.*', 'governance.announce']);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => governanceApi.announcements(),
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => governanceApi.markAnnouncementRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => governanceApi.removeAnnouncement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  return (
    <>
      <Topbar title="Annonces" />

      {canManage && (
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
          >
            <Plus size={14} /> Nouvelle annonce
          </button>
        </div>
      )}

      {(showForm || editing) && (
        <AnnouncementForm
          announcement={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["announcements"] });
          }}
        />
      )}

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          Chargement…
        </div>
      )}

      {!isLoading && announcements.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bell size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Aucune annonce publiée.</p>
        </div>
      )}

      <div className="space-y-3">
        {announcements.map(a => {
          const meta = PRIORITY_BADGE[a.priority] ?? PRIORITY_BADGE.normal;
          const Icon = meta.icon;
          return (
            <div
              key={a.id}
              className={`bg-white rounded-xl border p-4 transition ${
                a.is_pinned ? 'border-[#43793F]' : 'border-gray-200'
              } ${!a.is_read ? 'shadow-sm' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${meta.cls}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {a.is_pinned && (
                      <Pin size={12} className="text-[#43793F]" />
                    )}
                    <h3 className="text-sm font-semibold text-gray-900">{a.title}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${meta.cls}`}>
                      {meta.label}
                    </span>
                    {!a.is_published && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                        Brouillon
                      </span>
                    )}
                    {!a.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[#43793F]" title="Non lue" />
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2">
                    {a.author_name ?? 'Système'} · {formatRelative(a.created_at)} ·
                    Public : {AUDIENCE[a.audience] ?? a.audience}
                  </p>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{a.content}</div>
                  {a.attachment && (
                    <a
                      href={a.attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-[#43793F] hover:underline"
                    >
                      <Paperclip size={11} /> Pièce jointe
                    </a>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    {!a.is_read && (
                      <button
                        onClick={() => markReadMut.mutate(a.id)}
                        disabled={markReadMut.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] rounded-full hover:bg-emerald-100"
                      >
                        <CheckCheck size={11} /> Marquer comme lue
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button
                          onClick={() => setEditing(a)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-[10px] rounded-full hover:bg-gray-200"
                        >
                          <Edit2 size={11} /> Modifier
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Supprimer "${a.title}" ?`)) {
                              removeMut.mutate(a.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-[10px] rounded-full hover:bg-red-100"
                        >
                          <Trash2 size={11} /> Supprimer
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AnnouncementForm({
  announcement, onClose, onSaved,
}: {
  announcement: Announcement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: announcement?.title ?? "",
    content: announcement?.content ?? "",
    priority: announcement?.priority ?? "normal" as Announcement['priority'],
    audience: announcement?.audience ?? "all" as Announcement['audience'],
    is_pinned: announcement?.is_pinned ?? false,
    is_published: announcement?.is_published ?? true,
    starts_at: announcement?.starts_at?.slice(0, 16) ?? "",
    ends_at: announcement?.ends_at?.slice(0, 16) ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      const payload: any = { ...form };
      if (!payload.starts_at) payload.starts_at = null;
      if (!payload.ends_at) payload.ends_at = null;

      if (file) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined) fd.append(k, String(v));
        });
        fd.append('attachment', file);
        return announcement
          ? governanceApi.updateAnnouncement(announcement.id, fd)
          : governanceApi.createAnnouncement(fd);
      }

      return announcement
        ? governanceApi.updateAnnouncement(announcement.id, payload)
        : governanceApi.createAnnouncement(payload);
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => {
      const data = err.response?.data;
      const msg = typeof data === "string"
        ? data
        : data?.detail || (data
            ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' ; ')
            : "Erreur");
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {announcement ? "Modifier l'annonce" : "Nouvelle annonce"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Réunion exceptionnelle…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Message *</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={5}
              placeholder="Détails de l'annonce…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Priorité</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="low">Information</option>
                <option value="normal">Normale</option>
                <option value="high">Importante</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Public</label>
              <select
                value={form.audience}
                onChange={e => setForm({ ...form, audience: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">Tous les membres</option>
                <option value="active">Membres actifs uniquement</option>
                <option value="bureau">Bureau uniquement</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Publication (optionnel)</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={e => setForm({ ...form, starts_at: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Expiration (optionnel)</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={e => setForm({ ...form, ends_at: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Pièce jointe (optionnel)</label>
            <input
              type="file"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_pinned}
                onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Épingler en haut</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={e => setForm({ ...form, is_published: e.target.checked })}
              />
              <span className="text-sm text-gray-700">Publier (sinon brouillon)</span>
            </label>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.title || !form.content}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            {announcement ? 'Enregistrer' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
}
