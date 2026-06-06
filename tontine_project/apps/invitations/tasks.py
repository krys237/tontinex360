"""
Tâches Celery pour la gestion des invitations.
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name='apps.invitations.tasks.expire_old_invitations')
def expire_old_invitations():
    """
    Expire les invitations dont la date d'expiration est dépassée.
    
    Planifié chaque jour à 1h via celery-beat.
    
    Les invitations en status 'pending' dont expires_at < maintenant
    passent en status 'expired'.
    """
    from apps.invitations.models import Invitation

    now = timezone.now()

    expired = Invitation.all_objects.filter(
        status='pending',
        expires_at__lt=now,
    )

    count = expired.count()
    expired.update(status='expired')

    logger.info(f"Invitations expirées: {count}")
    return {'expired': count}
