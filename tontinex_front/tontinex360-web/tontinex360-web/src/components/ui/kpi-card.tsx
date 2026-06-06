"use client";
import { LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: { value: string; positive?: boolean };
  /** Style Figma : tint coloré pour l'icône (vert lime, accent, danger…) */
  tint?: "primary" | "accent" | "danger" | "info";
}

const TINTS = {
  primary: { bg: "bg-[#F1F8E8]", text: "text-[#43793F]" },
  accent:  { bg: "bg-[#FBF6CF]", text: "text-[#9A7A1F]" },
  danger:  { bg: "bg-red-50",    text: "text-red-700" },
  info:    { bg: "bg-blue-50",   text: "text-blue-700" },
};

/**
 * KPI card style Figma : icône pastille + label + valeur grosse + sub
 */
export function KpiCard({ icon: Icon, label, value, sublabel, trend, tint = "primary" }: Props) {
  const t = TINTS[tint];
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 sm:p-5 shadow-[0_2px_8px_rgba(67,121,63,0.06)] hover:shadow-[0_4px_12px_rgba(67,121,63,0.1)] transition">
      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
        <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wider truncate">{label}</p>
        {Icon && (
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${t.bg} ${t.text} flex items-center justify-center shrink-0`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-bold text-[#1E3233]">{value}</span>
        {trend && (
          <span className={`text-xs font-semibold ${trend.positive ? "text-[#43793F]" : "text-red-500"}`}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
      {sublabel && <p className="text-[11px] sm:text-xs text-gray-500 mt-1 truncate">{sublabel}</p>}
    </div>
  );
}
