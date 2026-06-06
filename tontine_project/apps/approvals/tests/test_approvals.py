"""
Tests du framework d'approbation Bureau (Tier 1, 2, 3, 4).

Couvre :
- Création de la demande + validation handler
- Approbation par Président → bureau1 → application automatique
- Triple validation (Tier 4 : pres + 2 bureau distincts)
- Anti auto-approbation par le requérant
- Anti-doublon (1 même personne ne peut pas remplir 2 slots)
- Expiration TTL 24h
- Rejet avec motif
- Annulation par le requérant
- Bloc des demandes concurrentes sur la même cible
- Application du handler `membership_fee.waive`
"""
from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone

from apps.approvals.models import BureauApprovalRequest
from apps.approvals import service as approval_service
from apps.approvals.registry import get_handler, register_handler, BaseApprovalHandler
from apps.finance.models import TreasuryAccount
from apps.members import fees_service
from apps.members.models import Membership, MembershipFeePayment
from apps.members.tests._fixtures import TestScenario, make_membership, make_user


# ─── Handler factice pour tester le flow indépendamment d'un handler réel ──


class _FakeTarget:
    """Wrapper minimal autour d'une Membership pour servir de target."""
    def __init__(self, m):
        self.id = m.id
        self.association = m.association
        self._m = m


_APPLY_CALLED = {'n': 0}


# Ce handler est enregistré une seule fois au chargement du module
try:
    @register_handler('test.dummy_action')
    class DummyHandler(BaseApprovalHandler):
        target_model_label = 'members.Membership'
        human_label = "Action factice de test"

        def get_target_object(self, target_id, association):
            return Membership.all_objects.filter(
                id=target_id, association=association,
            ).first()

        def snapshot(self, target):
            return {'status': target.status}

        def summary(self, target, payload):
            return f"Test sur {target.id}"

        def apply(self, req, applied_by):
            _APPLY_CALLED['n'] += 1
            return {'applied_to': str(req.target_id)}
except ValueError:
    # Déjà enregistré (re-import dans pytest)
    pass


# ─── Tests du flow standard ─────────────────────────────────────────


class ApprovalFlowTests(TestCase):
    """Workflow d'approbation : create → approve → apply."""

    def setUp(self):
        self.scn = TestScenario.build_full()
        _APPLY_CALLED['n'] = 0

    def _create_request(self, requested_by=None, target=None):
        return approval_service.create_request(
            association=self.scn.association,
            action_type='test.dummy_action',
            target_id=(target or self.scn.member1).id,
            payload={},
            reason="Raison du test, suffisamment longue",
            requested_by=requested_by or self.scn.bureau1,
        )

    def test_create_request_persists_handler_metadata(self):
        req = self._create_request()
        self.assertEqual(req.action_type, 'test.dummy_action')
        self.assertEqual(req.target_model, 'members.Membership')
        self.assertEqual(req.status, 'pending')
        self.assertFalse(req.requires_triple)
        # expires_at ≈ +24h
        diff = req.expires_at - timezone.now()
        self.assertTrue(timedelta(hours=23) < diff < timedelta(hours=25))

    def test_double_approval_applies_automatically(self):
        req = self._create_request(requested_by=self.scn.bureau1)
        # Président approuve
        approval_service.approve(req, self.scn.president)
        req.refresh_from_db()
        self.assertEqual(req.status, 'pres_approved')
        # Bureau2 approuve
        approval_service.approve(req, self.scn.bureau2)
        req.refresh_from_db()
        self.assertEqual(req.status, 'approved')
        self.assertEqual(_APPLY_CALLED['n'], 1)

    def test_requester_cannot_approve_own_request(self):
        req = self._create_request(requested_by=self.scn.bureau1)
        with self.assertRaises(PermissionError):
            approval_service.approve(req, self.scn.bureau1)

    def test_same_person_cannot_fill_two_slots(self):
        req = self._create_request(requested_by=self.scn.bureau2)
        approval_service.approve(req, self.scn.president)  # slot Président
        # Le même président essaie en bureau → refusé
        with self.assertRaises(ValueError):
            approval_service.approve(req, self.scn.president)

    def test_random_member_cannot_approve(self):
        req = self._create_request(requested_by=self.scn.bureau1)
        with self.assertRaises(PermissionError):
            approval_service.approve(req, self.scn.member1)

    def test_concurrent_request_on_same_target_blocked(self):
        req1 = self._create_request(target=self.scn.member1)
        # 2ᵉ demande sur même cible avec pending → refus
        with self.assertRaises(ValueError):
            self._create_request(target=self.scn.member1)

    def test_reject_with_reason(self):
        req = self._create_request()
        approval_service.reject(req, self.scn.president, "Trop tôt, à représenter dans 3 mois")
        req.refresh_from_db()
        self.assertEqual(req.status, 'rejected')
        self.assertEqual(req.rejected_by, self.scn.president)
        # apply NON appelé
        self.assertEqual(_APPLY_CALLED['n'], 0)

    def test_reject_with_too_short_reason(self):
        req = self._create_request()
        with self.assertRaises(ValueError):
            approval_service.reject(req, self.scn.president, "ko")

    def test_cancel_by_requester(self):
        req = self._create_request(requested_by=self.scn.bureau1)
        approval_service.cancel(req, self.scn.bureau1)
        req.refresh_from_db()
        self.assertEqual(req.status, 'cancelled')

    def test_cannot_cancel_others_request(self):
        req = self._create_request(requested_by=self.scn.bureau1)
        with self.assertRaises(PermissionError):
            approval_service.cancel(req, self.scn.bureau2)

    def test_expired_request_blocks_actions(self):
        req = self._create_request()
        req.expires_at = timezone.now() - timedelta(hours=1)
        req.save()
        with self.assertRaises(ValueError):
            approval_service.approve(req, self.scn.president)


