"use client";
import { ReactNode } from "react";

type Variant = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

interface Props {
  variant: Variant;
  children: ReactNode;
  icon?: ReactNode;
}

const STYLES: Record<Variant, string> = {
  success:  "bg-[#F1F8E8] text-[#43793F] border-[#C7E29F]",
  primary:  "bg-[#F1F8E8] text-[#43793F] border-[#C7E29F]",
  warning:  "bg-[#FBF6CF] text-[#9A7A1F] border-[#EFDB99]",
  danger:   "bg-red-50    text-red-700    border-red-200",
  info:     "bg-blue-50   text-blue-700   border-blue-200",
  neutral:  "bg-gray-100  text-gray-600   border-gray-200",
};

/**
 * Badge statut style Figma : pill colorée avec border et icône optionnelle
 */
export function StatusBadge({ variant, icon, children }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STYLES[variant]}`}
    >
      {icon}
      {children}
    </span>
  );
}
