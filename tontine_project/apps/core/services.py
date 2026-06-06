from datetime import timedelta
from django.db import transaction
from django.utils import timezone


class AssociationCreationService:
    """
    Point d'entrée UNIQUE pour créer une association.
    NE JAMAIS utiliser Association.objects.create() directement.

    Orchestre en une transaction atomique :
    1. Création de l'Association (avec `created_by=user`)
    2. Le signal post_save crée les rôles & positions par défaut
    3. Création du Membership fondateur avec `is_founder=True`
    4. Attribution des rôles "Fondateur" (créé par le service) ET "Président"
       (créé par le signal) — les deux pour cohérence et sécurité
    5. Création de la Subscription trial
    6. Positionnement du fondateur comme Président au bureau
    """

    @classmethod
    @transaction.atomic
    def create_association(cls, user, name, slug, description='', **kwargs):
        from apps.core.models import Association
        from apps.members.models import (
            Membership, Role, MemberRole, BureauPosition, BureauMember,
        )
        from apps.subscriptions.models import Plan, Subscription

        # 1. Association — `created_by` capture le fondateur de manière permanente
        association = Association.objects.create(
            name=name,
            slug=slug,
            description=description,
            created_by=user,
            settings={
                'currency': 'XAF',
                'allow_multiple_names': True,
                'max_names_per_member': 5,
            },
            **kwargs,
        )

        # 2. Membership fondateur — flag is_founder garantit l'identification
        # même si les rôles sont modifiés plus tard
        membership = Membership.all_objects.create(
            association=association,
            user=user,
            status=Membership.Status.ACTIVE,
            member_number='001',
            is_active=True,
            is_founder=True,
        )

        # 3a. Rôle "Fondateur" système (irrévocable, accès total)
        founder_role, _ = Role.all_objects.get_or_create(
            association=association,
            slug='fondateur',
            defaults={
                'name': 'Fondateur',
                'description': "Créateur de l'association — accès total et irrévocable",
                'permissions': ['*'],
                'is_bureau_role': True,
                'is_system': True,
                'hierarchy_level': 0,
            },
        )
        MemberRole.all_objects.get_or_create(
            association=association,
            membership=membership,
            role=founder_role,
            defaults={'is_active': True},
        )

        # 3b. Rôle "Président" (créé par le signal) — assigné aussi pour cohérence
        president_role = Role.all_objects.filter(
            association=association, slug='president',
        ).first()
        if president_role:
            MemberRole.all_objects.get_or_create(
                association=association,
                membership=membership,
                role=president_role,
                defaults={'is_active': True},
            )

        # 4. Subscription trial
        plan = Plan.objects.filter(slug='famille').first()
        now = timezone.now()
        subscription = None
        if plan:
            subscription = Subscription.objects.create(
                association=association,
                plan=plan,
                status=Subscription.Status.TRIALING,
                trial_start=now,
                trial_end=now + timedelta(days=plan.trial_days),
            )

        # 5. Bureau — fondateur = président
        president_pos = BureauPosition.all_objects.filter(
            association=association, slug='president'
        ).first()
        if president_pos:
            BureauMember.all_objects.get_or_create(
                association=association,
                membership=membership,
                position=president_pos,
                defaults={
                    'start_date': now.date(),
                    'is_active': True,
                    'designation_method': 'fondateur',
                },
            )

        return association, membership, subscription
