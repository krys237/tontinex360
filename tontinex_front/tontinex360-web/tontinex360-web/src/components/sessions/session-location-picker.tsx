"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { membersApi } from "@/lib/api/members";
import { MapPin, Building, User, Edit3 } from "lucide-react";

export type LocationMode = 'siege' | 'member' | 'custom';

interface Props {
  /** Lieu par défaut du cycle (siège social typiquement) */
  defaultCycleLocation?: string | null;
  /** Membre hôte actuel (FK Membership), si défini */
  hostMemberId?: string | null;
  /** Adresse libre actuelle (peut être identique à defaultCycleLocation) */
  location: string;
  /** Membership suggéré (ex : bénéficiaire d'une séance random) */
  suggestedHostId?: string | null;
  suggestedHostLabel?: string | null;
  onChange: (next: { location: string; host_member: string | null }) => void;
}

export function SessionLocationPicker({
  defaultCycleLocation, hostMemberId, location, onChange,
  suggestedHostId, suggestedHostLabel,
}: Props) {
  // Inférer le mode initial depuis les props
  const initialMode: LocationMode = hostMemberId
    ? 'member'
    : (defaultCycleLocation && location === defaultCycleLocation)
      ? 'siege'
      : 'custom';
  const [mode, setMode] = useState<LocationMode>(initialMode);
  const [pickedMemberId, setPickedMemberId] = useState<string | null>(hostMemberId ?? suggestedHostId ?? null);
  const [customAddress, setCustomAddress] = useState<string>(location || '');

  const { data: members = [] } = useQuery({
    queryKey: ["members", "active", "for-host"],
    queryFn: () => membersApi.list({ status: "active" }),
    enabled: mode === 'member',
  });

  // Propage les changements vers le parent
  useEffect(() => {
    if (mode === 'siege') {
      onChange({ location: defaultCycleLocation || '', host_member: null });
    } else if (mode === 'member') {
      const m = members.find((x: any) => x.id === pickedMemberId);
      const memberLabel = m ? `Chez ${m.user_name ?? m.id}` : '';
      onChange({ location: memberLabel || customAddress, host_member: pickedMemberId });
    } else {
      onChange({ location: customAddress, host_member: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pickedMemberId, customAddress]);

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-500 block">Lieu de la séance</label>

      {/* Sélecteur de mode */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => setMode('siege')}
          className={`flex items-center justify-center gap-1 px-2 py-2 text-xs rounded-lg border transition ${
            mode === 'siege'
              ? 'border-[#43793F] bg-[#F1F8E8] text-[#43793F]'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Building size={12} /> Siège
        </button>
        <button
          type="button"
          onClick={() => setMode('member')}
          className={`flex items-center justify-center gap-1 px-2 py-2 text-xs rounded-lg border transition ${
            mode === 'member'
              ? 'border-[#43793F] bg-[#F1F8E8] text-[#43793F]'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <User size={12} /> Chez membre
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`flex items-center justify-center gap-1 px-2 py-2 text-xs rounded-lg border transition ${
            mode === 'custom'
              ? 'border-[#43793F] bg-[#F1F8E8] text-[#43793F]'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Edit3 size={12} /> Adresse libre
        </button>
      </div>

      {/* Détail selon mode */}
      {mode === 'siege' && (
        <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600 flex items-center gap-1">
          <MapPin size={12} className="text-gray-400" />
          {defaultCycleLocation || <em className="text-gray-400">Lieu par défaut non défini sur le cycle</em>}
        </div>
      )}

      {mode === 'member' && (
        <div className="space-y-1">
          {suggestedHostId && suggestedHostLabel && pickedMemberId !== suggestedHostId && (
            <button
              type="button"
              onClick={() => setPickedMemberId(suggestedHostId)}
              className="w-full text-left text-xs px-2 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100"
            >
              💡 Suggestion : <strong>{suggestedHostLabel}</strong> (bénéficiaire de cette séance)
            </button>
          )}
          <select
            value={pickedMemberId ?? ''}
            onChange={e => setPickedMemberId(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">— Choisir un membre —</option>
            {members.map((m: any) => (
              <option key={m.id} value={m.id}>{m.user_name}</option>
            ))}
          </select>
          <input
            type="text"
            value={customAddress}
            onChange={e => setCustomAddress(e.target.value)}
            placeholder="Précisions (quartier, point de repère)…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
          />
        </div>
      )}

      {mode === 'custom' && (
        <input
          type="text"
          value={customAddress}
          onChange={e => setCustomAddress(e.target.value)}
          placeholder="Adresse complète"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      )}
    </div>
  );
}
