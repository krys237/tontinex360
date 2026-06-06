"""
Service de génération automatique des séances d'un cycle selon son pattern
de récurrence.

Patterns supportés (Cycle.RecurrenceKind) :
- NONE                  : aucune génération
- FIXED_DAY_OF_MONTH    : ex. le 15 de chaque mois
- NTH_WEEKDAY_OF_MONTH  : ex. le 3ᵉ samedi du mois (nth=3, weekday=5)
                          nth=5 = "dernier"
- EVERY_WEEKDAY         : ex. chaque vendredi (weekday=4)
                          Le `session_frequency` du cycle module l'intervalle
                          (weekly/biweekly).

Conventions :
- weekday : 0=lundi … 6=dimanche
- nth     : 1=premier, 2=deuxième, … 5=dernier (peut être 4 ou 5 selon le mois)
"""
from calendar import monthrange
from datetime import date, timedelta
from typing import Iterable, List
from django.db import transaction as db_transaction
from django.db.models import Max
from django.utils import timezone


# ─── Helpers de calcul de dates ─────────────────────────────────────


def _nth_weekday_of_month(year: int, month: int, weekday: int, nth: int) -> date | None:
    """Renvoie la date du nᵉ jour de semaine d'un mois donné, ou None s'il n'existe pas.

    nth=1..4 : occurrence stricte. nth=5 : 'dernier' du mois (5ᵉ si présent, sinon 4ᵉ).
    """
    if weekday is None or weekday < 0 or weekday > 6:
        return None
    first_day_weekday = date(year, month, 1).weekday()
    offset = (weekday - first_day_weekday) % 7
    first_occurrence = 1 + offset

    if nth == 5:
        # dernier : 5ᵉ si présent, sinon 4ᵉ
        candidate = first_occurrence + 4 * 7
        days_in_month = monthrange(year, month)[1]
        if candidate > days_in_month:
            candidate = first_occurrence + 3 * 7
        return date(year, month, candidate) if candidate <= days_in_month else None

    if nth < 1 or nth > 4:
        return None
    candidate = first_occurrence + (nth - 1) * 7
    days_in_month = monthrange(year, month)[1]
    return date(year, month, candidate) if candidate <= days_in_month else None


def _fixed_day_of_month(year: int, month: int, day_of_month: int) -> date | None:
    """Date du jour fixe ; clamp si le mois ne contient pas ce jour (28→28 pour février)."""
    if day_of_month is None or day_of_month < 1 or day_of_month > 31:
        return None
    days_in_month = monthrange(year, month)[1]
    actual_day = min(day_of_month, days_in_month)
    return date(year, month, actual_day)


def _add_months(d: date, n: int) -> date:
    """Avance d de n mois en gardant le 1er du mois (utilisé pour itérer)."""
    total = d.month - 1 + n
    new_year = d.year + total // 12
    new_month = total % 12 + 1
    return date(new_year, new_month, 1)


# ─── Itérateurs de dates par pattern ────────────────────────────────


def iter_dates(cycle, *, start: date | None = None, end: date | None = None) -> Iterable[date]:
    """Génère paresseusement les dates des séances entre start et end."""
    start = start or cycle.start_date
    end = end or cycle.end_date or (start.replace(year=start.year + 1))

    kind = cycle.recurrence_kind

    if kind == 'fixed_day_of_month':
        cursor = date(start.year, start.month, 1)
        while cursor <= end:
            d = _fixed_day_of_month(cursor.year, cursor.month, cycle.recurrence_day_of_month)
            if d and start <= d <= end:
                yield d
            cursor = _add_months(cursor, 1)
        return

    if kind == 'nth_weekday':
        cursor = date(start.year, start.month, 1)
        while cursor <= end:
            d = _nth_weekday_of_month(
                cursor.year, cursor.month,
                cycle.recurrence_weekday, cycle.recurrence_nth,
            )
            if d and start <= d <= end:
                yield d
            cursor = _add_months(cursor, 1)
        return

    if kind == 'every_weekday':
        # Première occurrence du weekday après start (inclus)
        if cycle.recurrence_weekday is None:
            return
        days_offset = (cycle.recurrence_weekday - start.weekday()) % 7
        first = start + timedelta(days=days_offset)
        step_days = 14 if cycle.session_frequency == 'biweekly' else 7
        cursor = first
        while cursor <= end:
            if cursor >= start:
                yield cursor
            cursor += timedelta(days=step_days)
        return

    # kind = none ou autre : pas de génération automatique
    return


def preview_dates(cycle, *, limit: int = 12) -> List[date]:
    """Pour l'UI : renvoie les N prochaines dates calculées sans persister."""
    out = []
    for d in iter_dates(cycle):
        out.append(d)
        if len(out) >= limit:
            break
    return out


# ─── Génération persistante ─────────────────────────────────────────


@db_transaction.atomic
def generate_sessions_for_cycle(cycle, *, skip_existing: bool = True) -> dict:
    """
    Crée les Session pour le cycle selon son pattern.

    - skip_existing=True : si une Session existe déjà à une date donnée, on
      ne la touche pas. Permet de relancer la génération sans dupliquer.
    - Numérote les séances séquentiellement (session_number).
    - Met à jour cycle.sessions_generated_at.
    """
    from apps.cycles.models import Session

    if cycle.recurrence_kind in ('', None, 'none'):
        return {'created': 0, 'skipped': 0, 'reason': 'no_pattern'}

    existing_dates = set(
        Session.all_objects.filter(cycle=cycle).values_list('date', flat=True),
    )
    next_number = (
        Session.all_objects.filter(cycle=cycle)
        .aggregate(max_n=Max('session_number'))
        .get('max_n') or 0
    ) + 1

    created = 0
    skipped = 0
    for d in iter_dates(cycle):
        if d in existing_dates:
            skipped += 1
            continue
        Session.all_objects.create(
            association=cycle.association,
            cycle=cycle,
            session_number=next_number,
            date=d,
            start_time=cycle.default_session_time,
            location=cycle.default_session_location or '',
        )
        next_number += 1
        created += 1

    cycle.sessions_generated_at = timezone.now()
    cycle.save(update_fields=['sessions_generated_at'])
    return {'created': created, 'skipped': skipped, 'reason': 'ok'}