# ─── Tests triple validation (Tier 4) ────────────────────────────────


# Handler factice qui exige triple validation
try:
    @register_handler('test.triple_action')
    class TripleHandler(BaseApprovalHandler):
        target_model_label = 'members.Membership'
        human_label = "Action triple validation"
        requires_triple_approval = True

        def get_target_object(self, target_id, association):
            return Membership.all_objects.filter(
                id=target_id, association=association,
            ).first()

        def snapshot(self, target):
            return {}

        def summary(self, target, payload):
            return "Triple test"

        def apply(self, req, applied_by):
            _APPLY_CALLED['n'] += 1
            return {}
except ValueError:
    pass


class TripleApprovalTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()
        _APPLY_CALLED['n'] = 0

    def test_triple_validation_requires_3_distinct_approvers(self):
        req = approval_service.create_request(
            association=self.scn.association,
            action_type='test.triple_action',
            target_id=self.scn.member1.id,
            payload={},
            reason="Triple validation requise",
            requested_by=self.scn.member2,  # le requérant ne compte pas
        )
        self.assertTrue(req.requires_triple)

        # 2 approbations seulement → pas encore appliqué
        approval_service.approve(req, self.scn.president)
        approval_service.approve(req, self.scn.bureau1)
        req.refresh_from_db()
        self.assertNotEqual(req.status, 'approved')
        self.assertEqual(_APPLY_CALLED['n'], 0)

        # 3ᵉ approbation → appliqué
        approval_service.approve(req, self.scn.bureau2)
        req.refresh_from_db()
        self.assertEqual(req.status, 'approved')
        self.assertEqual(_APPLY_CALLED['n'], 1)


# ─── Tests du handler réel membership_fee.waive ──────────────────────


class FeeWaiveHandlerTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()
        TreasuryAccount.all_objects.create(
            association=self.scn.association, name='Caisse',
            account_type=TreasuryAccount.AccountType.CASH,
        )
        fees_service.set_config(self.scn.association, {
            'registration': {'enabled': True, 'amount': 5000, 'is_entry_gate': True},
        })
        self.member = make_membership(
            self.scn.association, make_user(),
            status=Membership.Status.PENDING, is_active=False,
        )
        self.fee = fees_service.create_initial_fees(self.member)[0]

    def test_waive_via_approval_workflow(self):
        # Création de la demande
        req = approval_service.create_request(
            association=self.scn.association,
            action_type='membership_fee.waive',
            target_id=self.fee.id,
            payload={},
            reason="Exonération pour cas social, AG du 12/05",
            requested_by=self.scn.bureau1,
        )
        # 2 approbations
        approval_service.approve(req, self.scn.president)
        approval_service.approve(req, self.scn.bureau2)
        req.refresh_from_db()
        self.assertEqual(req.status, 'approved')
        # Le fee est waived
        self.fee.refresh_from_db()
        self.assertEqual(self.fee.status, MembershipFeePayment.Status.WAIVED)
        # Le membre est activé
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, Membership.Status.ACTIVE)
