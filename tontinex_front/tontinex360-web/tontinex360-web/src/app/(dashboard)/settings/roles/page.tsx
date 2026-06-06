"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { membersApi } from "@/lib/api/members";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { ArrowLeft, Plus, Shield, Trash2, Lock, Briefcase, Loader2, Edit2 } from "lucide-react";
import type { Role } from "@/lib/types/member";

// Catalogue des permissions disponibles, regroupées par module
const PERMISSION_GROUPS: { label: string; perms: { code: string; label: string }[] }[] = [
  {
    label: 'Membres',
    perms: [
      { code: 'members.*', label: 'Tout (membres)' },
      { code: 'members.invite', label: 'Inviter' },
      { code: 'members.approve_request', label: 'Approuver les adhésions' },
      { code: 'members.approve_resignation', label: 'Approuver les démissions' },
    ],
  },
  {
    label: 'Finance',
    perms: [
      { code: 'finance.*', label: 'Tout (finance)' },
      { code: 'finance.collect', label: 'Collecter cotisations' },
      { code: 'finance.loans', label: 'Gérer prêts' },
      { code: 'finance.audit', label: 'Auditer' },
      { code: 'finance.view', label: 'Consulter' },
    ],
  },
  {
    label: 'Tontines & Séances',
    perms: [
      { code: 'tontine.*', label: 'Tout (tontines)' },
      { code: 'tontine.manage', label: 'Gérer types de cotisation' },
      { code: 'session.*', label: 'Tout (séances)' },
      { code: 'cycles.*', label: 'Tout (cycles)' },
    ],
  },
  {
    label: 'Wallets',
    perms: [
      { code: 'wallets.view_all', label: 'Voir tous les wallets' },
      { code: 'wallets.manual_adjustment', label: 'Ajustement manuel' },
      { code: 'wallets.recompute', label: 'Recalculer soldes' },
    ],
  },
  {
    label: 'Procurations',
    perms: [
      { code: 'proxies.approve', label: 'Approuver procurations' },
      { code: 'proxies.view_all', label: 'Voir toutes les procurations' },
    ],
  },
  {
    label: 'Gouvernance & Sanctions',
    perms: [
      { code: 'governance.*', label: 'Tout (gouvernance)' },
      { code: 'sanctions.*', label: 'Tout (sanctions)' },
      { code: 'sanctions.collect', label: 'Encaisser sanctions' },
    ],
  },
  {
    label: 'Association',
    perms: [
      { code: 'association.update', label: 'Modifier les paramètres' },
      { code: '*', label: '⭐ TOUS LES DROITS (réservé président)' },
    ],
  },
];

export default function RolesSettingsPage() {
  const qc = useQueryClient();
  const p = usePermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => membersApi.roles(),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => membersApi.removeRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles"] }),
  });

  if (!p.isPresident && !p.canAny(['*', 'members.*'])) {
    return (
      <>
        <Topbar title="Rôles & permissions" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">Cette page est réservée au président et aux administrateurs.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Rôles & permissions" />

      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Définissez les rôles personnalisés de votre association.
          Les rôles <strong>système</strong> (fondateur, etc.) sont irrévocables.
        </p>
        <button
          onClick={() => { setEditing(null); setShowCreate(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#43793F] text-white rounded-lg text-sm font-medium hover:bg-[#43793F]"
        >
          <Plus size={14} /> Nouveau rôle
        </button>
      </div>

      {(showCreate || editing) && (
        <RoleModal
          role={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => {
            setShowCreate(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["roles"] });
          }}
        />
      )}

      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
          Chargement…
        </div>
      )}

      <div className="space-y-2">
        {roles.map((r: Role) => (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                r.is_bureau_role ? "bg-[#F1F8E8] text-[#43793F]" : "bg-gray-100 text-gray-500"
              }`}>
                {r.is_bureau_role ? <Briefcase size={18} /> : <Shield size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">{r.name}</h3>
                  {r.is_bureau_role && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F1F8E8] text-[#43793F]">
                      Bureau
                    </span>
                  )}
                  {r.is_system && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 inline-flex items-center gap-1">
                      <Lock size={10} /> Système
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">niveau {r.hierarchy_level}</span>
                </div>
                {r.description && (
                  <p className="text-xs text-gray-500 mb-2">{r.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map(perm => (
                    <span key={perm} className="text-[10px] font-mono bg-gray-50 text-gray-700 px-1.5 py-0.5 rounded">
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
              {!r.is_system && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditing(r)}
                    className="p-1.5 text-gray-400 hover:text-[#43793F]"
                    title="Modifier"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer le rôle "${r.name}" ?`)) {
                        removeMut.mutate(r.id);
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
        ))}
      </div>
    </>
  );
}

function RoleModal({
  role, onClose, onSaved,
}: {
  role: Role | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: role?.name ?? "",
    slug: role?.slug ?? "",
    description: role?.description ?? "",
    permissions: role?.permissions ?? [],
    is_bureau_role: role?.is_bureau_role ?? false,
    hierarchy_level: role?.hierarchy_level ?? 10,
  });
  const [error, setError] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        slug: form.slug || form.name.toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      };
      return role
        ? membersApi.updateRole(role.id, payload)
        : membersApi.createRole(payload);
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => {
      const data = err.response?.data;
      const msg = typeof data === "string"
        ? data
        : data?.detail || data?.error
          || (data ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' ; ') : '')
          || "Erreur";
      setError(msg);
    },
  });

  const togglePerm = (code: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(code)
        ? f.permissions.filter(p => p !== code)
        : [...f.permissions, code],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {role ? `Modifier le rôle « ${role.name} »` : 'Nouveau rôle'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Censeur"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Niveau hiérarchique</label>
              <input
                type="number"
                min="0"
                value={form.hierarchy_level}
                onChange={e => setForm({ ...form, hierarchy_level: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">0 = plus élevé (président). 10 par défaut.</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Rôle chargé de…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_bureau_role}
              onChange={e => setForm({ ...form, is_bureau_role: e.target.checked })}
            />
            <span className="text-sm text-gray-700">Rôle de bureau (accès au tableau de bord)</span>
          </label>

          <div>
            <label className="text-xs text-gray-500 block mb-2 font-semibold">Permissions accordées</label>
            <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-3 bg-gray-50">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-gray-700 mb-1">{group.label}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {group.perms.map(perm => (
                      <label key={perm.code} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(perm.code)}
                          onChange={() => togglePerm(perm.code)}
                        />
                        <code className="font-mono text-[10px] bg-white px-1 rounded">{perm.code}</code>
                        <span className="text-gray-600 truncate">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Wildcard supporté : <code>*</code> = tout, <code>app.*</code> = tout dans une app.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
            Annuler
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.name}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#43793F] text-white text-sm rounded-lg disabled:opacity-50"
          >
            {mut.isPending && <Loader2 size={12} className="animate-spin" />}
            {role ? 'Enregistrer' : 'Créer le rôle'}
          </button>
        </div>
      </div>
    </div>
  );
}
