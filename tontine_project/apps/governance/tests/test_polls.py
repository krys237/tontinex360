"""
Tests des sondages électroniques (Poll).

Couvre :
- cast_vote single_choice (radio)
- cast_vote multi_choice avec max_choices
- Anti-doublon (un membre ne vote qu'une fois sauf allow_change_vote)
- Vote anonyme via fingerprint SHA-256
- Open/closed (status + fenêtre temporelle)
- aggregate_results visible/caché
"""
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone

from apps.governance.models import Poll, PollOption, PollVote
from apps.governance.poll_service import (
    cast_vote, voter_has_voted, is_open_now, aggregate_results, _fingerprint,
)
from apps.members.tests._fixtures import TestScenario


def _make_poll(scn, *, kind='single_choice', is_anonymous=False,
               allow_change_vote=False, max_choices=None, status='open'):
    poll = Poll.all_objects.create(
        association=scn.association,
        title="Quel jour pour la prochaine réunion ?",
        question="Choisissez la date qui vous convient",
        kind=kind,
        is_anonymous=is_anonymous,
        allow_change_vote=allow_change_vote,
        max_choices=max_choices,
        status=status,
    )
    for i, label in enumerate(["Samedi", "Dimanche", "Lundi"]):
        PollOption.all_objects.create(
            association=scn.association,
            poll=poll, label=label, display_order=i,
        )
    return poll


class PollVoteSingleChoiceTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()
        self.poll = _make_poll(self.scn, kind='single_choice')
        self.opts = list(self.poll.options.all())

    def test_single_choice_vote_increments_counter(self):
        cast_vote(poll=self.poll, voter=self.scn.member1, option_ids=[str(self.opts[0].id)])
        self.opts[0].refresh_from_db()
        self.assertEqual(self.opts[0].votes_count, 1)

    def test_single_choice_requires_exactly_one_option(self):
        # Vide → erreur
        with self.assertRaises(ValueError):
            cast_vote(poll=self.poll, voter=self.scn.member1, option_ids=[])
        # 2 options pour un single_choice → erreur
        with self.assertRaises(ValueError):
            cast_vote(
                poll=self.poll, voter=self.scn.member1,
                option_ids=[str(self.opts[0].id), str(self.opts[1].id)],
            )

    def test_no_double_vote_by_default(self):
        cast_vote(poll=self.poll, voter=self.scn.member1, option_ids=[str(self.opts[0].id)])
        with self.assertRaises(ValueError):
            cast_vote(poll=self.poll, voter=self.scn.member1, option_ids=[str(self.opts[1].id)])

    def test_change_vote_when_allowed(self):
        poll = _make_poll(self.scn, kind='single_choice', allow_change_vote=True)
        opts = list(poll.options.all())
        # Vote A
        cast_vote(poll=poll, voter=self.scn.member1, option_ids=[str(opts[0].id)])
        opts[0].refresh_from_db()
        self.assertEqual(opts[0].votes_count, 1)
        # Change pour B
        cast_vote(poll=poll, voter=self.scn.member1, option_ids=[str(opts[1].id)])
        opts[0].refresh_from_db(); opts[1].refresh_from_db()
        self.assertEqual(opts[0].votes_count, 0)  # décrémenté
        self.assertEqual(opts[1].votes_count, 1)


class PollVoteMultiChoiceTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()
        self.poll = _make_poll(self.scn, kind='multi_choice', max_choices=2)
        self.opts = list(self.poll.options.all())

    def test_multi_choice_allows_multiple_options(self):
        cast_vote(
            poll=self.poll, voter=self.scn.member1,
            option_ids=[str(self.opts[0].id), str(self.opts[1].id)],
        )
        self.opts[0].refresh_from_db(); self.opts[1].refresh_from_db()
        self.assertEqual(self.opts[0].votes_count, 1)
        self.assertEqual(self.opts[1].votes_count, 1)

    def test_max_choices_enforced(self):
        with self.assertRaises(ValueError):
            cast_vote(
                poll=self.poll, voter=self.scn.member1,
                option_ids=[str(o.id) for o in self.opts],  # 3 > max=2
            )


class PollAnonymousTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()
        self.poll = _make_poll(self.scn, is_anonymous=True)
        self.opts = list(self.poll.options.all())

    def test_anonymous_vote_stores_no_voter(self):
        cast_vote(poll=self.poll, voter=self.scn.member1, option_ids=[str(self.opts[0].id)])
        vote = PollVote.all_objects.get(poll=self.poll)
        self.assertIsNone(vote.voter)
        # Fingerprint stocké pour l'anti-doublon
        self.assertEqual(
            vote.voter_fingerprint, _fingerprint(self.scn.member1.id, self.poll.id),
        )

    def test_anonymous_anti_double_via_fingerprint(self):
        cast_vote(poll=self.poll, voter=self.scn.member1, option_ids=[str(self.opts[0].id)])
        with self.assertRaises(ValueError):
            cast_vote(poll=self.poll, voter=self.scn.member1, option_ids=[str(self.opts[1].id)])


class PollStatusAndWindowTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()

    def test_draft_poll_is_not_open(self):
        poll = _make_poll(self.scn, status='draft')
        self.assertFalse(is_open_now(poll))
        with self.assertRaises(ValueError):
            cast_vote(poll=poll, voter=self.scn.member1, option_ids=[str(poll.options.first().id)])

    def test_closed_poll_blocks_voting(self):
        poll = _make_poll(self.scn, status='closed')
        with self.assertRaises(ValueError):
            cast_vote(poll=poll, voter=self.scn.member1, option_ids=[str(poll.options.first().id)])

    def test_time_window_enforced(self):
        poll = _make_poll(self.scn, status='open')
        # Ouvre demain
        poll.starts_at = timezone.now() + timedelta(hours=24)
        poll.save()
        with self.assertRaises(ValueError):
            cast_vote(poll=poll, voter=self.scn.member1, option_ids=[str(poll.options.first().id)])


class PollResultsTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()

    def test_results_hidden_when_configured_and_not_closed(self):
        poll = _make_poll(self.scn, status='open')
        poll.results_visible_before_close = False
        poll.save()
        results = aggregate_results(poll)
        self.assertFalse(results['visible'])
        self.assertIsNone(results['total_votes'])

    def test_results_with_percentages(self):
        poll = _make_poll(self.scn, status='open')
        opts = list(poll.options.all())
        cast_vote(poll=poll, voter=self.scn.member1, option_ids=[str(opts[0].id)])
        cast_vote(poll=poll, voter=self.scn.member2, option_ids=[str(opts[0].id)])
        cast_vote(poll=poll, voter=self.scn.member3, option_ids=[str(opts[1].id)])
        results = aggregate_results(poll)
        self.assertTrue(results['visible'])
        self.assertEqual(results['total_votes'], 3)
        # Option 0 a 2 votes sur 3 → 66.67%
        opt0 = next(o for o in results['options'] if o['id'] == str(opts[0].id))
        self.assertAlmostEqual(opt0['percentage'], 66.66666, places=2)
