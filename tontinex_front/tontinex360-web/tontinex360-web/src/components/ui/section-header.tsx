"use client";
import { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Petit éyebrow gris au-dessus du titre (ex: "Communauté") */
  eyebrow?: string;
}

/**
 * En-tête de section style Figma : eyebrow + H1 + description + actions à droite.
 * Utiliser pour le 2ᵉ niveau de page (sous le Topbar).
 */
export function SectionHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="mb-4 sm:mb-5">
      {eyebrow && (
        <p className="text-xs text-gray-500 font-medium mb-1">{eyebrow}</p>
      )}
      <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#1E3233] leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
