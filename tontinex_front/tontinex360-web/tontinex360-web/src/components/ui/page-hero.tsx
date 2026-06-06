"use client";
import { ReactNode } from "react";

interface Props {
  breadcrumb?: string;
  title: string;
  description?: string;
  /** Hero card : vert gradient avec titre H2 + body + boutons à gauche, stats à droite */
  hero?: {
    title: string;
    description?: string;
    primaryCta?: { label: string; onClick: () => void; icon?: ReactNode };
    secondaryCta?: { label: string; onClick: () => void };
    stats?: Array<{ label: string; value: string | number }>;
    statsTitle?: string;
  };
  /** Actions à droite du titre H1 (boutons "Historique", "+ Nouveau", etc.) */
  actions?: ReactNode;
}

/**
 * Hero header page (style Figma TontineX360).
 * Pattern : breadcrumb gris → titre H1 gros vert → description → hero gradient (optionnel) → actions
 */
export function PageHero({ breadcrumb, title, description, hero, actions }: Props) {
  return (
    <div className="mb-4 sm:mb-6">
      {breadcrumb && (
        <p className="text-xs text-gray-500 mb-1 font-medium">{breadcrumb}</p>
      )}

      {/* Header H1 + actions */}
      {title && (
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#43793F] leading-tight">{title}</h1>
            {description && (
              <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-2xl">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Hero gradient card (optionnel) */}
      {hero && (
        <div className="mt-4 sm:mt-6 rounded-2xl p-4 sm:p-6 lg:p-7 bg-gradient-to-br from-[#87C241] to-[#43793F] shadow-[0_12px_40px_rgba(67,121,63,0.18)] grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 sm:gap-6">
          <div className="text-white">
            <h2 className="text-xl sm:text-2xl font-bold mb-2 leading-tight">{hero.title}</h2>
            {hero.description && (
              <p className="text-white/90 text-xs sm:text-sm mb-4 sm:mb-5 max-w-xl">{hero.description}</p>
            )}
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
              {hero.primaryCta && (
                <button
                  onClick={hero.primaryCta.onClick}
                  className="inline-flex items-center gap-2 bg-white text-[#43793F] hover:bg-white/95 font-semibold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg shadow-sm transition"
                >
                  {hero.primaryCta.icon}
                  {hero.primaryCta.label}
                </button>
              )}
              {hero.secondaryCta && (
                <button
                  onClick={hero.secondaryCta.onClick}
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 font-semibold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg transition backdrop-blur-sm"
                >
                  {hero.secondaryCta.label}
                </button>
              )}
            </div>
          </div>

          {hero.stats && hero.stats.length > 0 && (
            <div className="bg-white/10 border border-white/20 rounded-xl p-3 sm:p-4 backdrop-blur-sm">
              {hero.statsTitle && (
                <p className="text-[10px] sm:text-[11px] text-white/70 font-semibold uppercase tracking-wider mb-2 sm:mb-3">
                  {hero.statsTitle}
                </p>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-2.5">
                {hero.stats.map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between gap-2 sm:gap-3">
                    <span className="text-[11px] sm:text-xs text-white/80">{s.label}</span>
                    <span className="text-sm sm:text-base font-bold text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
