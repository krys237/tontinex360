import uuid
from django.db import models


class TimeStampedModel(models.Model):
    """Base abstraite avec timestamps automatiques."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantAwareModel(TimeStampedModel):
    """
    Base abstraite pour TOUS les modèles isolés par association.
    Ajoute automatiquement la FK vers Association.

    Chaque modèle métier (sauf User, Association, Plan, Subscription, Payment)
    DOIT hériter de celui-ci pour garantir l'isolation des données.
    """
    association = models.ForeignKey(
        'core.Association',
        on_delete=models.CASCADE,
        related_name='%(class)s_set',
        db_index=True,
    )

    class Meta:
        abstract = True
