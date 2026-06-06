"""
Endpoints d'import massif de membres depuis Excel.

- POST   /members/imports/preview/   : dry-run, parse + valide sans rien créer
- POST   /members/imports/           : crée un batch + applique le mode
- GET    /members/imports/           : historique
- GET    /members/imports/{id}/      : détail d'un batch + lignes
- GET    /members/imports/template/  : télécharge un .xlsx prérempli
"""
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import HasAssociation, IsMember
from apps.members.models import (
    MemberImportBatch, MemberImportRow, Membership,
)
from apps.members import import_service


def _current_membership(request):
    association = getattr(request, 'association', None)
    if not association or not request.user.is_authenticated:
        return None
    return Membership.all_objects.filter(
        association=association, user=request.user, is_active=True,
    ).first()


def _has_invite_perm(membership) -> bool:
    """Doit avoir un rôle bureau, OU permission members.* / *, OU être founder."""
    if not membership:
        return False
    if getattr(membership, 'is_founder', False):
        return True
    from apps.members.models import MemberRole
    roles = MemberRole.all_objects.filter(membership=membership, is_active=True).select_related('role')
    for mr in roles:
        if mr.role.is_bureau_role:
            return True
        perms = mr.role.permissions or []
        if '*' in perms or 'members.*' in perms or 'members.invite' in perms:
            return True
    return False


# ─── Sérialisation light en local (pas de fichier dédié) ────────────


def _row_to_dict(row: MemberImportRow) -> dict:
    return {
        'id': str(row.id),
        'row_number': row.row_number,
        'parsed_telephone': row.parsed_telephone,
        'parsed_first_name': row.parsed_first_name,
        'parsed_last_name': row.parsed_last_name,
        'parsed_email': row.parsed_email,
        'parsed_member_number': row.parsed_member_number,
        'status': row.status,
        'error_message': row.error_message,
        'resulting_membership': (
            str(row.resulting_membership_id) if row.resulting_membership_id else None
        ),
        'resulting_invitation_id': (
            str(row.resulting_invitation_id) if row.resulting_invitation_id else None
        ),
    }


def _batch_to_dict(batch: MemberImportBatch, include_rows=False) -> dict:
    out = {
        'id': str(batch.id),
        'filename': batch.filename,
        'mode': batch.mode,
        'status': batch.status,
        'total_rows': batch.total_rows,
        'success_count': batch.success_count,
        'error_count': batch.error_count,
        'skipped_count': batch.skipped_count,
        'imported_by': (
            f"{batch.imported_by.user.first_name} {batch.imported_by.user.last_name}".strip()
            or batch.imported_by.user.telephone
        ),
        'created_at': batch.created_at.isoformat(),
        'processed_at': batch.processed_at.isoformat() if batch.processed_at else None,
    }
    if include_rows:
        out['rows'] = [_row_to_dict(r) for r in batch.rows.all()]
    return out


# ─── ViewSet ────────────────────────────────────────────────────────


class MemberImportViewSet(viewsets.ViewSet):
    """Import en masse de membres depuis Excel."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # ── Historique ────────────────────────────────────────────────
    def list(self, request):
        association = request.association
        batches = MemberImportBatch.all_objects.filter(
            association=association,
        ).select_related('imported_by__user').order_by('-created_at')[:50]
        return Response([_batch_to_dict(b) for b in batches])

    def retrieve(self, request, pk=None):
        association = request.association
        try:
            batch = MemberImportBatch.all_objects.select_related(
                'imported_by__user',
            ).prefetch_related('rows').get(id=pk, association=association)
        except MemberImportBatch.DoesNotExist:
            return Response({'error': 'Batch introuvable.'}, status=404)
        return Response(_batch_to_dict(batch, include_rows=True))

    # ── Preview (dry-run) ─────────────────────────────────────────
    @action(detail=False, methods=['post'])
    def preview(self, request):
        """Parse + valide le fichier sans rien créer. Retourne les rows annotées."""
        membership = _current_membership(request)
        if not _has_invite_perm(membership):
            return Response(
                {'error': "Permission d'importation requise (bureau)."},
                status=status.HTTP_403_FORBIDDEN,
            )

        f = request.FILES.get('file')
        if not f:
            return Response({'error': "Aucun fichier reçu (clé 'file')."}, status=400)
        if not f.name.lower().endswith(('.xlsx', '.xlsm')):
            return Response({'error': "Format attendu : .xlsx"}, status=400)

        rows, errors = import_service.parse_excel(f.read())
        if errors:
            return Response({'errors': errors, 'rows': []}, status=400)

        rows = import_service.validate_rows(request.association, rows)
        stats = {
            'total': len(rows),
            'ok': sum(1 for r in rows if r['validation'] == 'ok'),
            'duplicate': sum(1 for r in rows if r['validation'] == 'duplicate'),
            'invalid': sum(1 for r in rows if r['validation'] == 'invalid'),
            'doublon_fichier': sum(1 for r in rows if r['validation'] == 'doublon_fichier'),
        }
        return Response({'rows': rows, 'stats': stats, 'errors': []})

    # ── Import réel ───────────────────────────────────────────────
    def create(self, request):
        """Crée un MemberImportBatch et applique le mode (DIRECT / INVITE)."""
        membership = _current_membership(request)
        if not _has_invite_perm(membership):
            return Response(
                {'error': "Permission d'importation requise (bureau)."},
                status=status.HTTP_403_FORBIDDEN,
            )

        f = request.FILES.get('file')
        if not f:
            return Response({'error': "Aucun fichier reçu (clé 'file')."}, status=400)
        if not f.name.lower().endswith(('.xlsx', '.xlsm')):
            return Response({'error': "Format attendu : .xlsx"}, status=400)

        mode = (request.data.get('mode') or 'invite').lower()
        if mode not in (MemberImportBatch.Mode.DIRECT, MemberImportBatch.Mode.INVITE):
            return Response({'error': "mode doit être 'direct' ou 'invite'."}, status=400)

        rows, errors = import_service.parse_excel(f.read())
        if errors:
            return Response({'errors': errors}, status=400)
        rows = import_service.validate_rows(request.association, rows)

        batch = MemberImportBatch.all_objects.create(
            association=request.association,
            imported_by=membership,
            filename=f.name[:255],
            mode=mode,
        )
        stats = import_service.process_batch(batch, rows)
        return Response(
            {**_batch_to_dict(batch, include_rows=True), 'stats': stats},
            status=status.HTTP_201_CREATED,
        )

    # ── Template Excel ────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def template(self, request):
        """Télécharge un .xlsx prérempli avec les bonnes colonnes."""
        data = import_service.build_template_xlsx()
        resp = HttpResponse(
            data,
            content_type=(
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
        )
        resp['Content-Disposition'] = 'attachment; filename="template-import-membres.xlsx"'
        return resp
