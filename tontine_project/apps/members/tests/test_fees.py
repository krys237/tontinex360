"""
Tests des frais d'adhésion (inscription + fond de membre).

Couvre :
- Configuration (registration / membership_fund / scopes)
- Création initiale des FeePayment au moment de l'approbation
- Enregistrement de versement (Transaction + WalletEntry + Installment atomiques)
- Activation automatique du membre quand inscription PAID
- Exonération (waive_fee)
- Versement partiel + idempotence des constraints
- Garde-fou : un membre ne peut pas avoir 2 inscriptions
"""
from decimal import Decimal
from django.test import TestCase

from apps.core.models import Association
from apps.finance.models import TreasuryAccount
from apps.members import fees_service
from apps.members.models import (
    Membership, MembershipFeePayment, MembershipFeeInstallment,
)
from apps.members.tests._fixtures import TestScenario, make_membership, make_user


class FeesConfigTests(TestCase):
    """Lecture/écriture de la config Association.settings.membership_fees."""

    def setUp(self):
        self.assoc = Association.objects.create(name="X", slug="x")

    def test_default_config_when_nothing_set(self):
        cfg = fees_service.get_config(self.assoc)
        self.assertFalse(cfg['registration']['enabled'])
        self.assertEqual(cfg['registration']['amount'], 0)
        self.assertFalse(cfg['membership_fund']['enabled'])
        self.assertEqual(cfg['membership_fund']['scope'], 'lifetime')

    def test_set_and_read_back(self):
        fees_service.set_config(self.assoc, {
            'registration': {'enabled': True, 'amount': 5000, 'is_entry_gate': True},
            'membership_fund': {'enabled': True, 'amount': 50000, 'scope': 'lifetime'},
        })
        self.assoc.refresh_from_db()
        cfg = fees_service.get_config(self.assoc)
        self.assertTrue(cfg['registration']['enabled'])
        self.assertEqual(cfg['registration']['amount'], 5000)
        self.assertTrue(cfg['registration']['is_entry_gate'])
        self.assertEqual(cfg['membership_fund']['amount'], 50000)

    def test_partial_update_preserves_unrelated_settings(self):
        # On met d'abord settings.other_key pour vérifier la préservation
        self.assoc.settings = {'other_key': 'preserved', 'membership_fees': {
            'registration': {'enabled': True, 'amount': 1000},
        }}
        self.assoc.save()

        fees_service.set_config(self.assoc, {
            'membership_fund': {'enabled': True, 'amount': 30000},
        })
        self.assoc.refresh_from_db()
        # other_key doit toujours être là
        self.assertEqual(self.assoc.settings['other_key'], 'preserved')
        # registration n'est pas écrasé
        self.assertTrue(self.assoc.settings['membership_fees']['registration']['enabled'])


class CreateInitialFeesTests(TestCase):
    """Création des FeePayment à l'arrivée d'un nouveau membre."""

    def setUp(self):
        self.scn = TestScenario.build_full()
        # Active inscription + fond
        fees_service.set_config(self.scn.association, {
            'registration': {'enabled': True, 'amount': 5000, 'is_entry_gate': True},
            'membership_fund': {'enabled': True, 'amount': 50000, 'scope': 'lifetime'},
        })

    def test_creates_both_fees_for_new_member(self):
        new = make_membership(self.scn.association, make_user())
        fees = fees_service.create_initial_fees(new, current_cycle=None)
        self.assertEqual(len(fees), 2)
        types = {f.fee_type for f in fees}
        self.assertIn('registration', types)
        self.assertIn('membership_fund', types)

    def test_mark_as_paid_creates_them_already_paid(self):
        new = make_membership(self.scn.association, make_user())
        fees = fees_service.create_initial_fees(new, mark_as_paid=True)
        for f in fees:
            self.assertEqual(f.status, MembershipFeePayment.Status.PAID)
            self.assertEqual(f.paid_amount, f.expected_amount)

    def test_no_fees_created_if_amount_zero(self):
        # Désactive le fond
        fees_service.set_config(self.scn.association, {
            'membership_fund': {'enabled': False, 'amount': 0},
        })
        new = make_membership(self.scn.association, make_user())
        fees = fees_service.create_initial_fees(new)
        self.assertEqual(len(fees), 1)  # Seule l'inscription
        self.assertEqual(fees[0].fee_type, 'registration')

    def test_idempotent_no_duplicate_on_recall(self):
        new = make_membership(self.scn.association, make_user())
        fees_service.create_initial_fees(new)
        fees_service.create_initial_fees(new)  # 2ᵉ appel
        # Toujours 2 FeePayments, pas 4
        self.assertEqual(
            MembershipFeePayment.all_objects.filter(membership=new).count(), 2,
        )


