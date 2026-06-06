"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { membersApi } from "@/lib/api/members";
import { Bug, X } from "lucide-react";

export function AuthDebug() {
  const [open, setOpen] = useState(false);
  const { user, activeAssociation, currentMembership } = useAuthStore();
  const p = usePermissions();

  // Test direct de la requête memberships pour voir ce qui se passe
  const memberQuery = useQuery({
    queryKey: ['debug-memberships'],
    queryFn: () => membersApi.list(),
    enabled: open && !!user?.telephone && !!activeAssociation?.slug,
    retry: false,
  });

  if (process.env.NODE_ENV === 'production') return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-purple-700 text-xs font-mono font-semibold"
        style={{ zIndex: 999999 }}
      >
        <Bug size={12} /> DEBUG
      </button>
    );
  }

  const norm = (s: string | null | undefined) =>
    (s || '').replace(/[\s-]/g, '').toLowerCase();

  return (
    <div
      className="fixed top-12 left-1/2 -translate-x-1/2 w-[520px] max-h-[85vh] bg-white border-2 border-purple-300 rounded-xl shadow-2xl overflow-hidden"
      style={{ zIndex: 999999 }}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-purple-600 text-white">
        <span className="text-xs font-mono font-semibold">🐛 DEBUG — État Auth</span>
        <button onClick={() => setOpen(false)} className="hover:opacity-70">
          <X size={14} />
        </button>
      </div>
      <div className="p-3 overflow-y-auto text-xs font-mono space-y-2" style={{ maxHeight: '75vh' }}>
        <div>
          <p className="text-gray-500 font-semibold">User</p>
          <pre className="bg-gray-50 p-2 rounded text-[10px]">
            {JSON.stringify({ id: user?.id, telephone: user?.telephone, name: `${user?.first_name} ${user?.last_name}` }, null, 2)}
          </pre>
        </div>

        <div>
          <p className="text-gray-500 font-semibold">Active association</p>
          <pre className="bg-gray-50 p-2 rounded text-[10px]">
            {JSON.stringify({ slug: activeAssociation?.slug, name: activeAssociation?.name }, null, 2)}
          </pre>
          <p className="text-[10px] text-gray-400 mt-1">
            localStorage: {typeof window !== 'undefined' ? localStorage.getItem('active_association') : '?'}
          </p>
        </div>

        <div className="border-t border-purple-200 pt-2">
          <p className="text-purple-700 font-bold">🔍 Test live : GET /members/memberships/</p>

          {memberQuery.isLoading && <p className="text-amber-600">⏳ Chargement...</p>}

          {memberQuery.isError && (
            <div className="bg-red-50 border border-red-200 p-2 rounded">
              <p className="text-red-700 font-bold">❌ ERREUR REQUÊTE</p>
              <pre className="text-[10px] text-red-600 whitespace-pre-wrap">
                {JSON.stringify({
                  status: (memberQuery.error as any)?.response?.status,
                  data: (memberQuery.error as any)?.response?.data,
                  message: (memberQuery.error as any)?.message,
                }, null, 2)}
              </pre>
            </div>
          )}

          {memberQuery.data && (() => {
            const data: any = memberQuery.data;
            const list: any[] = Array.isArray(data) ? data : (data?.results ?? []);
            return (
              <div>
                <p className="text-emerald-600">
                  ✓ Type reçu : <code className="bg-yellow-100 px-1">{Array.isArray(data) ? 'array' : typeof data}</code>
                  {' · '}{list.length} item(s)
                </p>
                {!Array.isArray(data) && (
                  <pre className="bg-amber-50 p-2 rounded text-[10px] mb-1">
                    Raw : {JSON.stringify(Object.keys(data), null, 2)}
                  </pre>
                )}
                <pre className="bg-gray-50 p-2 rounded text-[10px] max-h-40 overflow-y-auto">
                  {JSON.stringify(list.map((m: any) => ({
                    id: String(m.id).slice(0, 8) + '...',
                    user_name: m.user_name,
                    user_telephone: m.user_telephone,
                    is_founder: m.is_founder,
                    is_active: m.is_active,
                    status: m.status,
                  })), null, 2)}
                </pre>
                <div className="mt-1 text-[10px]">
                  <p>Mon téléphone normalisé : <code className="bg-yellow-100 px-1">{norm(user?.telephone)}</code></p>
                  {list.map((m: any) => (
                    <p key={m.id}>
                      Match {m.user_telephone} → <code className="bg-yellow-100 px-1">{norm(m.user_telephone)}</code> :
                      {norm(m.user_telephone) === norm(user?.telephone)
                        ? ' ✅ MATCH'
                        : ' ❌ no match'}
                    </p>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="border-t border-gray-200 pt-2">
          <p className="text-gray-500 font-semibold">Current membership (state)</p>
          {currentMembership ? (
            <pre className="bg-gray-50 p-2 rounded text-[10px]">
              {JSON.stringify({
                id: currentMembership.id,
                is_founder: (currentMembership as any).is_founder,
                status: currentMembership.status,
                roles: currentMembership.roles?.map(mr => ({
                  active: mr.is_active,
                  role: mr.role?.slug,
                  is_bureau_role: mr.role?.is_bureau_role,
                  perms: mr.role?.permissions,
                })),
              }, null, 2)}
            </pre>
          ) : (
            <p className="text-red-600 text-[10px] font-semibold">⚠ null</p>
          )}
        </div>

        <div>
          <p className="text-gray-500 font-semibold">Permissions calculées</p>
          <pre className="bg-gray-50 p-2 rounded text-[10px]">
            {JSON.stringify({
              isBureau: p.isBureau,
              isPresident: p.isPresident,
              isLambda: p.isLambda,
              landingPath: p.landingPath,
            }, null, 2)}
          </pre>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={() => {
              if (typeof window === 'undefined') return;
              localStorage.clear();
              sessionStorage.clear();
              location.reload();
            }}
            className="w-full px-3 py-2 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700"
          >
            🗑 Vider tout & recharger
          </button>
        </div>
      </div>
    </div>
  );
}
