"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { memberFeesApi, type MembershipFeesConfig } from "@/lib/api/member-fees";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { formatXAF } from "@/lib/utils/format";
import {
  ArrowLeft, Coins, PiggyBank, Loader2, CheckCircle2, AlertCircle,
  Save,
} from "lucide-react";

export default function MembershipFeesSettingsPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const canEdit = p.isPresident || p.canAny(['*', 'members.*']);

  const { data: config, isLoading } = useQuery({
    queryKey: ["membership-fees-config"],
    queryFn: () => memberFeesApi.getConfig(),
  });

  const [form, setForm] = useState<MembershipFeesConfig | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (config && !form) setForm(config);
  }, [config, form]);

  const saveMut = useMutation({
    mutationFn: () => memberFeesApi.updateConfig(form!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["membership-fees-config"] });
      setForm(data);
      setSuccess(true);
      setError("");
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.error || "Erreur");
    },
  });

  if (isLoading || !form) {
    return (
      <>
        <Topbar title="Frais d'adhésion" />
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          Chargement…
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Frais d'adhésion" />

      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour aux paramètres
      </Link>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg mb-4">
        <p className="font-semibold mb-1">À propos de ces frais</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong>Inscription</strong> : montant fixe payé une seule fois à l'adhésion. Si "porte d'entrée", le membre reste en attente tant que pas payé.</li>
          <li><strong>Fond de membre</strong> : montant à payer à vie OU à chaque nouveau cycle. Échelonnement possible, non-remboursable.</li>
          <li>Les versements sont enregistrés depuis la fiche du membre.</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
          <CheckCircle2 size={14} /> Configuration enregistrée
        </div>
      )}

      <div className="space-y-4">
        {/* ── Inscription ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <Coins size={18} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Inscription</h3>
                <p className="text-xs text-gray-500">Frais one-shot à l'adhésion</p>
              </div>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.registration.enabled}
                onChange={e => setForm({
                  ...form,
                  registration: { ...form.registration, enabled: e.target.checked },
                })}
                disabled={!canEdit}
                className="w-4 h-4"
              />
              <span className="ml-2 text-xs text-gray-700">Activé</span>
            </label>
          </div>

          {form.registration.enabled && (
            <div className="space-y-3 pl-13">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Montant (XAF)</label>
                <input
                  type="number" min="0"
                  value={form.registration.amount}
                  onChange={e => setForm({
                    ...form,
                    registration: { ...form.registration, amount: Number(e.target.value) || 0 },
                  })}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Aperçu : <strong>{formatXAF(form.registration.amount)}</strong>
                </p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.registration.is_entry_gate}
                  onChange={e => setForm({
                    ...form,
                    registration: { ...form.registration, is_entry_gate: e.target.checked },
                  })}
                  disabled={!canEdit}
                  className="mt-0.5"
                />
                <div className="text-xs text-gray-700">
                  <span className="font-medium">Porte d'entrée (bloque l'accès)</span>
                  <p className="text-gray-500">
                    Si activé, le nouveau membre reste en statut <code>pending</code> jusqu'au paiement complet de l'inscription. Il ne peut ni voter, ni cotiser, ni recevoir de tontine.
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* ── Fond de membre ────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <PiggyBank size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Fond de membre</h3>
                <p className="text-xs text-gray-500">Capital de l'association, échelonnable</p>
              </div>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.membership_fund.enabled}
                onChange={e => setForm({
                  ...form,
                  membership_fund: { ...form.membership_fund, enabled: e.target.checked },
                })}
                disabled={!canEdit}
                className="w-4 h-4"
              />
              <span className="ml-2 text-xs text-gray-700">Activé</span>
            </label>
          </div>

          {form.membership_fund.enabled && (
            <div className="space-y-3 pl-13">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Montant (XAF)</label>
                <input
                  type="number" min="0"
                  value={form.membership_fund.amount}
                  onChange={e => setForm({
                    ...form,
                    membership_fund: { ...form.membership_fund, amount: Number(e.target.value) || 0 },
                  })}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Aperçu : <strong>{formatXAF(form.membership_fund.amount)}</strong>
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Périodicité</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setForm({
                      ...form,
                      membership_fund: { ...form.membership_fund, scope: 'lifetime' },
                    })}
                    className={`px-3 py-2 rounded-lg text-xs border ${
                      form.membership_fund.scope === 'lifetime'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    🌱 À vie<br />
                    <span className="text-[10px] opacity-75">1 fois par membre</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setForm({
                      ...form,
                      membership_fund: { ...form.membership_fund, scope: 'per_cycle' },
                    })}
                    className={`px-3 py-2 rounded-lg text-xs border ${
                      form.membership_fund.scope === 'per_cycle'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    🔄 Par cycle<br />
                    <span className="text-[10px] opacity-75">À chaque nouveau cycle</span>
                  </button>
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.membership_fund.allow_partial}
                  onChange={e => setForm({
                    ...form,
                    membership_fund: { ...form.membership_fund, allow_partial: e.target.checked },
                  })}
                  disabled={!canEdit}
                  className="mt-0.5"
                />
                <div className="text-xs text-gray-700">
                  <span className="font-medium">Échelonnement autorisé</span>
                  <p className="text-gray-500">Le membre peut payer en plusieurs versements.</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.membership_fund.blocks_access}
                  onChange={e => setForm({
                    ...form,
                    membership_fund: { ...form.membership_fund, blocks_access: e.target.checked },
                  })}
                  disabled={!canEdit}
                  className="mt-0.5"
                />
                <div className="text-xs text-gray-700">
                  <span className="font-medium">Bloquer l'accès si non payé (déconseillé)</span>
                  <p className="text-gray-500">
                    Par défaut, le fond non payé n'empêche pas le membre d'utiliser
                    l'app. Son solde wallet affiche juste un déficit (<em>-50 000 XAF</em>).
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
            >
              {saveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={14} />}
              Enregistrer la configuration
            </button>
          </div>
        )}
      </div>
    </>
  );
}
