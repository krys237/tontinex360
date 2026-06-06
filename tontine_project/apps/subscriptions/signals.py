"""
Signaux pour les abonnements.
A la confirmation d'un paiement -> activation de l'abonnement.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.subscriptions.models import Payment

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Payment)
def activate_subscription_on_payment(sender, instance, created, update_fields, **kwargs):
    """Quand un Payment passe a COMPLETED, on active l'abonnement lie."""
    if instance.status != Payment.Status.COMPLETED:
        return

    # On evite la double activation : si update_fields ne contient pas `status`
    # ET que ce n'est pas une creation -> rien a faire.
    if not created and update_fields and 'status' not in update_fields:
        return

    from apps.subscriptions.services import SubscriptionService

    try:
        SubscriptionService.activate_from_payment(instance)
    except Exception as e:
        logger.error(
            "Activation impossible apres paiement %s: %s", instance.id, e,
        )
