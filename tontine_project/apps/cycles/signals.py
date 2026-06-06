from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.cycles.models import Cycle
from apps.cycles.services import generate_sessions_for_cycle


@receiver(post_save, sender=Cycle)
def create_default_session(sender, instance, created, **kwargs):
    if created:
        generate_sessions_for_cycle(instance)