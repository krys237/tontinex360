"""
Management command pour creer/mettre a jour les plans d'abonnement.

Tous les plans donnent acces a TOUTES les fonctionnalites de la plateforme.
Ils ne different que par les seuils :
  - nombre maximum de membres
  - cagnotte mensuelle maximale autorisee

Le tier d'un abonnement est determine apres une periode de mesure de 90 jours
selon la cagnotte mensuelle moyenne ET le nombre de membres actifs (le plus
contraignant des deux gagne) :

    Cagnotte >= 50 M  ou  membres > 100   -> President   (75 000 / mois)
    Cagnotte >= 30 M  ou  membres > 50    -> VIP         (50 000 / mois)
    Cagnotte >=  1 M  ou  membres > 30    -> Pro         (25 000 / mois)
    Cagnotte >= 250 K ou  membres > 15    -> Quartier    ( 7 500 / mois)
    Cagnotte >= 100 K ou  membres > 10    -> Village     ( 4 000 / mois)
    sinon                                 -> Famille     ( 3 000 / mois)

Usage :
    python manage.py seed_plans            # Cree/met a jour les nouveaux plans
    python manage.py seed_plans --purge    # Supprime aussi les plans obsoletes
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.subscriptions.models import Plan


PLANS = [
    {
        'name': 'Famille',
        'slug': 'famille',
        'description': "Pour les petites tontines familiales. Acces complet a la plateforme.",
        'price_monthly': 3000,
        'price_yearly': 30000,
        'max_members': 10,
        'max_monthly_cagnotte': 100_000,
        'trial_days': 90,
        'display_order': 0,
    },
    {
        'name': 'Village',
        'slug': 'village',
        'description': "Pour les tontines de village. Jusqu'a 15 membres et 250 000 / mois.",
        'price_monthly': 4000,
        'price_yearly': 40000,
        'max_members': 15,
        'max_monthly_cagnotte': 250_000,
        'trial_days': 90,
        'display_order': 1,
    },
    {
        'name': 'Quartier',
        'slug': 'quartier',
        'description': "Pour les tontines de quartier. Jusqu'a 30 membres et 1 000 000 / mois.",
        'price_monthly': 7500,
        'price_yearly': 75000,
        'max_members': 30,
        'max_monthly_cagnotte': 1_000_000,
        'trial_days': 90,
        'display_order': 2,
    },
    {
        'name': 'Pro',
        'slug': 'pro',
        'description': "Pour les associations etablies. Jusqu'a 50 membres et 30 000 000 / mois.",
        'price_monthly': 25000,
        'price_yearly': 250000,
        'max_members': 50,
        'max_monthly_cagnotte': 30_000_000,
        'trial_days': 90,
        'display_order': 3,
    },
    {
        'name': 'VIP',
        'slug': 'vip',
        'description': "Pour les grandes associations. Jusqu'a 100 membres et 50 000 000 / mois.",
        'price_monthly': 50000,
        'price_yearly': 500000,
        'max_members': 100,
        'max_monthly_cagnotte': 50_000_000,
        'trial_days': 90,
        'display_order': 4,
    },
    {
        'name': 'President',
        'slug': 'president',
        'description': "Sans limites. Pour les grandes federations et reseaux nationaux.",
        'price_monthly': 75000,
        'price_yearly': 750000,
        'max_members': Plan.UNLIMITED,
        'max_monthly_cagnotte': Plan.UNLIMITED,
        'trial_days': 90,
        'display_order': 5,
    },
]

OBSOLETE_SLUGS = ['free', 'starter', 'enterprise']

# Remapping des anciens slugs vers les nouveaux pour les abonnements existants.
# Les anciens 'pro' restent sur 'pro' (meme slug).
LEGACY_REMAP = {
    'free': 'famille',
    'starter': 'village',
    'enterprise': 'president',
}


class Command(BaseCommand):
    help = "Seed des plans d'abonnement (Famille, Village, Quartier, Pro, VIP, President)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--purge',
            action='store_true',
            help="Supprime les plans obsoletes (free/starter/enterprise) avant le seed",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        purge = options['purge']

        # 1. Cree/met a jour les nouveaux plans
        created = 0
        updated = 0
        for data in PLANS:
            obj, was_created = Plan.objects.update_or_create(
                slug=data['slug'], defaults=data,
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  CREE   {obj.slug}"))
            else:
                updated += 1
                self.stdout.write(f"  MAJ    {obj.slug}")

        # 2. Si --purge, remappe les abonnements existants puis supprime les obsoletes
        if purge:
            from apps.subscriptions.models import Subscription

            for old_slug, new_slug in LEGACY_REMAP.items():
                old = Plan.objects.filter(slug=old_slug).first()
                new = Plan.objects.filter(slug=new_slug).first()
                if not old or not new:
                    continue
                migrated = Subscription.objects.filter(plan=old).update(plan=new)
                if migrated:
                    self.stdout.write(self.style.WARNING(
                        f"  REMAP  {migrated} subscription(s) {old_slug} -> {new_slug}"
                    ))

            deleted, _ = Plan.objects.filter(slug__in=OBSOLETE_SLUGS).delete()
            if deleted:
                self.stdout.write(self.style.WARNING(
                    f"  PURGE  {deleted} plan(s) obsolete(s) supprime(s)"
                ))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f"Termine : {created} cree(s), {updated} mis a jour."
        ))
