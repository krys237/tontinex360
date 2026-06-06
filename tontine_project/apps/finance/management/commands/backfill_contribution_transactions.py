"""
Crée les Transactions comptables manquantes pour les cotisations déjà
payées (paid/partial) qui n'ont jamais été comptabilisées.

Usage:
    python manage.py backfill_contribution_transactions [--dry-run] [--association <id>]
"""
from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction


class Command(BaseCommand):
    help = (
        "Crée les Transactions comptables manquantes pour les cotisations "
        "déjà payées (paid/partial) sans Transaction associée."
    )

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help="Affiche les actions sans rien créer.")
        parser.add_argument('--association', type=str, default=None,
                            help="UUID d'association pour limiter le scope.")

    def handle(self, *args, **opts):
        from apps.finance.models import Contribution
        from apps.finance.services import ContributionPaymentService

        qs = Contribution.all_objects.filter(
            paid_amount__gt=0,
            status__in=['paid', 'partial'],
        ).select_related('membership__user', 'tontine_type', 'session', 'association')

        if opts['association']:
            qs = qs.filter(association_id=opts['association'])

        total = qs.count()
        self.stdout.write(f"Cotisations candidates : {total}")

        created = 0
        skipped = 0
        errors = 0
        for c in qs.iterator():
            existing = ContributionPaymentService.existing_transaction(c)
            if existing:
                skipped += 1
                continue

            if opts['dry_run']:
                self.stdout.write(
                    f"  [DRY] Créerait TX pour cotisation {c.id} "
                    f"({c.paid_amount} XAF, {c.tontine_type.name})"
                )
                created += 1
                continue

            try:
                with db_transaction.atomic():
                    tx = ContributionPaymentService.record_payment(
                        c, recorded_by=c.recorded_by,
                    )
                if tx:
                    created += 1
                    self.stdout.write(self.style.SUCCESS(
                        f"  ✓ TX {tx.id} créée pour cotisation {c.id} ({tx.amount} XAF)"
                    ))
            except Exception as e:
                errors += 1
                self.stderr.write(self.style.ERROR(
                    f"  ✗ Échec cotisation {c.id} : {e}"
                ))

        verb = "Créées (simulées)" if opts['dry_run'] else "Créées"
        self.stdout.write(self.style.SUCCESS(
            f"\n{verb}: {created} · Déjà OK: {skipped} · Erreurs: {errors}"
        ))
