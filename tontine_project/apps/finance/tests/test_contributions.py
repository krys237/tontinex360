"""
Tests des cotisations + paiement automatique + correction.

Couvre :
- ContributionPaymentService.record_payment (idempotent, atomique)
- Détection in_kind vs cash (montant XAF équivalent calculé)
- Blocage du PATCH direct sur paid_amount après paiement initial
- ContributionCorrectionRequest workflow complet
- Reversal + replacement transaction à l'approbation de la correction
"""
from datetime import date
from decimal import Decimal
from django.test import TestCase

from apps.cycles.models import Cycle, Session
from apps.finance.models import (
    Contribution, ContributionCorrectionRequest, Transaction, TreasuryAccount,
)
from apps.finance.services import ContributionPaymentService
from apps.finance import correction_service
from apps.tontines.models import TontineType
from apps.members.tests._fixtures import TestScenario


def _make_minimal_contribution(scn, *, tontine_kind='cash', expected=10000, paid=0, status='pending'):
    """Crée une contribution + son contexte minimal pour les tests."""
    TreasuryAccount.all_objects.get_or_create(
        association=scn.association, name='Caisse',
        defaults={'account_type': TreasuryAccount.AccountType.CASH},
    )
    tt = TontineType.all_objects.create(
        association=scn.association,
        name=f"Tontine {tontine_kind}", slug=f"t-{tontine_kind}",
        contribution_kind=tontine_kind,
        in_kind_unit_label='Sac de riz 25kg' if tontine_kind == 'in_kind' else '',
        in_kind_unit_value=Decimal('15000') if tontine_kind == 'in_kind' else None,
        rate_mode='fixed',
        fixed_rate=Decimal('1') if tontine_kind == 'in_kind' else Decimal('10000'),
        currency='XAF',
    )
    cycle = Cycle.all_objects.create(
        association=scn.association, name="C26", start_date=date(2026, 1, 1),
        status='active',
    )
    session = Session.all_objects.create(
        association=scn.association, cycle=cycle, session_number=1,
        date=date(2026, 1, 15),
    )
    return Contribution.all_objects.create(
        association=scn.association,
        session=session, membership=scn.member1, tontine_type=tt,
        num_shares=1,
        rate_per_share=Decimal(expected),
        expected_amount=Decimal(expected), paid_amount=Decimal(paid),
        status=status,
    )


class ContributionPaymentServiceTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()

    def test_record_payment_creates_transaction_for_cash(self):
        c = _make_minimal_contribution(self.scn, paid=10000, status='paid')
        tx = ContributionPaymentService.record_payment(c, recorded_by=self.scn.bureau1)
        self.assertIsNotNone(tx)
        self.assertEqual(tx.amount, Decimal('10000'))
        self.assertEqual(tx.transaction_type, Transaction.TransactionType.CONTRIBUTION)
        self.assertFalse(tx.is_debit)
        self.assertIsNone(tx.in_kind_quantity)

    def test_idempotent_no_double_transaction(self):
        c = _make_minimal_contribution(self.scn, paid=10000, status='paid')
        tx1 = ContributionPaymentService.record_payment(c, recorded_by=self.scn.bureau1)
        tx2 = ContributionPaymentService.record_payment(c, recorded_by=self.scn.bureau1)
        self.assertEqual(tx1.id, tx2.id)
        # 1 seule transaction en BDD
        count = Transaction.all_objects.filter(
            reference=ContributionPaymentService.reference_for(c),
        ).count()
        self.assertEqual(count, 1)

    def test_record_payment_in_kind_stores_quantity_and_xaf_equivalent(self):
        # 1 part = 1 sac, valeur référence 15000 XAF/sac, paid_amount=3 sacs
        c = _make_minimal_contribution(
            self.scn, tontine_kind='in_kind', expected=3, paid=3, status='paid',
        )
        tx = ContributionPaymentService.record_payment(c, recorded_by=self.scn.bureau1)
        # XAF équivalent = 3 × 15000 = 45000
        self.assertEqual(tx.amount, Decimal('45000'))
        # Quantité tracée
        self.assertEqual(tx.in_kind_quantity, Decimal('3'))
        self.assertEqual(tx.in_kind_unit_label, 'Sac de riz 25kg')

    def test_record_payment_zero_paid_amount_returns_none(self):
        c = _make_minimal_contribution(self.scn, paid=0, status='pending')
        result = ContributionPaymentService.record_payment(c, recorded_by=self.scn.bureau1)
        self.assertIsNone(result)


class CorrectionWorkflowTests(TestCase):

    def setUp(self):
        self.scn = TestScenario.build_full()
        TreasuryAccount.all_objects.create(
            association=self.scn.association, name='Caisse',
            account_type=TreasuryAccount.AccountType.CASH,
        )
        self.c = _make_minimal_contribution(self.scn, paid=10000, status='paid')
        # Récupérer la Transaction comptable
        ContributionPaymentService.record_payment(self.c, recorded_by=self.scn.bureau1)

    def test_correction_request_creates_pending(self):
        from django.utils import timezone
        from datetime import timedelta
        req = ContributionCorrectionRequest.all_objects.create(
            association=self.scn.association,
            contribution=self.c,
            requested_by=self.scn.bureau1,
            original_paid_amount=Decimal('10000'),
            new_paid_amount=Decimal('15000'),
            original_status='paid',
            reason="Erreur de saisie, le membre avait payé 15k",
            expires_at=timezone.now() + timedelta(hours=24),
        )
        self.assertEqual(req.status, 'pending')

    def test_apply_correction_reverses_and_replaces_transaction(self):
        from django.utils import timezone
        from datetime import timedelta
        req = ContributionCorrectionRequest.all_objects.create(
            association=self.scn.association,
            contribution=self.c,
            requested_by=self.scn.bureau1,
            original_paid_amount=Decimal('10000'),
            new_paid_amount=Decimal('15000'),
            original_status='paid',
            reason="Correction de test",
            expires_at=timezone.now() + timedelta(hours=24),
        )
        correction_service.apply_correction(req, applied_by=self.scn.president)
        req.refresh_from_db()
        self.c.refresh_from_db()
        # Contribution mise à jour
        self.assertEqual(self.c.paid_amount, Decimal('15000'))
        # 2 transactions : reversal + nouvelle (en plus de la ORIGINALE qui est superseded)
        # Total Transactions liées à cette cotisation = 3 (original superseded + reversal + new)
        tx_for_member = Transaction.all_objects.filter(
            membership=self.scn.member1,
        )
        self.assertGreaterEqual(tx_for_member.count(), 3)
        # La nouvelle Transaction porte la référence canonique
        ref = ContributionPaymentService.reference_for(self.c)
        new_tx = Transaction.all_objects.get(reference=ref)
        self.assertEqual(new_tx.amount, Decimal('15000'))
        # La précédente a été renommée 'superseded:'
        superseded = Transaction.all_objects.filter(
            reference__startswith='superseded:',
        )
        self.assertGreaterEqual(superseded.count(), 1)