class RecordPaymentTests(TestCase):
    """
    Versements (partiel ou complet) sur un MembershipFeePayment.
    Vérifie atomicité Transaction + WalletEntry + Installment + activation auto.
    """

    def setUp(self):
        self.scn = TestScenario.build_full()
        # Caisse de trésorerie (sinon record_payment refuse)
        self.account = TreasuryAccount.all_objects.create(
            association=self.scn.association,
            name='Caisse principale',
            account_type=TreasuryAccount.AccountType.CASH,
        )
        fees_service.set_config(self.scn.association, {
            'registration': {'enabled': True, 'amount': 5000, 'is_entry_gate': True},
            'membership_fund': {'enabled': True, 'amount': 50000, 'scope': 'lifetime'},
        })
        # Nouveau membre PENDING (entry_gate)
        self.member = make_membership(
            self.scn.association, make_user(),
            status=Membership.Status.PENDING, is_active=False,
        )
        self.fees = fees_service.create_initial_fees(self.member)
        self.reg_fee = next(f for f in self.fees if f.fee_type == 'registration')
        self.fund_fee = next(f for f in self.fees if f.fee_type == 'membership_fund')

    def test_full_registration_payment_activates_member(self):
        # Avant : pending
        self.assertEqual(self.member.status, Membership.Status.PENDING)

        # Paye TOUT l'inscription d'un coup
        result = fees_service.record_payment(
            fee_payment=self.reg_fee, amount=5000,
            recorded_by=self.scn.bureau1,
        )
        # FeePayment passe à PAID
        self.assertEqual(result['fee_payment'].status, MembershipFeePayment.Status.PAID)
        # Member est désormais ACTIVE
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, Membership.Status.ACTIVE)
        self.assertTrue(self.member.is_active)
        # Transaction comptable créée
        self.assertEqual(result['transaction'].amount, Decimal('5000'))
        # WalletEntry crédit créée
        self.assertEqual(result['wallet_entry'].direction, 'credit')

    def test_partial_payment_does_not_activate(self):
        # Paye 2000 sur 5000 → reste pending
        fees_service.record_payment(
            fee_payment=self.reg_fee, amount=2000,
            recorded_by=self.scn.bureau1,
        )
        self.reg_fee.refresh_from_db()
        self.member.refresh_from_db()
        self.assertEqual(self.reg_fee.status, MembershipFeePayment.Status.PARTIAL)
        self.assertEqual(self.reg_fee.paid_amount, Decimal('2000'))
        # Member reste pending
        self.assertEqual(self.member.status, Membership.Status.PENDING)

    def test_multiple_installments_eventually_complete(self):
        # 3 versements de 2000 + 2000 + 1000 = 5000
        for amt in (2000, 2000, 1000):
            fees_service.record_payment(
                fee_payment=self.reg_fee, amount=amt,
                recorded_by=self.scn.bureau1,
            )
        self.reg_fee.refresh_from_db()
        self.assertEqual(self.reg_fee.status, MembershipFeePayment.Status.PAID)
        self.assertEqual(self.reg_fee.paid_amount, Decimal('5000'))
        # 3 installments enregistrées
        self.assertEqual(self.reg_fee.installments.count(), 3)
        # Member activé
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, Membership.Status.ACTIVE)

    def test_reject_overpayment(self):
        # 6000 sur 5000 → refus
        with self.assertRaises(ValueError):
            fees_service.record_payment(
                fee_payment=self.reg_fee, amount=6000,
                recorded_by=self.scn.bureau1,
            )

    def test_reject_negative_amount(self):
        with self.assertRaises(ValueError):
            fees_service.record_payment(
                fee_payment=self.reg_fee, amount=-100,
                recorded_by=self.scn.bureau1,
            )

    def test_reject_payment_on_already_paid(self):
        fees_service.record_payment(
            fee_payment=self.reg_fee, amount=5000,
            recorded_by=self.scn.bureau1,
        )
        self.reg_fee.refresh_from_db()
        with self.assertRaises(ValueError):
            fees_service.record_payment(
                fee_payment=self.reg_fee, amount=100,
                recorded_by=self.scn.bureau1,
            )

    def test_wallet_balance_reflects_payments(self):
        """Le solde wallet du membre reflète les versements (credit cumule)."""
        fees_service.record_payment(
            fee_payment=self.fund_fee, amount=20000,
            recorded_by=self.scn.bureau1,
        )
        from apps.wallets.models import Wallet
        wallet = Wallet.all_objects.get(membership=self.member)
        self.assertEqual(wallet.balance, Decimal('20000'))


