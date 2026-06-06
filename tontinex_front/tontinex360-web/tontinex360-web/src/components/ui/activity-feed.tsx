"use client";
import { ReactNode } from "react";
import { getInitials } from "@/lib/utils/format";

export interface ActivityItem {
  /** id unique pour key */
  id: string;
  /** Avatar : initiales OU élément JSX custom (icône, image) */
  avatar?: { firstName?: string; lastName?: string } | ReactNode;
  /** Titre principal (typo bold) */
  title: string;
  /** Description sous le titre (typo gris) */
  description?: string;
  /** Horodatage relatif à droite (ex: "Aujourd'hui à 09:42") */
  timestamp?: string;
  /** Pastille de statut (Validé / En attente / etc.) */
  badge?: { label: string; color: string };
}

interface Props {
  title?: string;
  items: ActivityItem[];
  emptyMessage?: string;
}

function renderAvatar(avatar: ActivityItem["avatar"]) {
  if (!avatar) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-medium">
        ?
      </div>
    );
  }
  if (typeof avatar === "object" && "firstName" in avatar) {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#87C241] to-[#43793F] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
        {getInitials(avatar.firstName || "", avatar.lastName || "")}
      </div>
    );
  }
  return <>{avatar}</>;
}

/**
 * Timeline "Activité Temps Réel" (style Figma).
 * Liste verticale d'items avec avatar + texte + horodatage.
 */
export function ActivityFeed({ title, items, emptyMessage }: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      {title && (
        <h3 className="text-sm font-semibold text-[#1E3233] mb-4">{title}</h3>
      )}
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">
          {emptyMessage || "Aucune activité pour le moment."}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5">
              {renderAvatar(item.avatar)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#1E3233] truncate">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-[11px] text-gray-500 truncate">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                {item.timestamp && (
                  <p className="text-[10px] text-gray-400 whitespace-nowrap">
                    {item.timestamp}
                  </p>
                )}
                {item.badge && (
                  <span
                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${item.badge.color}`}
                  >
                    {item.badge.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
