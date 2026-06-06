"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { ArrowLeft, Loader2, Check, Building2, MessageSquare } from "lucide-react";

interface AssociationSettings {
  // Général
  currency: string;
  welcome_message: string;
  // Wallet
  auto_compensate_defaults: boolean;
  compensation_sources: string[];
  compensation_window: 'current_session' | 'current_cycle';
  rounding_target: 'treasury' | 'first_member' | 'distribute';
  early_resignation_settlement: boolean;
  // Proxy
  require_document: boolean;
  require_approval: boolean;
}

const DEFAULTS: AssociationSettings = {
  currency: 'XAF',
  welcome_message: '',
  auto_compensate_defaults: false,
  compensation_sources: ['auction_premium', 'loan_interest', 'sanction_payment'],
  compensation_window: 'current_session',
  rounding_target: 'treasury',
  early_resignation_settlement: false,
  require_document: false,
  require_approval: true,
};

function flattenSettings(settings: any): AssociationSettings {
  const w = settings?.wallet ?? {};
  const p = settings?.proxy ?? {};
  return {
    currency: settings?.currency ?? DEFAULTS.currency,
    welcome_message: settings?.welcome_message ?? '',
    auto_compensate_defaults: w.auto_compensate_defaults ?? DEFAULTS.auto_compensate_defaults,
    compensation_sources: w.compensation_sources ?? DEFAULTS.compensation_sources,
    compensation_window: w.compensation_window ?? DEFAULTS.compensation_window,
    rounding_target: w.rounding_target ?? DEFAULTS.rounding_target,
    early_resignation_settlement: w.early_resignation_settlement ?? DEFAULTS.early_resignation_settlement,
    require_document: p.require_document ?? DEFAULTS.require_document,
    require_approval: p.require_approval ?? DEFAULTS.require_approval,
  };
}

function nestSettings(form: AssociationSettings, original: any) {
  return {
    ...(original || {}),
    currency: form.currency,
    welcome_message: form.welcome_message,
    wallet: {
      ...(original?.wallet || {}),
      auto_compensate_defaults: form.auto_compensate_defaults,
      compensation_sources: form.compensation_sources,
      compensation_window: form.compensation_window,
      rounding_target: form.rounding_target,
      early_resignation_settlement: form.early_resignation_settlement,
    },
    proxy: {
      ...(original?.proxy || {}),
      require_document: form.require_document,
      require_approval: form.require_approval,
    },
  };
}

const SOURCES = [
  { v: 'auction_premium', l: "Primes d'enchère" },
  { v: 'loan_interest', l: "Intérêts de prêts" },
  { v: 'sanction_payment', l: "Sanctions payées" },
];

export default function AssociationSettingsPage() {
  const { activeAssociation, setActiveAssociation } = useAuthStore();
  const p = usePermissions();
  const [form, setForm] = useState<AssociationSettings>(DEFAULTS);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (activeAssociation?.settings) {
      setForm(flattenSettings(activeAssociation.settings));
    }
  }, [activeAssociation?.id]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!activeAssociation) throw new Error("Aucune association");
      const merged = nestSettings(form, activeAssociation.settings);
      const updated = await authApi.updateAssociation(activeAssociation.slug, {
        settings: merged,
      });
      return updated;
    },
    onSuccess: (updated) => {
      setActiveAssociation(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.detail || data?.error || "Erreur");
    },
  });

  if (!p.isPresident && !p.canAny(['*', 'association.update'])) {
    return (
      <>
        <Topbar title="Paramètres de l'association" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">Cette page est réservée au président.</p>
        </div>
      </>
    );
  }

  const toggleSource = (v: string) => {
    setForm(f => ({
      ...f,
      compensation_sources: f.compensation_sources.includes(v)
        ? f.compensation_sources.filter(x => x !== v)
        : [...f.compensation_sources, v],
    }));
  };

  return (
    <>
      <Topbar title="Paramètres de l'association" />
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour
      </Link>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-lg mb-4 flex items-center gap-2">
          <Check size={14} /> Paramètres enregistrés
        </div>
      )}
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

      <form
        onSubmit={(e) => { e.preventDefault(); setError(""); mut.mutate(); }}
        className="space-y-4 max-w-3xl"
      >
        {/* Général */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Building2 size={14} className="text-[#43793F]" /> Général
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Devise</label>
              <input
                type="text"
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                placeholder="XAF"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </section>

        {/* Message de bienvenue */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare size={14} className="text-[#43793F]" /> Message de bienvenue
          </h2>
          <p className="text-xs text-gray-500 mb-2">
            Affiché aux nouveaux membres lors de leur première connexion.
          </p>
          <textarea
            value={form.welcome_message}
            onChange={e => setForm(f => ({ ...f, welcome_message: e.target.value }))}
            rows={5}
            placeholder="Bienvenue dans notre association ! Voici quelques règles importantes…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </section>

        {/* Wallet */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Portefeuilles virtuels</h2>

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.auto_compensate_defaults}
              onChange={e => setForm(f => ({ ...f, auto_compensate_defaults: e.target.checked }))}
            />
            <span className="text-sm text-gray-700">Compensation automatique des cotisations impayées</span>
          </label>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sources de compensation</label>
              <div className="space-y-1">
                {SOURCES.map(s => (
                  <label key={s.v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.compensation_sources.includes(s.v)}
                      onChange={() => toggleSource(s.v)}
                    />
                    <span className="text-xs text-gray-700">{s.l}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fenêtre de compensation</label>
              <select
                value={form.compensation_window}
                onChange={e => setForm(f => ({ ...f, compensation_window: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="current_session">Séance courante uniquement</option>
                <option value="current_cycle">Tout le cycle courant</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Arrondi des centimes</label>
              <select
                value={form.rounding_target}
                onChange={e => setForm(f => ({ ...f, rounding_target: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="treasury">Vers la trésorerie</option>
                <option value="first_member">Vers le premier membre</option>
                <option value="distribute">Distribuer 1 centime aux premiers</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.early_resignation_settlement}
                onChange={e => setForm(f => ({ ...f, early_resignation_settlement: e.target.checked }))}
              />
              <span className="text-xs text-gray-700">Régler les démissions immédiatement</span>
            </label>
          </div>
        </section>

        {/* Procurations */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Procurations</h2>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.require_document}
              onChange={e => setForm(f => ({ ...f, require_document: e.target.checked }))}
            />
            <span className="text-sm text-gray-700">Document signé / signature obligatoire à la création</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.require_approval}
              onChange={e => setForm(f => ({ ...f, require_approval: e.target.checked }))}
            />
            <span className="text-sm text-gray-700">Approbation par le bureau requise (sinon auto-approuvée)</span>
          </label>
        </section>

        <button
          type="submit"
          disabled={mut.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F] disabled:opacity-50"
        >
          {mut.isPending && <Loader2 size={14} className="animate-spin" />}
          Enregistrer les paramètres
        </button>
      </form>
    </>
  );
}