class WaiveFeeTests(TestCase):
    """Exonération d'un frais."""

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

    def test_waive_activates_member(self):
        fees_service.waive_fee(
            self.fee, waived_by=self.scn.president, reason="Cas social, vu en AG",
        )
        self.fee.refresh_from_db()
        self.assertEqual(self.fee.status, MembershipFeePayment.Status.WAIVED)
        self.assertEqual(self.fee.waived_by, self.scn.president)
        self.assertIn("Cas social", self.fee.waiver_reason)
        # Member activé
        self.member.refresh_from_db()
        self.assertEqual(self.member.status, Membership.Status.ACTIVE)

    def test_cannot_waive_already_paid(self):
        fees_service.record_payment(
            fee_payment=self.fee, amount=5000,
            recorded_by=self.scn.bureau1,
        )
        self.fee.refresh_from_db()
        with self.assertRaises(ValueError):
            fees_service.waive_fee(self.fee, waived_by=self.scn.president, reason="Test")


class UniqueConstraintsTests(TestCase):
    """Contraintes DB sur MembershipFeePayment."""

    def setUp(self):
        self.scn = TestScenario.build_full()
        self.member = make_membership(self.scn.association, make_user())

    def test_cannot_create_two_registrations(self):
        MembershipFeePayment.all_objects.create(
            association=self.scn.association,
            membership=self.member,
            fee_type='registration',
            expected_amount=Decimal('5000'),
        )
        with self.assertRaises(Exception):
            MembershipFeePayment.all_objects.create(
                association=self.scn.association,
                membership=self.member,
                fee_type='registration',
                expected_amount=Decimal('5000'),
            )

    def test_can_have_one_lifetime_and_multiple_per_cycle_funds(self):
        from apps.cycles.models import Cycle
        cycle1 = Cycle.all_objects.create(
            association=self.scn.association, name="C1",
            start_date='2026-01-01',
        )
        # 1 lifetime
        MembershipFeePayment.all_objects.create(
            association=self.scn.association,
            membership=self.member,
            fee_type='membership_fund',
            cycle=None,
            expected_amount=Decimal('50000'),
        )
        # 1 per_cycle pour cycle1
        MembershipFeePayment.all_objects.create(
            association=self.scn.association,
            membership=self.member,
            fee_type='membership_fund',
            cycle=cycle1,
            expected_amount=Decimal('20000'),
        )
        # OK
        self.assertEqual(
            MembershipFeePayment.all_objects.filter(membership=self.member).count(), 2,
        )
