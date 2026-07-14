/**
 * Calcul local des dates de séances — miroir de `apps/cycles/session_generation.py`
 * (fonction `iter_dates`) côté backend.
 *
 * Pourquoi dupliquer la logique serveur ? L'endpoint `/cycles/{id}/preview-dates/`
 * exige un cycle déjà persisté. Sur le formulaire de création, on n'a pas encore
 * d'id : on calcule donc localement pour montrer un aperçu avant l'envoi.
 * Après création, c'est le serveur qui fait foi (`Cycle.preview_dates`).
 *
 * Toute évolution de `iter_dates` doit être répercutée ici.
 *
 * Conventions (identiques au backend) :
 * - weekday : 0=lundi … 6=dimanche (≠ JS, où 0=dimanche → voir `pyWeekday`)
 * - end_date absente → horizon d'un an à partir de start_date
 */
import type { RecurrenceKind } from '../types/cycle';

const MS_PER_DAY = 86_400_000;

export interface RecurrenceInput {
  start_date?: string;
  end_date?: string;
  session_frequency?: string;
  recurrence_kind?: RecurrenceKind;
  recurrence_nth?: number | null;
  recurrence_weekday?: number | null;
  recurrence_day_of_month?: number | null;
  recurrence_weekdays?: number[];
  recurrence_custom_dates?: string[];
  recurrence_interval?: number;
}

/** Parse une date ISO stricte (YYYY-MM-DD) en Date UTC. Rejette 2026-02-31. */
export function parseISODate(s?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? '').trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const overflowed =
    dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d;
  return overflowed ? null : dt;
}

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

/** Jour de semaine à la mode Python : 0=lundi … 6=dimanche. */
const pyWeekday = (d: Date) => (d.getUTCDay() + 6) % 7;

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** Avance de n mois en restant le 1er du mois (miroir de `_add_months`). */
function addMonths(d: Date, n: number): Date {
  const total = d.getUTCMonth() + n;
  return utc(d.getUTCFullYear() + Math.floor(total / 12), ((total % 12) + 12) % 12, 1);
}

/** nᵉ jour de semaine du mois. nth=5 → « dernier » (5ᵉ si présent, sinon 4ᵉ). */
function nthWeekdayOfMonth(y: number, m: number, weekday: number, nth: number): Date | null {
  if (weekday == null || weekday < 0 || weekday > 6) return null;
  const offset = (((weekday - pyWeekday(utc(y, m, 1))) % 7) + 7) % 7;
  const first = 1 + offset;
  const dim = daysInMonth(y, m);

  if (nth === 5) {
    let candidate = first + 4 * 7;
    if (candidate > dim) candidate = first + 3 * 7;
    return candidate <= dim ? utc(y, m, candidate) : null;
  }
  if (nth < 1 || nth > 4) return null;
  const candidate = first + (nth - 1) * 7;
  return candidate <= dim ? utc(y, m, candidate) : null;
}

/** Jour fixe du mois, clampé si le mois est plus court (31 → 28 en février). */
function fixedDayOfMonth(y: number, m: number, dayOfMonth: number): Date | null {
  if (dayOfMonth == null || dayOfMonth < 1 || dayOfMonth > 31) return null;
  return utc(y, m, Math.min(dayOfMonth, daysInMonth(y, m)));
}

/**
 * Dates de séances calculées pour un cycle (non persisté).
 * `limit` borne le résultat — indispensable pour `daily`, qui peut produire
 * ~365 dates sur l'horizon par défaut.
 */
export function computeSessionDates(input: RecurrenceInput, limit = 12): Date[] {
  const kind = input.recurrence_kind;
  const start = parseISODate(input.start_date);
  if (!start || !kind || kind === 'none') return [];

  // Horizon par défaut : un an après le début (aligné sur `iter_dates`).
  const end =
    parseISODate(input.end_date) ??
    utc(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate());
  if (end < start) return [];

  const out: Date[] = [];
  const push = (d: Date) => {
    if (d >= start && d <= end && out.length < limit) out.push(d);
    return out.length >= limit;
  };

  if (kind === 'fixed_day_of_month' || kind === 'nth_weekday') {
    let cursor = utc(start.getUTCFullYear(), start.getUTCMonth(), 1);
    while (cursor <= end && out.length < limit) {
      const y = cursor.getUTCFullYear();
      const m = cursor.getUTCMonth();
      const d =
        kind === 'fixed_day_of_month'
          ? fixedDayOfMonth(y, m, Number(input.recurrence_day_of_month))
          : nthWeekdayOfMonth(
              y,
              m,
              Number(input.recurrence_weekday),
              Number(input.recurrence_nth),
            );
      if (d) push(d);
      cursor = addMonths(cursor, 1);
    }
    return out;
  }

  if (kind === 'every_weekday') {
    const wd = input.recurrence_weekday;
    if (wd == null) return [];
    const step = input.session_frequency === 'biweekly' ? 14 : 7;
    let cursor = addDays(start, (((wd - pyWeekday(start)) % 7) + 7) % 7);
    while (cursor <= end && out.length < limit) {
      push(cursor);
      cursor = addDays(cursor, step);
    }
    return out;
  }

  if (kind === 'weekly_multiple') {
    const weekdays = [...new Set(input.recurrence_weekdays ?? [])].sort((a, b) => a - b);
    if (!weekdays.length) return [];
    const interval = Math.max(1, input.recurrence_interval || 1);
    // Aligne sur le lundi de la semaine contenant `start`.
    let week = addDays(start, -pyWeekday(start));
    while (week <= end && out.length < limit) {
      for (const wd of weekdays) {
        if (push(addDays(week, wd))) return out;
      }
      week = addDays(week, 7 * interval);
    }
    return out;
  }

  if (kind === 'daily') {
    const allowed = new Set(input.recurrence_weekdays ?? []);
    const interval = Math.max(1, input.recurrence_interval || 1);
    let cursor = start;
    while (cursor <= end && out.length < limit) {
      if (!allowed.size || allowed.has(pyWeekday(cursor))) push(cursor);
      cursor = addDays(cursor, interval);
    }
    return out;
  }

  if (kind === 'custom_dates') {
    const parsed = (input.recurrence_custom_dates ?? [])
      .map(parseISODate)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    const seen = new Set<number>();
    for (const d of parsed) {
      if (seen.has(d.getTime())) continue;
      seen.add(d.getTime());
      if (push(d)) break;
    }
    return out;
  }

  return [];
}

const DAY_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTH_FR = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** « sam. 15 févr. 2026 » — formatage manuel : Intl n'est pas fiable sur Hermes. */
export function formatDateFR(d: Date): string {
  return `${DAY_FR[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
