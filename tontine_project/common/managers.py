import threading
from django.db import models

_thread_local = threading.local()


def get_current_association():
    """Récupère l'association active du thread courant."""
    return getattr(_thread_local, 'association', None)


def set_current_association(association):
    """Définit l'association active pour le thread courant."""
    _thread_local.association = association


class TenantAwareManager(models.Manager):
    """
    Manager qui filtre automatiquement par l'association active.

    Équivalent du SET search_path TO de django-tenants,
    mais au niveau applicatif.

    Usage dans les modèles :
        objects = TenantAwareManager()       # Filtré par tenant
        all_objects = models.Manager()       # Non filtré (admin, cross-tenant)
    """

    def get_queryset(self):
        qs = super().get_queryset()
        association = get_current_association()
        if association:
            return qs.filter(association=association)
        return qs
