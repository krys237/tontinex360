from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.core.models import Association


DEFAULT_ROLES = [
    {'name': 'Président', 'slug': 'president', 'is_bureau_role': True,
     'hierarchy_level': 0, 'permissions': ['*']},
    {'name': 'Vice-Président', 'slug': 'vice-president', 'is_bureau_role': True,
     'hierarchy_level': 1, 'permissions': ['members.*', 'tontine.*', 'finance.view', 'session.*']},
    {'name': 'Secrétaire Général', 'slug': 'secretaire-general', 'is_bureau_role': True,
     'hierarchy_level': 2, 'permissions': ['members.*', 'session.*', 'governance.*']},
    {'name': 'Trésorier', 'slug': 'tresorier', 'is_bureau_role': True,
     'hierarchy_level': 3, 'permissions': ['finance.*', 'tontine.view', 'session.view']},
    {'name': 'Commissaire aux comptes', 'slug': 'commissaire', 'is_bureau_role': True,
     'hierarchy_level': 4, 'permissions': ['finance.view', 'finance.audit']},
    {'name': 'Membre', 'slug': 'membre', 'is_bureau_role': False, 'is_system': True,
     'hierarchy_level': 99, 'permissions': ['session.view', 'tontine.view', 'finance.view_own']},
]

DEFAULT_BUREAU_POSITIONS = [
    {'name': 'Président', 'slug': 'president', 'display_order': 1, 'is_required': True},
    {'name': 'Vice-Président', 'slug': 'vice-president', 'display_order': 2, 'is_required': False},
    {'name': 'Secrétaire Général', 'slug': 'secretaire-general', 'display_order': 3, 'is_required': True},
    {'name': 'Trésorier', 'slug': 'tresorier', 'display_order': 4, 'is_required': True},
    {'name': 'Commissaire aux comptes', 'slug': 'commissaire', 'display_order': 5, 'is_required': False},
]

DEFAULT_SANCTION_TYPES = [
    {'name': 'Absence non excusée', 'slug': 'absence', 'default_amount': 500, 'is_automatic': True},
    {'name': 'Retard', 'slug': 'retard', 'default_amount': 200, 'is_automatic': True},
    {'name': 'Retard de paiement', 'slug': 'retard-paiement', 'default_amount': 1000, 'is_automatic': False},
    {'name': "Trouble à l'ordre", 'slug': 'trouble', 'default_amount': 1000, 'is_automatic': False},
]


@receiver(post_save, sender=Association)
def create_default_config(sender, instance, created, **kwargs):
    """
    À la création d'une association, initialise :
    - Rôles par défaut
    - Positions de bureau par défaut
    - Types de sanctions par défaut
    - Compte de trésorerie (Caisse principale)

    L'association pourra ensuite tout personnaliser.
    """
    if not created:
        return

    from apps.members.models import Role, BureauPosition
    from apps.sanctions.models import SanctionType
    from apps.finance.models import TreasuryAccount

    # Rôles
    role_map = {}
    for data in DEFAULT_ROLES:
        role = Role.objects.create(association=instance, **data)
        role_map[data['slug']] = role

    # Positions de bureau
    for data in DEFAULT_BUREAU_POSITIONS:
        default_role = role_map.get(data['slug'])
        BureauPosition.objects.create(
            association=instance, default_role=default_role, **data
        )

    # Types de sanctions
    for data in DEFAULT_SANCTION_TYPES:
        SanctionType.objects.create(association=instance, **data)

    # Compte de trésorerie par défaut
    TreasuryAccount.objects.create(
        association=instance,
        name='Caisse principale',
        account_type=TreasuryAccount.AccountType.CASH,
    )
