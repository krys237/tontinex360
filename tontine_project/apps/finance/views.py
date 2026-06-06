from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotFound
from rest_framework.decorators import action
from django.db import transaction as db_transaction

from django.utils import timezone

from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember, HasPermission
from apps.finance.models import (
    Contribution, Loan, LoanRepayment, TreasuryAccount, Transaction,
    ContributionCorrectionRequest,
)
from apps.finance.serializers import (
    ContributionSerializer, LoanSerializer, LoanRepaymentSerializer,
    TreasuryAccountSerializer, TransactionSerializer,
    ContributionCorrectionRequestSerializer,
)
from apps.finance.services import TontineFundService, ContributionPaymentService
from apps.finance import correction_service
from decimal import Decimal, InvalidOperation


def _extract_device_info(request, body_data):
    info = dict(body_data) if isinstance(body_data, dict) else {}
    info.setdefault('ip', (
        request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
        or request.META.get('REMOTE_ADDR', '')
    ))
    info.setdefault('user_agent', request.META.get('HTTP_USER_AGENT', ''))
    return info


def _validate_signature(request):
    sig = request.data.get('signature')
    if not sig or not sig.startswith('data:image/'):
        return None, Response(
            {'error': 'Signature manquante ou invalide.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return sig, None


class ContributionViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Contribution.all_objects.select_related('membership__user', 'session', 'tontine_type')
    serializer_class = ContributionSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['session', 'membership', 'tontine_type', 'status']

    def story_memeber_contribution(self,request):
        pass

    # ── Helpers ────────────────────────────────────────────────────────
    @staticmethod
    def _parse_amount(raw):
        try:
            return Decimal(str(raw))
        except (InvalidOperation, TypeError, ValueError):
            return None

    @staticmethod
    def _resolve_account_from_request(request, contribution):
        """Si le payload contient `treasury_account` (UUID), on l'utilise."""
        account_id = request.data.get('treasury_account')
        if not account_id:
            return None
        account = TreasuryAccount.all_objects.filter(
            association=contribution.association, id=account_id, is_active=True,
        ).first()
        if not account:
            raise NotFound("Caisse de trésorerie spécifiée introuvable ou inactive.")
        return account

    # ── Création ───────────────────────────────────────────────────────
    @db_transaction.atomic
    def perform_create(self, serializer):
        membership = self._get_membership()
        contribution = serializer.save(
            association=self.request.association,
            recorded_by=membership,
        )
        if contribution.paid_amount and contribution.paid_amount > 0:
            account = self._resolve_account_from_request(self.request, contribution)
            ContributionPaymentService.record_payment(
                contribution, recorded_by=membership, account=account,
            )

    # ── Mise à jour : blocage si paiement déjà comptabilisé ───────────
    @db_transaction.atomic
    def update(self, request, *args, **kwargs):
        return self._do_update(request, *args, partial=False, **kwargs)

    @db_transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        return self._do_update(request, *args, partial=True, **kwargs)

    def _do_update(self, request, *args, partial, **kwargs):
        contribution = self.get_object()
        existing_tx = ContributionPaymentService.existing_transaction(contribution)

        # Détecter une tentative de modification du paid_amount
        if 'paid_amount' in request.data:
            new_amount = self._parse_amount(request.data.get('paid_amount'))
            if new_amount is None:
                return Response(
                    {'error': "paid_amount invalide."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if existing_tx and new_amount != contribution.paid_amount:
                return Response(
                    {
                        'error': (
                            "Le paiement est déjà comptabilisé. Pour modifier le "
                            "montant, soumettez une demande de correction "
                            "(double validation Président + Bureau)."
                        ),
                        'use_endpoint': f"/api/finance/contributions/{contribution.id}/request-correction/",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Faire le PATCH/PUT standard
        serializer = self.get_serializer(contribution, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        membership = self._get_membership()
        updated = serializer.save(recorded_by=contribution.recorded_by or membership)

        # Si pas encore de transaction et qu'on a maintenant un montant payé
        # > 0 avec status paid/partial → comptabiliser
        if not existing_tx and updated.paid_amount and updated.paid_amount > 0 \
                and updated.status in (Contribution.Status.PAID, Contribution.Status.PARTIAL):
            account = self._resolve_account_from_request(request, updated)
            ContributionPaymentService.record_payment(
                updated, recorded_by=membership, account=account,
            )

        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=['post'], url_path='request-correction')
    @db_transaction.atomic
    def request_correction(self, request, pk=None):
        """Soumet une demande de correction de cotisation (double validation requise)."""
        contribution = self.get_object()
        if contribution.receipt_pdf:
            return Response(
                {'error': "Bordereau signé : la correction simple n'est plus possible."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if contribution.correction_requests.filter(
            status__in=['pending', 'pres_approved', 'bureau_approved'],
        ).exists():
            return Response(
                {'error': "Une demande de correction est déjà en cours pour cette cotisation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            new_amount = request.data.get('new_paid_amount')
            new_amount = type(contribution.paid_amount)(str(new_amount))
        except Exception:
            return Response(
                {'error': "new_paid_amount invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_amount < 0:
            return Response(
                {'error': "Le nouveau montant doit être positif ou nul."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_amount == contribution.paid_amount:
            return Response(
                {'error': "Le nouveau montant est identique au montant actuel."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = (request.data.get('reason') or '').strip()
        if len(reason) < 5:
            return Response(
                {'error': "Le motif doit faire au moins 5 caractères."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = getattr(request, 'current_membership', None) or request.user.memberships.filter(
            association=request.association,
        ).first()
        if not membership:
            return Response({'error': "Membership introuvable."}, status=403)

        expires_at = timezone.now() + correction_service.CORRECTION_TTL
        req = ContributionCorrectionRequest.all_objects.create(
            association=request.association,
            contribution=contribution,
            requested_by=membership,
            original_paid_amount=contribution.paid_amount,
            new_paid_amount=new_amount,
            original_status=contribution.status,
            reason=reason,
            expires_at=expires_at,
        )
        correction_service.notify_bureau_of_new_request(req)
        return Response(
            ContributionCorrectionRequestSerializer(req).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    @db_transaction.atomic
    def sign_receipt(self, request, pk=None):
        """Signe le bordereau d'une cotisation payée et génère le PDF."""
        contribution = self.get_object()
        if contribution.receipt_pdf:
            return Response(
                {'error': "Cette cotisation a déjà un bordereau signé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if contribution.status not in ('paid', 'partial'):
            return Response(
                {'error': "Seules les cotisations payées peuvent être signées."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sig, err = _validate_signature(request)
        if err:
            return err
        device_info = _extract_device_info(request, request.data.get('device_info'))
        from apps.finance.receipt_service import sign_contribution_receipt
        base_url = request.build_absolute_uri('/').rstrip('/')
        try:
            sign_contribution_receipt(contribution, sig, device_info, base_url)
        except Exception as e:
            return Response(
                {'error': f"Échec génération : {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(ContributionSerializer(contribution).data)


class LoanViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Loan.all_objects.select_related('membership__user', 'session_granted').prefetch_related('repayments')
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['membership', 'status']
    required_permission = 'finance.view'

    # Tout champ qui modifie engagements financiers ou cycle de vie du prêt
    # doit passer par les handlers d'approbation.
    PROTECTED_FIELDS = ('amount', 'interest_rate', 'total_due', 'due_date', 'status')
    STATUS_TO_ACTION = {
        'approved': 'loan.approve',
        'disbursed': 'loan.approve',
        'defaulted': 'loan.write_off',
    }

    def _is_bureau(self, membership):
        if not membership:
            return False
        from apps.members.models import MemberRole
        roles = MemberRole.all_objects.filter(
            membership=membership, is_active=True,
        ).select_related('role')
        for mr in roles:
            perms = mr.role.permissions or []
            if '*' in perms or 'finance.*' in perms or 'finance.loans' in perms:
                return True
            if getattr(mr.role, 'is_bureau_role', False):
                return True
        return False

    def perform_create(self, serializer):
        """Un membre lambda ne peut demander un prêt que pour lui-même.
        Le bureau peut créer pour autrui (cas de demande relayée)."""
        from rest_framework.exceptions import PermissionDenied
        membership = self._get_membership()
        requested = serializer.validated_data.get('membership')
        if requested and requested != membership and not self._is_bureau(membership):
            raise PermissionDenied(
                "Vous ne pouvez demander un prêt que pour vous-même.",
            )
        # Un membre simple crée toujours en statut 'pending' (le bureau approuvera)
        if not self._is_bureau(membership):
            serializer.validated_data['status'] = 'pending'
        serializer.save(association=self.request.association)

    def _guard(self, request, loan):
        from apps.approvals.guards import reject_direct_write
        body = request.data if hasattr(request, 'data') else {}
        touched = [f for f in self.PROTECTED_FIELDS if f in body]
        if not touched:
            return None
        action_type = 'loan.modify'
        if 'status' in touched:
            action_type = self.STATUS_TO_ACTION.get(body.get('status'), 'loan.modify')
        return reject_direct_write(
            request,
            target_model='finance.Loan',
            target_id=loan.id,
            action_type=action_type,
            protected_fields=self.PROTECTED_FIELDS,
        )

    def update(self, request, *args, **kwargs):
        loan = self.get_object()
        guard = self._guard(request, loan)
        if guard is not None:
            return guard
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        loan = self.get_object()
        guard = self._guard(request, loan)
        if guard is not None:
            return guard
        return super().partial_update(request, *args, **kwargs)


class LoanRepaymentViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = LoanRepayment.all_objects.select_related('loan', 'session')
    serializer_class = LoanRepaymentSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['loan']

    PROTECTED_FIELDS = ('amount',)

    def _guard(self, request, repayment):
        from apps.approvals.guards import reject_direct_write
        return reject_direct_write(
            request,
            target_model='finance.LoanRepayment',
            target_id=repayment.id,
            action_type='loan_repayment.correction',
            protected_fields=self.PROTECTED_FIELDS,
        )

    def update(self, request, *args, **kwargs):
        rep = self.get_object()
        guard = self._guard(request, rep)
        if guard is not None:
            return guard
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        rep = self.get_object()
        guard = self._guard(request, rep)
        if guard is not None:
            return guard
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    @db_transaction.atomic
    def sign_receipt(self, request, pk=None):
        """Signe le bordereau d'un remboursement de prêt."""
        repayment = self.get_object()
        if repayment.receipt_pdf:
            return Response(
                {'error': "Ce remboursement a déjà un bordereau signé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sig, err = _validate_signature(request)
        if err:
            return err
        device_info = _extract_device_info(request, request.data.get('device_info'))
        from apps.finance.receipt_service import sign_loan_repayment_receipt
        base_url = request.build_absolute_uri('/').rstrip('/')
        try:
            sign_loan_repayment_receipt(repayment, sig, device_info, base_url)
        except Exception as e:
            return Response(
                {'error': f"Échec génération : {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(LoanRepaymentSerializer(repayment).data)


class TreasuryAccountViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = TreasuryAccount.all_objects.all()
    serializer_class = TreasuryAccountSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['account_type', 'is_active']


class TransactionViewSet(TenantViewMixin, viewsets.ReadOnlyModelViewSet):
    """Transactions en lecture seule (creees par les services)."""
    queryset = Transaction.all_objects.select_related(
        'account', 'session', 'membership', 'tontine_type',
    )
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['account', 'transaction_type', 'is_debit', 'tontine_type']
    ordering_fields = ['created_at', 'amount']


class TontineBalancesView(APIView):
    """
    Vue agrégée des soldes par fonds virtuel (TontineType).
    GET /api/finance/tontine-balances/
    """
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get(self, request):
        association = request.association
        rows = TontineFundService.balances_for_association(association)
        unassigned = TontineFundService.unassigned_balance(association)
        total = sum((r['balance'] for r in rows), unassigned)
        return Response({
            'funds': rows,
            'unassigned': {
                'name': 'Non affecté',
                'balance': unassigned,
            },
            'total': total,
        })


class TontineBalanceDetailView(APIView):
    """
    Historique des transactions d'un fonds virtuel.
    GET /api/finance/tontine-balances/<tontine_type_id>/
    """
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get(self, request, tontine_type_id):
        from apps.tontines.models import TontineType
        try:
            tt = TontineType.all_objects.get(
                id=tontine_type_id, association=request.association,
            )
        except TontineType.DoesNotExist:
            raise NotFound("Type de cotisation introuvable.")

        balance = TontineFundService.balance(tt)
        transactions = Transaction.all_objects.filter(
            association=request.association,
            tontine_type=tt,
        ).select_related('account', 'session', 'membership').order_by('-created_at')[:200]

        return Response({
            'tontine_type': {
                'id': str(tt.id),
                'name': tt.name,
                'slug': tt.slug,
                'currency': tt.currency,
            },
            'balance': balance,
            'transactions': TransactionSerializer(transactions, many=True).data,
        })


class ContributionCorrectionRequestViewSet(TenantViewMixin, viewsets.ReadOnlyModelViewSet):
    """
    Liste et actions d'approbation/rejet/annulation des demandes de correction.
    Le POST de création se fait via `ContributionViewSet.request_correction`.
    """
    queryset = ContributionCorrectionRequest.all_objects.select_related(
        'contribution__membership__user',
        'contribution__tontine_type',
        'requested_by__user',
        'president_approval__user', 'bureau_approval__user',
        'rejected_by__user',
    )
    serializer_class = ContributionCorrectionRequestSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['status', 'contribution']

    def _membership(self, request):
        return getattr(request, 'current_membership', None) or request.user.memberships.filter(
            association=request.association,
        ).first()

    def _check_expiry(self, req):
        """Refuse les actions sur une demande expirée et marque le statut."""
        if correction_service.is_expired(req):
            correction_service.mark_expired(req)
            return Response(
                {'error': "Cette demande a expiré (TTL de 24h dépassé)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    @action(detail=True, methods=['post'])
    @db_transaction.atomic
    def approve(self, request, pk=None):
        """Approuver côté Président OU côté autre membre du bureau.
        Si les 2 sont OK, applique automatiquement le correctif."""
        req = self.get_object()
        if req.status not in ('pending', 'pres_approved', 'bureau_approved'):
            return Response(
                {'error': "Cette demande n'est plus en attente."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        expiry = self._check_expiry(req)
        if expiry: return expiry

        approver = self._membership(request)
        if not approver:
            return Response({'error': "Membership introuvable."}, status=403)
        if approver.id == req.requested_by_id:
            return Response(
                {'error': "Vous ne pouvez pas approuver votre propre demande."},
                status=status.HTTP_403_FORBIDDEN,
            )

        is_pres = correction_service.is_president(approver)
        is_other = correction_service.is_non_president_bureau(approver)

        if is_pres:
            if req.president_approval_id is not None:
                return Response({'error': "Déjà approuvé côté Président."}, status=400)
            req.president_approval = approver
            req.president_approval_at = timezone.now()
        elif is_other:
            if req.bureau_approval_id is not None:
                return Response({'error': "Déjà approuvé côté Bureau."}, status=400)
            if req.president_approval_id == approver.id:
                return Response({'error': "Vous avez déjà approuvé côté Président."}, status=400)
            req.bureau_approval = approver
            req.bureau_approval_at = timezone.now()
        else:
            return Response(
                {'error': "Vous n'avez pas l'autorité pour approuver."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Mettre à jour le statut intermédiaire
        if req.president_approval_id and req.bureau_approval_id:
            req.save(update_fields=[
                'president_approval', 'president_approval_at',
                'bureau_approval', 'bureau_approval_at', 'updated_at',
            ])
            correction_service.apply_correction(req, applied_by=approver)
        else:
            req.status = 'pres_approved' if req.president_approval_id else 'bureau_approved'
            req.save(update_fields=[
                'president_approval', 'president_approval_at',
                'bureau_approval', 'bureau_approval_at',
                'status', 'updated_at',
            ])

        return Response(ContributionCorrectionRequestSerializer(req).data)

    @action(detail=True, methods=['post'])
    @db_transaction.atomic
    def reject(self, request, pk=None):
        """Rejet par n'importe lequel des approbateurs (président ou bureau)."""
        req = self.get_object()
        if req.status not in ('pending', 'pres_approved', 'bureau_approved'):
            return Response({'error': "Cette demande n'est plus en attente."}, status=400)
        expiry = self._check_expiry(req)
        if expiry: return expiry

        approver = self._membership(request)
        if not approver or approver.id == req.requested_by_id:
            return Response({'error': "Action non autorisée."}, status=403)
        if not (correction_service.is_president(approver) or correction_service.is_non_president_bureau(approver)):
            return Response({'error': "Vous n'avez pas l'autorité pour rejeter."}, status=403)

        reason = (request.data.get('rejection_reason') or '').strip()
        if len(reason) < 5:
            return Response({'error': "Le motif de rejet doit faire au moins 5 caractères."}, status=400)

        req.status = 'rejected'
        req.rejected_by = approver
        req.rejection_reason = reason
        req.save(update_fields=['status', 'rejected_by', 'rejection_reason', 'updated_at'])
        correction_service.notify_requester_of_decision(req, decision_label="rejetée")
        return Response(ContributionCorrectionRequestSerializer(req).data)

    @action(detail=True, methods=['post'])
    @db_transaction.atomic
    def cancel(self, request, pk=None):
        """Annulation par le requérant tant qu'aucune décision finale n'est prise."""
        req = self.get_object()
        if req.status not in ('pending', 'pres_approved', 'bureau_approved'):
            return Response({'error': "Cette demande n'est plus annulable."}, status=400)

        member = self._membership(request)
        if not member or member.id != req.requested_by_id:
            return Response({'error': "Seul le requérant peut annuler sa demande."}, status=403)

        req.status = 'cancelled'
        req.save(update_fields=['status', 'updated_at'])
        return Response(ContributionCorrectionRequestSerializer(req).data)
