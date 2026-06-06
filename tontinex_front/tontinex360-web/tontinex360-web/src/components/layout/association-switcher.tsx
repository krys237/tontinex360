'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronsUpDown, Check, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';

export function AssociationSwitcher() {
  const router = useRouter();
  const { associations, activeAssociation, switchAssociation } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!associations || associations.length === 0) return null;

  const handleSelect = async (slug: string) => {
    if (slug === activeAssociation?.slug) {
      setOpen(false);
      return;
    }
    const target = associations.find(a => a.slug === slug);
    if (!target) return;
    setBusy(true);
    try {
      await switchAssociation(target);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative px-3 py-3">
      {/* Card "Association active" — style Figma */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="w-full bg-gradient-to-br from-[#87C241] to-[#43793F] rounded-xl p-3 shadow-sm hover:shadow-md transition disabled:opacity-50 text-left"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] text-white/80 uppercase tracking-wider font-semibold">
            Association active
          </span>
          {associations.length > 1 && (
            <ChevronsUpDown size={14} className="text-white/70 shrink-0" />
          )}
        </div>
        <p className="text-sm font-bold text-white truncate">
          {activeAssociation?.name ?? 'Aucune'}
        </p>
        <p className="text-[10px] text-white/70 mt-0.5">
          {associations.length} association{associations.length > 1 ? 's' : ''} · Plan Pro
        </p>
      </button>

      {open && associations.length > 1 && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
          {associations.map(a => (
            <button
              key={a.id}
              onClick={() => handleSelect(a.slug)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#F1F8E8] text-xs transition first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white shrink-0">
                <Building2 size={11} />
              </div>
              <span className="flex-1 min-w-0 text-gray-700 truncate font-medium">{a.name}</span>
              {a.slug === activeAssociation?.slug && (
                <Check size={14} className="text-[#87C241] shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
