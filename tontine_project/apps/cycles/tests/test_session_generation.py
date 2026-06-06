"""
Tests des patterns de récurrence et de la génération automatique des séances.

Couvre :
- nth_weekday : 3ᵉ samedi du mois
- nth_weekday : dernier samedi (nth=5 avec fallback 4 si mois court)
- fixed_day_of_month : le 15 + clamp si février
- every_weekday : chaque mercredi, weekly + biweekly
- preview_dates limit
- generate_sessions_for_cycle idempotence
"""
from datetime import date
from django.test import TestCase

from apps.cycles.models import Cycle, Session
from apps.cycles.session_generation import (
    _nth_weekday_of_month, _fixed_day_of_month,
    iter_dates, preview_dates, generate_sessions_for_cycle,
)
from apps.members.tests._fixtures import TestScenario


class DateHelpersTests(TestCase):

    def test_nth_weekday_third_saturday_january_2026(self):
        # 3ᵉ samedi de janvier 2026 = 17 janvier
        d = _nth_weekday_of_month(2026, 1, weekday=5, nth=3)
        self.assertEqual(d, date(2026, 1, 17))

    def test_nth_weekday_last_friday_of_february_2026(self):
        # nth=5 = dernier. Février 2026 a 28 jours ; le 5ᵉ vendredi n'existe pas
        # → fallback sur 4ᵉ vendredi = 27 février
        d = _nth_weekday_of_month(2026, 2, weekday=4, nth=5)
        self.assertEqual(d, date(2026, 2, 27))

    def test_nth_weekday_first_sunday_of_may(self):
        # 1er dimanche de mai 2026 = 3 mai
        d = _nth_weekday_of_month(2026, 5, weekday=6, nth=1)
        self.assertEqual(d, date(2026, 5, 3))

    def test_fixed_day_of_month_clamp_february(self):
        # 31 février → clamp au 28 (ou 29 si bissextile)
        d = _fixed_day_of_month(2026, 2, 31)
        self.assertEqual(d, date(2026, 2, 28))

    def test_fixed_day_of_month_regular(self):
        d = _fixed_day_of_month(2026, 6, 15)
        self.assertEqual(d, date(2026, 6, 15))


class IterDatesTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()

    def test_nth_weekday_pattern_yields_one_per_month(self):
        cycle = Cycle.all_objects.create(
            association=self.scn.association,
            name="C26",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            recurrence_kind='nth_weekday',
            recurrence_nth=3,
            recurrence_weekday=5,  # samedi
        )
        dates = list(iter_dates(cycle))
        # 6 mois * 1 séance/mois = 6
        self.assertEqual(len(dates), 6)
        # Première date = 3ᵉ samedi de janvier 2026 = 17
        self.assertEqual(dates[0], date(2026, 1, 17))

    def test_every_weekday_weekly_pattern(self):
        cycle = Cycle.all_objects.create(
            association=self.scn.association,
            name="C26-W",
            start_date=date(2026, 1, 5),  # lundi
            end_date=date(2026, 1, 31),
            recurrence_kind='every_weekday',
            recurrence_weekday=2,  # mercredi
            session_frequency='weekly',
        )
        dates = list(iter_dates(cycle))
        # Mercredis de janv 2026 entre 5 et 31 : 7, 14, 21, 28
        self.assertEqual(len(dates), 4)
        self.assertEqual(dates[0], date(2026, 1, 7))

    def test_every_weekday_biweekly_pattern(self):
        cycle = Cycle.all_objects.create(
            association=self.scn.association,
            name="C26-BW",
            start_date=date(2026, 1, 5),
            end_date=date(2026, 1, 31),
            recurrence_kind='every_weekday',
            recurrence_weekday=2,
            session_frequency='biweekly',
        )
        dates = list(iter_dates(cycle))
        # Bi-mensuel = un mercredi sur deux : 7, 21
        self.assertEqual(dates, [date(2026, 1, 7), date(2026, 1, 21)])

    def test_no_pattern_yields_nothing(self):
        cycle = Cycle.all_objects.create(
            association=self.scn.association,
            name="C-none",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            recurrence_kind='none',
        )
        self.assertEqual(list(iter_dates(cycle)), [])

    def test_preview_dates_respects_limit(self):
        cycle = Cycle.all_objects.create(
            association=self.scn.association,
            name="C-preview",
            start_date=date(2026, 1, 1),
            end_date=date(2027, 12, 31),
            recurrence_kind='nth_weekday',
            recurrence_nth=1,
            recurrence_weekday=6,
        )
        dates = preview_dates(cycle, limit=5)
        self.assertEqual(len(dates), 5)


class GenerateSessionsTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()
        self.cycle = Cycle.all_objects.create(
            association=self.scn.association,
            name="C-gen",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
            recurrence_kind='nth_weekday',
            recurrence_nth=3,
            recurrence_weekday=5,
        )

    def test_generates_sessions_with_sequential_numbers(self):
        result = generate_sessions_for_cycle(self.cycle)
        self.assertEqual(result['created'], 3)  # 3 mois
        # Sessions numérotées 1, 2, 3
        nums = sorted(Session.all_objects.filter(cycle=self.cycle).values_list('session_number', flat=True))
        self.assertEqual(nums, [1, 2, 3])

    def test_idempotent_no_duplicate_dates(self):
        generate_sessions_for_cycle(self.cycle)
        result = generate_sessions_for_cycle(self.cycle)
        self.assertEqual(result['created'], 0)
        self.assertEqual(result['skipped'], 3)

    def test_no_pattern_returns_no_op(self):
        cycle = Cycle.all_objects.create(
            association=self.scn.association,
            name="C-no-pattern",
            start_date=date(2026, 1, 1),
            recurrence_kind='none',
        )
        result = generate_sessions_for_cycle(cycle)
        self.assertEqual(result['reason'], 'no_pattern')
        self.assertEqual(result['created'], 0)
