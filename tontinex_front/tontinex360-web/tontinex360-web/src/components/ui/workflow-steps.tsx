"use client";
import { LucideIcon } from "lucide-react";

export interface WorkflowStep {
  icon: LucideIcon;
  label: string;
  description?: string;
}

interface Props {
  title?: string;
  description?: string;
  steps: WorkflowStep[];
}

/**
 * Visualisation horizontale d'un workflow en N étapes.
 * Style Figma "Workflow des Procurations" : 4 cartes côte-à-côte
 * (icône pastille verte + label + description courte).
 */
export function WorkflowSteps({ title, description, steps }: Props) {
  const stepsCount = Math.min(steps.length, 4);
  const gridClass =
    stepsCount === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : stepsCount === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-5 shadow-[0_2px_8px_rgba(67,121,63,0.04)]">
      {(title || description) && (
        <div className="mb-4 sm:mb-5">
          {title && (
            <h3 className="text-base font-semibold text-[#1E3233]">{title}</h3>
          )}
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div className={`grid gap-3 ${gridClass}`}>
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className="bg-[#F1F8E8]/60 border border-[#87C241]/20 rounded-xl p-4 text-center"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 mx-auto bg-white border border-[#87C241]/30 rounded-full flex items-center justify-center text-[#43793F] mb-2.5">
                <Icon size={20} />
              </div>
              <p className="text-sm font-semibold text-[#1E3233]">
                {step.label}
              </p>
              {step.description && (
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                  {step.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
