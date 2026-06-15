// Money & number formatting (XAF / FCFA, French style: space thousands separator).

function group(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** 125000 -> "125 000". Negative-safe, rounds to integer. */
export function formatNumber(amount: number | string | null | undefined): string {
  const n = Number(amount) || 0;
  const sign = n < 0 ? '-' : '';
  return sign + group(String(Math.abs(Math.round(n))));
}

/** 125000 -> "125 000 FCFA". */
export function formatXAF(amount: number | string | null | undefined): string {
  return `${formatNumber(amount)} FCFA`;
}

/** Signed amount for ledgers: 5000 -> "+5 000 FCFA", -2000 -> "-2 000 FCFA". */
export function formatXAFSigned(amount: number | string | null | undefined): string {
  const n = Number(amount) || 0;
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${group(String(Math.abs(Math.round(n))))} FCFA`;
}

/**
 * Coerce a value that may be a plain string OR a message-like object
 * (e.g. the backend returns reply_preview / last_message as `{content, …}`)
 * into safe display text. Prevents "Objects are not valid as a React child".
 */
export function textOf(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const c = (v as { content?: unknown }).content;
    if (typeof c === 'string') return c;
  }
  return '';
}

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** ISO -> "15 juin 2025 à 16h00". Returns "" if the date is missing/invalid. */
export function formatDateFr(iso?: string | null, withTime = true): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const date = `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  if (!withTime) return date;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date} à ${hh}h${mm}`;
}

/** ISO future date -> remaining time "2j 14h" / "14h 38m" / "38m" / "Terminé". */
export function countdown(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  let ms = d.getTime() - Date.now();
  if (ms <= 0) return 'Terminé';
  const day = Math.floor(ms / 86400000);
  ms -= day * 86400000;
  const h = Math.floor(ms / 3600000);
  ms -= h * 3600000;
  const m = Math.floor(ms / 60000);
  if (day > 0) return `${day}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** ISO -> "à l'instant" / "il y a 2h" / "il y a 3j" / short date for older. */
export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j}j`;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()].slice(0, 4)}.`;
}
