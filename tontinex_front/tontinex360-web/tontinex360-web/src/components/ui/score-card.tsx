"use client";

interface ScoreStat {
  label: string;
  value: string | number;
}

interface Props {
  /** Score numérique géant (ex: 92) */
  score: number | string;
  /** Petite étiquette descriptive (ex: "Très engagé") */
  label?: string;
  /** Statistiques en bas (2 colonnes) */
  stats?: ScoreStat[];
  /** Variation tonique : vert (positif) ou ambre (neutre) */
  tone?: "positive" | "neutral";
}

const TONE = {
  positive: {
    gradient: "from-[#87C241] to-[#43793F]",
    text: "text-white",
  },
  neutral: {
    gradient: "from-amber-300 to-amber-500",
    text: "text-white",
  },
};

/**
 * Score Member style Figma : carte verte gradient avec gros chiffre et stats en bas.
 */
export function ScoreCard({ score, label, stats, tone = "positive" }: Props) {
  const t = TONE[tone];
  return (
    <div
      className={`bg-gradient-to-br ${t.gradient} rounded-2xl p-5 shadow-[0_8px_24px_rgba(67,121,63,0.18)] ${t.text}`}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold">{score}</span>
        {label && <span className="text-sm opacity-90">{label}</span>}
      </div>

      {stats && stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-white/15 backdrop-blur rounded-lg p-2.5"
            >
              <p className="text-[10px] opacity-90 uppercase tracking-wide">
                {s.label}
              </p>
              <p className="text-sm font-bold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
