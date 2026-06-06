"""
Endpoints publics de vérification de bordereaux (QR code scannable).
Pas d'authentification requise — pour permettre à n'importe qui de vérifier
l'authenticité d'un reçu en scannant le QR du PDF.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status


def _payout_payload(payout):
    """Données publiques d'un bordereau (sans infos sensibles)."""
    pot = payout.pot
    session = pot.session
    cycle = session.cycle
    association = payout.association
    user = payout.membership.user
    tt = pot.tontine_type

    return {
        'type': 'payout',
        'is_valid': bool(payout.receipt_hash and payout.receipt_pdf),
        'receipt_number': payout.receipt_number,
        'receipt_hash': payout.receipt_hash,
        'signed_at': payout.receipt_signed_at,
        'association': {
            'name': association.name,
            'slug': association.slug,
            'city': association.city,
            'country': association.country,
        },
        'cycle': cycle.name,
        'session_number': session.session_number,
        'session_date': session.date,
        'tontine_name': tt.name if tt else None,
        'beneficiary': {
            'name': f"{user.first_name or ''} {user.last_name or ''}".strip(),
            'member_number': payout.membership.member_number,
        },
        'amount': str(payout.amount),
        'currency': (association.settings or {}).get('currency', 'XAF'),
        'method': payout.get_acquisition_method_display(),
        'status': payout.status,
        'pdf_url': payout.receipt_pdf.url if payout.receipt_pdf else None,
    }


class PublicReceiptVerifyView(APIView):
    """
    GET /api/receipts/verify/{hash}/

    Renvoie les informations publiques d'un bordereau identifié par son hash.
    Aucune authentification requise.
    Si le hash est introuvable → 404.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, hash_value):
        if not hash_value or len(hash_value) < 32:
            return Response(
                {'is_valid': False, 'error': 'Hash invalide.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cherche d'abord dans les BeneficiaryPayout
        from apps.cycles.models import BeneficiaryPayout
        payout = BeneficiaryPayout.all_objects.filter(
            receipt_hash=hash_value,
        ).select_related(
            'pot__session__cycle', 'pot__tontine_type',
            'membership__user', 'association',
        ).first()
        if payout:
            return Response(_payout_payload(payout))

        # Phase 2.3 : on cherche aussi dans Contribution / LoanRepayment / Sanction
        try:
            from apps.finance.models import Contribution, LoanRepayment
            for Model, kind in [(Contribution, 'contribution'), (LoanRepayment, 'loan_repayment')]:
                obj = Model.all_objects.filter(
                    receipt_hash=hash_value,
                ).select_related('membership__user', 'association').first()
                if obj:
                    return Response(_generic_payload(obj, kind))
        except Exception:
            pass

        try:
            from apps.sanctions.models import Sanction
            sanction = Sanction.all_objects.filter(
                receipt_hash=hash_value,
            ).select_related('membership__user', 'association').first()
            if sanction:
                return Response(_generic_payload(sanction, 'sanction'))
        except Exception:
            pass

        return Response(
            {'is_valid': False, 'error': 'Bordereau introuvable.'},
            status=status.HTTP_404_NOT_FOUND,
        )


def _generic_payload(obj, kind):
    """Payload pour Contribution / LoanRepayment / Sanction."""
    association = obj.association
    membership = obj.membership
    user = membership.user

    base = {
        'type': kind,
        'is_valid': bool(obj.receipt_hash and obj.receipt_pdf),
        'receipt_number': obj.receipt_number,
        'receipt_hash': obj.receipt_hash,
        'signed_at': obj.receipt_signed_at,
        'association': {
            'name': association.name,
            'slug': association.slug,
            'city': association.city,
            'country': association.country,
        },
        'beneficiary': {
            'name': f"{user.first_name or ''} {user.last_name or ''}".strip(),
            'member_number': membership.member_number,
        },
        'currency': (association.settings or {}).get('currency', 'XAF'),
        'pdf_url': obj.receipt_pdf.url if obj.receipt_pdf else None,
    }

    if kind == 'contribution':
        base['amount'] = str(obj.paid_amount or obj.expected_amount)
        base['session_number'] = obj.session.session_number if obj.session else None
        base['session_date'] = obj.session.date if obj.session else None
        base['tontine_name'] = obj.tontine_type.name if obj.tontine_type else None
    elif kind == 'loan_repayment':
        base['amount'] = str(obj.amount)
        base['loan_id'] = str(obj.loan_id) if obj.loan_id else None
    elif kind == 'sanction':
        base['amount'] = str(obj.amount)
        base['reason'] = obj.reason

    return base
