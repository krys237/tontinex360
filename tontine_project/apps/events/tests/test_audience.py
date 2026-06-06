"""
Tests des événements + audience cible + génération auto des EventAttendance.
"""
from datetime import date
from django.test import TestCase
from rest_framework import status

from apps.events.models import Event, EventAttendance
from apps.members.tests._fixtures import TestScenario


class EventAudienceTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()
        # Total membres actifs : président + 2 bureau + 3 simples = 6
        self.client = self.scn.authed(self.scn.president)

    def test_create_event_audience_all_creates_attendances_for_all_active(self):
        resp = self.client.post('/api/events/events/', {
            'title': "AG 2026",
            'event_type': 'ag',
            'date': '2026-06-15',
            'audience_mode': 'all',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        event = Event.all_objects.get(id=resp.data['id'])
        self.assertEqual(event.audience_mode, 'all')
        # Tous les membres actifs ont une EventAttendance
        attendances = EventAttendance.all_objects.filter(event=event)
        # 6 memberships actifs dans le scenario
        self.assertEqual(attendances.count(), 6)

    def test_create_event_audience_specific(self):
        invitees = [str(self.scn.member1.id), str(self.scn.member2.id)]
        resp = self.client.post('/api/events/events/', {
            'title': "Réunion bureau",
            'event_type': 'meeting',
            'date': '2026-06-20',
            'audience_mode': 'specific',
            'invitees': invitees,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        event = Event.all_objects.get(id=resp.data['id'])
        # Uniquement les 2 invités ont des EventAttendance
        self.assertEqual(EventAttendance.all_objects.filter(event=event).count(), 2)

    def test_specific_without_invitees_rejected(self):
        resp = self.client.post('/api/events/events/', {
            'title': "Pas de cible",
            'event_type': 'meeting',
            'date': '2026-06-20',
            'audience_mode': 'specific',
            'invitees': [],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_audience_from_all_to_specific_keeps_existing_attendances(self):
        # Créer en 'all'
        event = Event.all_objects.create(
            association=self.scn.association,
            title="Test", event_type='meeting', date=date(2026, 6, 1),
            audience_mode='all',
        )
        from apps.events.views import _resolve_target_members
        # Simule la création des attendances
        for m in _resolve_target_members(event):
            EventAttendance.all_objects.create(
                association=self.scn.association, event=event, membership=m,
                is_present=True,  # déjà pointé
            )
        # On a 6 attendances toutes is_present=True
        self.assertEqual(EventAttendance.all_objects.filter(event=event, is_present=True).count(), 6)

        # On change en 'specific' avec 2 invités via PATCH
        resp = self.client.patch(f'/api/events/events/{event.id}/', {
            'audience_mode': 'specific',
            'invitees': [str(self.scn.member1.id), str(self.scn.member2.id)],
        }, format='json')
        self.assertIn(resp.status_code, (status.HTTP_200_OK, status.HTTP_202_ACCEPTED))
        # Les attendances existantes ne sont PAS supprimées (préservation du pointage)
        self.assertGreaterEqual(EventAttendance.all_objects.filter(event=event).count(), 6)
