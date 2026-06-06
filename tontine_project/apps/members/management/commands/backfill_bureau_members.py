"""
Crée un BureauMember pour chaque membre qui détient un rôle bureau
(is_bureau_role=True) mais n'a pas encore de mandat actif sur la position
correspondante.

Utile après l'introduction de l'auto-création dans InvitationService :
rattrape les membres déjà invités avant ce changement.

Usage :
    python manage.py backfill_bureau_members
    python manage.py backfill_bureau_members --association=<slug>
    python manage.py backfill_bureau_members --dry-run
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Crée les BureauMember manquants pour les membres avec un rôle bureau."

    def add_arguments(self, parser):
        parser.add_argument(
            '--association', type=str, default=None,
            help="Limite à une association (slug). Sinon toutes.",
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help="N'écrit rien — montre seulement ce qui serait fait.",
        )

    def handle(self, *args, **options):
        from apps.core.models import Association
        from apps.members.models import (
            Membership, MemberRole, BureauPosition, BureauMember,
        )

        assocs = Association.objects.all()
        slug = options.get('association')
        if slug:
            assocs = assocs.filter(slug=slug)

        dry = options.get('dry_run', False)
        total_created = 0
        total_skipped = 0
        total_no_position = 0

        for assoc in assocs:
            self.stdout.write(
                self.style.MIGRATE_HEADING(
                    f"\n→ Association: {assoc.name} ({assoc.slug})"
                )
            )

            member_roles = MemberRole.all_objects.filter(
                association=assoc, is_active=True,
                role__is_bureau_role=True,
            ).select_related('membership', 'role')

            for mr in member_roles:
                role = mr.role
                membership = mr.membership
                if not membership.is_active:
                    continue

                position = (
                    BureauPosition.all_objects.filter(
                        association=assoc, slug=role.slug,
                    ).first()
                    or BureauPosition.all_objects.filter(
                        association=assoc, name__iexact=role.name,
                    ).first()
                )
                if not position:
                    total_no_position += 1
                    self.stdout.write(
                        f"  ⚠ {membership.user.first_name} — rôle '{role.name}' "
                        f"sans BureauPosition équivalente."
                    )
                    continue

                existing = BureauMember.all_objects.filter(
                    membership=membership, position=position, is_active=True,
                ).first()
                if existing:
                    total_skipped += 1
                    continue

                if dry:
                    self.stdout.write(
                        f"  [dry] Créerait BureauMember : "
                        f"{membership.user.first_name} → {position.name}"
                    )
                else:
                    BureauMember.objects.create(
                        association=assoc,
                        membership=membership,
                        position=position,
                        start_date=timezone.now().date(),
                        is_active=True,
                        designation_method='backfill_role',
                    )
                    self.stdout.write(self.style.SUCCESS(
                        f"  ✓ {membership.user.first_name} → {position.name}"
                    ))
                total_created += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Terminé : {total_created} créé(s), "
            f"{total_skipped} déjà en place, "
            f"{total_no_position} sans position équivalente."
            + (" (dry-run — rien n'a été écrit)" if dry else "")
        ))
