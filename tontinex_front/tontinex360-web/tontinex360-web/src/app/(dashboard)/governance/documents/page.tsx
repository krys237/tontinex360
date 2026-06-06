"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { governanceApi, type GovernanceDocument } from "@/lib/api/governance";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatDate } from "@/lib/utils/format";
import {
  FileText, Download, Plus, Loader2, X, Upload, Eye, Edit2, Trash2,
} from "lucide-react";

const DOC_TYPE: Record<string, string> = {
  charter: "Charte",
  bylaws: "Statuts",
  internal_rules: "Règlement intérieur",
  amendment: "Amendement",
  other: "Autre",
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GovernanceDocument | null>(null);
  const [viewing, setViewing] = useState<GovernanceDocument | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterActive, setFilterActive] = useState<string>("");

  const canManage = p.isPresident || p.canAny(['*', 'governance.*']);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["governance-documents", filterType, filterActive],
    queryFn: () => governanceApi.documents({
      ...(filterType ? { doc_type: filterType } : {}),
      ...(filterActive ? { is_active: filterActive === 'true' } : {}),
    }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => governanceApi.removeDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance-documents"] }),
  });

  return (
    <>
      <Topbar title="Documents officiels" />

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">Tous types</option>
            {Object.entries(DOC_TYPE).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={e => setFilterActive(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">Tous (actifs + archivés)</option>
            <option value="true">Actifs uniquement</option>
            <option value="false">Archivés uniquement</option>
          </select>
        </div>

        {canManage && (
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
          >
            <Plus size={14} /> Nouveau document
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <DocumentForm
          document={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["governance-documents"] });
          }}
        />
      )}

      {viewing && (
        <DocumentViewer
          document={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading && <p className="p-6 text-center text-sm text-gray-400">Chargement…</p>}
        {!isLoading && documents.length === 0 && (
          <div className="p-12 text-center">
            <FileText size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun document publié.</p>
          </div>
        )}
        {documents.length > 0 && (
          <div className="divide-y divide-gray-100">
            {documents.map(d => (
              <div key={d.id} className="flex items-start gap-3 p-4 hover:bg-gray-50">
                <div className="w-10 h-10 bg-[#F1F8E8] rounded-lg flex items-center justify-center text-[#43793F] shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900">{d.title}</h3>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      v{d.version}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                      {DOC_TYPE[d.doc_type] ?? d.doc_type}
                    </span>
                    {!d.is_active && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">
                        Archivé
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {d.effective_date ? `En vigueur depuis ${formatDate(d.effective_date)}` : "Pas de date d'effet"}
                  </p>
                  {d.content && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">{d.content}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setViewing(d)}
                    className="p-1.5 text-gray-400 hover:text-blue-600"
                    title="Consulter"
                  >
                    <Eye size={14} />
                  </button>
                  {d.file && (
                    <a
                      href={d.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-emerald-600"
                      title="Télécharger le fichier"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  {canManage && (
                    <>
                      <button
                        onClick={() => setEditing(d)}
                        className="p-1.5 text-gray-400 hover:text-[#43793F]"
                        title="Modifier"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Supprimer "${d.title}" ?`)) {
                            removeMut.mutate(d.id);
                          }
                        }}
                        disabled={removeMut.isPending}
                        className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function DocumentViewer({ document, onClose }: {
  document: GovernanceDocument;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-[#43793F] shrink-0" />
            <h3 className="text-base font-semibold truncate">{document.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
              {DOC_TYPE[document.doc_type] ?? document.doc_type}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              Version {document.version}
            </span>
            {!document.is_active && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">
                Archivé
              </span>
            )}
            {document.effective_date && (
              <span className="text-xs text-gray-500">
                En vigueur depuis le {formatDate(document.effective_date)}
              </span>
            )}
          </div>

          {document.content ? (
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {document.content}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Pas de contenu textuel.</p>
          )}

          {document.file && (
            <a
              href={document.file}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#F1F8E8] text-[#43793F] rounded-lg text-sm font-medium hover:bg-[#FFE5CC]"
            >
              <Download size={14} /> Télécharger le fichier joint
            </a>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentForm({ document, onClose, onSaved }: {
  document: GovernanceDocument | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    doc_type: document?.doc_type ?? "bylaws" as GovernanceDocument['doc_type'],
    title: document?.title ?? "",
    content: document?.content ?? "",
    version: document?.version ?? "1.0",
    is_active: document?.is_active ?? true,
    effective_date: document?.effective_date ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      // Si un fichier est sélectionné, on envoie en multipart
      if (file) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (v === null || v === undefined || v === "") return;
          fd.append(k, String(v));
        });
        fd.append('file', file);
        return document
          ? governanceApi.updateDocument(document.id, fd)
          : governanceApi.createDocument(fd);
      }
      // Sinon JSON simple
      const payload: any = { ...form };
      if (!payload.effective_date) delete payload.effective_date;
      return document
        ? governanceApi.updateDocument(document.id, payload)
        : governanceApi.createDocument(payload);
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
            {document ? "Modifier le document" : "Nouveau document"}
          </h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type *</label>
              <select
                value={form.doc_type}
                onChange={e => setForm({ ...form, doc_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="bylaws">Statuts</option>
                <option value="charter">Charte</option>
                <option value="internal_rules">Règlement intérieur</option>
                <option value="amendment">Amendement</option>
                <option value="other">Autre</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Version</label>
              <input
                type="text"
                value={form.version}
                onChange={e => setForm({ ...form, version: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Statuts de l'association v1.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Contenu / Résumé</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={4}
              placeholder="Texte ou résumé du document (Markdown supporté)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Date d&apos;effet</label>
            <input
              type="date"
              value={form.effective_date}
              onChange={e => setForm({ ...form, effective_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Fichier joint {document?.file ? "(remplacer)" : "(optionnel)"}
            </label>
            {document?.file && !file && (
              <p className="text-[10px] text-gray-500 mb-1">
                Fichier actuel : <a href={document.file} target="_blank" rel="noopener noreferrer" className="text-[#43793F] underline">voir</a>
                {' · '}En attache un nouveau pour remplacer.
              </p>
            )}
            {!file ? (
              <label
                htmlFor="document-file-input"
                className="flex flex-col items-center justify-center gap-1 px-4 py-5 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#43793F] hover:bg-[#F1F8E8]/40 transition"
              >
                <Upload size={20} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  Cliquer pour choisir un fichier
                </span>
                <span className="text-[10px] text-gray-400">
                  PDF, DOC, DOCX, TXT, MD, PNG, JPG (max 10 Mo)
                </span>
                <input
                  id="document-file-input"
                  type="file"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
                  className="hidden"
                />
              </label>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg">
                <FileText size={16} className="text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {(file.size / 1024).toFixed(1)} Ko · {file.type || 'Document'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Retirer le fichier"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
            />
            <span className="text-sm text-gray-700">Document actif (en vigueur)</span>
          </label>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">Annuler</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.title}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            {document ? 'Enregistrer' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
}
