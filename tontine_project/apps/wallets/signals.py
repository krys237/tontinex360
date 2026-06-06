from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='members.Membership')
def create_wallet_for_new_membership(sender, instance, created, **kwargs):
    """Auto-création du Wallet lorsqu'un Membership est créé actif."""
    if not created:
        return
    if not instance.is_active:
        return
    from apps.wallets.services import WalletService
    WalletService.ensure_wallet(instance)


@receiver(post_save, sender='members.Resignation')
def freeze_wallet_on_approved_resignation(sender, instance, **kwargs):
    """Gèle le wallet quand une démission passe à APPROVED."""
    if instance.status != 'approved':
        return
    from apps.wallets.services import WalletService
    WalletService.freeze_wallet(instance.membership)


@receiver(post_save, sender='sanctions.Sanction')
def distribute_sanction_on_paid(sender, instance, **kwargs):
    """Lorsqu'une sanction passe à PAID, on distribue son montant aux wallets."""
    if instance.status != 'paid':
        return
    from apps.wallets.models import WalletEntry
    already = WalletEntry.all_objects.filter(
        source_type=WalletEntry.Source.SANCTION_PAYMENT,
        source_id=instance.id,
    ).exists()
    if already:
        return
    from apps.wallets.services import WalletService
    WalletService.distribute_sanction_payment(instance)


@receiver(post_save, sender='finance.LoanRepayment')
def distribute_loan_interest_on_repayment(sender, instance, created, **kwargs):
    """Distribue la part intérêt d'un remboursement de prêt."""
    if not created:
        return
    from apps.wallets.models import WalletEntry
    already = WalletEntry.all_objects.filter(
        source_type=WalletEntry.Source.LOAN_INTEREST,
        source_id=instance.id,
    ).exists()
    if already:
        return
    from apps.wallets.services import WalletService
    WalletService.distribute_loan_interest(instance)


@receiver(post_save, sender='finance.Transaction')
def distribute_expense_on_creation(sender, instance, created, **kwargs):
    """Distribue une dépense aux membres si distribute_to_members=True."""
    if not created:
        return
    if not getattr(instance, 'distribute_to_members', False):
        return
    if instance.transaction_type != instance.TransactionType.EXPENSE:
        return
    from apps.wallets.models import WalletEntry
    already = WalletEntry.all_objects.filter(
        source_type=WalletEntry.Source.EXPENSE, source_id=instance.id,
    ).exists()
    if already:
        return
    from apps.wallets.services import WalletService
    WalletService.distribute_expense(instance)
