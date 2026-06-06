"use client";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import {
  memberImportsApi, type ImportMode, type PreviewResponse, type ImportBatch,
} from "@/lib/api/member-imports";
import { usePermissions } from "@/lib/hooks/use-permissions";
import {
  Upload, FileSpreadsheet, Download, Loader2, CheckCircle2,
  AlertCircle, XCircle, Users, MailPlus, ArrowLeft, History,
} from "lucide-react";

type Step = 'upload' | 'preview' | 'result';

export default function ImportMembersPage() {
  const p = usePermissions();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>('invite');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ImportBatch | null>(null);
  const [error, setError] = useState<string>('');

  const canImport = p.isBureau || p.isPresident || p.canAny(['members.*', '*']);

  const { data: history = [] } = useQuery({
    queryKey: ["member-imports"],
    queryFn: () => memberImportsApi.list(),
  });

  const previewMut = useMutation({
    mutationFn: (f: File) => memberImportsApi.preview(f),
    onSuccess: (data) => {
      setPreview(data);
      setStep('preview');
      setError('');
    },
    onError: (err: any) => {
      const data = err.response?.data;
      const msg = Array.isArray(data?.errors)
        ? data.errors.join(' • ')
        : typeof data === 'string' ? data : data?.error || "Erreur d'analyse";
      setError(msg);
    },
  });

  const importMut = useMutation({
    mutationFn: () => memberImportsApi.import(file!, mode),
    onSuccess: (data) => {
      setResult(data);
      setStep('result');
      qc.invalidateQueries({ queryKey: ["member-imports"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === 'string' ? data : data?.error || "Erreur d'import");
    },
  });

  const onPickFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setError('');
    previewMut.mutate(f);
  };

  if (!canImport) {
    return (
      <>
        <Topbar title="Import de membres" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
          Accès réservé au bureau.
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Import de membres" />

      <Link href="/members" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour à la liste des membres
      </Link>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-4">
        <StepBadge active={step === 'upload'} done={step !== 'upload'} num={1} label="Fichier" />
        <div className="flex-1 h-px bg-gray-200" />
        <StepBadge active={step === 'preview'} done={step === 'result'} num={2} label="Aperçu & mode" />
        <div className="flex-1 h-px bg-gray-200" />
        <StepBadge active={step === 'result'} done={false} num={3} label="Résultat" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1 - Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet size={18} className="text-[#43793F]" />
            <h2 className="text-base font-semibold">Téléverser un fichier Excel</h2>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg mb-4">
            <strong>Format attendu :</strong> .xlsx avec les colonnes suivantes (en-têtes flexibles) :
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              <li><code>telephone</code> (obligatoire) — synonymes : phone, tel, mobile, numero</li>
              <li><code>first_name</code> — synonymes : prenom, prénom, firstname</li>
              <li><code>last_name</code> — synonymes : nom, lastname, surname</li>
              <li><code>email</code> (optionnel)</li>
              <li><code>member_number</code> (optionnel) — synonymes : matricule, code</li>
            </ul>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <a
              href={memberImportsApi.templateUrl()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Download size={14} /> Télécharger un modèle vierge
            </a>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              onPickFile(f ?? null);
            }}
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-[#43793F] hover:bg-[#F1F8E8]/50 transition"
          >
            <Upload size={28} className="text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-700">
              {previewMut.isPending
                ? "Analyse en cours…"
                : "Cliquez ou glissez votre fichier .xlsx ici"}
            </p>
            {file && (
              <p className="text-xs text-gray-500 mt-2">📄 {file.name}</p>
            )}
            {previewMut.isPending && (
              <Loader2 size={20} className="animate-spin text-[#43793F] mx-auto mt-2" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* STEP 2 - Preview */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Lignes totales" value={preview.stats.total} color="text-gray-900" />
            <StatCard label="✓ Valides" value={preview.stats.ok} color="text-emerald-600" />
            <StatCard label="↺ Déjà membres" value={preview.stats.duplicate} color="text-amber-600" />
            <StatCard label="✗ Invalides" value={preview.stats.invalid + preview.stats.doublon_fichier} color="text-red-600" />
          </div>

          {/* Mode */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold mb-3">Mode d'import</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('invite')}
                className={`p-4 rounded-lg border-2 text-left transition ${
                  mode === 'invite'
                    ? 'border-[#43793F] bg-[#F1F8E8]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MailPlus size={16} className="text-[#43793F]" />
                  <span className="font-medium text-sm">Inviter</span>
                </div>
                <p className="text-xs text-gray-600">
                  Envoie une invitation à chaque personne. Elle doit cliquer pour rejoindre.
                  <strong> Recommandé</strong> si les membres ne sont pas encore inscrits.
                </p>
              </button>
              <button
                onClick={() => setMode('direct')}
                className={`p-4 rounded-lg border-2 text-left transition ${
                  mode === 'direct'
                    ? 'border-[#43793F] bg-[#F1F8E8]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users size={16} className="text-[#43793F]" />
                  <span className="font-medium text-sm">Ajout direct</span>
                </div>
                <p className="text-xs text-gray-600">
                  Crée immédiatement les memberships actifs (sans validation du membre).
                  Pour onboarder une association existante.
                </p>
              </button>
            </div>
          </div>

          {/* Table preview */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Aperçu des lignes</h3>
              <span className="text-xs text-gray-500">{preview.rows.length} lignes</span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Téléphone</th>
                    <th className="px-3 py-2">Prénom</th>
                    <th className="px-3 py-2">Nom</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.rows.map(r => (
                    <tr key={r.row_number} className={
                      r.validation === 'ok' ? 'bg-emerald-50/30'
                      : r.validation === 'duplicate' ? 'bg-amber-50/30'
                      : 'bg-red-50/30'
                    }>
                      <td className="px-3 py-2 text-gray-500">{r.row_number}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.parsed_telephone || '—'}</td>
                      <td className="px-3 py-2">{r.parsed_first_name || '—'}</td>
                      <td className="px-3 py-2">{r.parsed_last_name || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{r.parsed_email || '—'}</td>
                      <td className="px-3 py-2">
                        <ValidationBadge validation={r.validation} message={r.validation_message} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setStep('upload'); setPreview(null); setFile(null); }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              ← Choisir un autre fichier
            </button>
            <button
              onClick={() => importMut.mutate()}
              disabled={importMut.isPending || preview.stats.ok === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50 hover:bg-[#43793F]"
            >
              {importMut.isPending && <Loader2 size={12} className="animate-spin" />}
              {mode === 'invite'
                ? `Envoyer ${preview.stats.ok} invitations`
                : `Créer ${preview.stats.ok} memberships`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 - Result */}
      {step === 'result' && result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={26} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold">Import terminé</h2>
            <p className="text-sm text-gray-500 mt-1">{result.filename}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <StatCard label="✓ Succès" value={result.success_count} color="text-emerald-600" />
            <StatCard label="↺ Ignorées" value={result.skipped_count} color="text-amber-600" />
            <StatCard label="✗ Erreurs" value={result.error_count} color="text-red-600" />
          </div>

          {result.rows && result.rows.some(r => r.status === 'error') && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-red-700 mb-2">Détail des erreurs</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                {result.rows.filter(r => r.status === 'error').map(r => (
                  <div key={r.id} className="text-xs text-red-700 mb-1">
                    Ligne {r.row_number} ({r.parsed_telephone}) : {r.error_message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                setStep('upload'); setFile(null); setPreview(null); setResult(null);
              }}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg"
            >
              Nouvel import
            </button>
            <Link
              href="/members"
              className="inline-flex items-center gap-1 px-4 py-2 bg-[#43793F] text-white text-sm rounded-lg hover:bg-[#43793F]"
            >
              <Users size={14} /> Voir les membres
            </Link>
          </div>
        </div>
      )}

      {/* Historique */}
      {step === 'upload' && history.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <History size={14} className="text-gray-400" />
            <h3 className="text-sm font-semibold">Historique des imports</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2">Fichier</th>
                <th className="px-4 py-2">Par</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2 text-right">Succès</th>
                <th className="px-4 py-2 text-right">Ignorées</th>
                <th className="px-4 py-2 text-right">Erreurs</th>
                <th className="px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs">{b.filename || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">{b.imported_by}</td>
                  <td className="px-4 py-2 text-xs">
                    {b.mode === 'invite' ? 'Invitation' : 'Direct'}
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-600 font-medium">{b.success_count}</td>
                  <td className="px-4 py-2 text-right text-amber-600">{b.skipped_count}</td>
                  <td className="px-4 py-2 text-right text-red-600">{b.error_count}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {new Date(b.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StepBadge({ active, done, num, label }: {
  active: boolean; done: boolean; num: number; label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
        done ? 'bg-emerald-600 text-white'
        : active ? 'bg-[#43793F] text-white'
        : 'bg-gray-200 text-gray-500'
      }`}>
        {done ? <CheckCircle2 size={14} /> : num}
      </div>
      <span className={`text-xs font-medium ${active || done ? 'text-gray-900' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ValidationBadge({ validation, message }: { validation: string; message: string }) {
  const meta: Record<string, { label: string; color: string; Icon: any }> = {
    ok: { label: 'Valide', color: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle2 },
    duplicate: { label: 'Déjà membre', color: 'bg-amber-100 text-amber-700', Icon: AlertCircle },
    invalid: { label: 'Invalide', color: 'bg-red-100 text-red-700', Icon: XCircle },
    doublon_fichier: { label: 'Doublon', color: 'bg-red-100 text-red-700', Icon: XCircle },
  };
  const m = meta[validation] || meta.invalid;
  const Icon = m.Icon;
  return (
    <span
      title={message}
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${m.color}`}
    >
      <Icon size={10} /> {m.label}
    </span>
  );
}
