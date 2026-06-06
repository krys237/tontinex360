from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, NotFound
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.cycles.models import (
    Cycle, CycleTontineConfig, Session, SessionAttendance,
    SessionPot, BeneficiaryPayout, AuctionBid,
    SessionReport, SessionReportAttachment,
)
from apps.cycles.serializers import (
    CycleSerializer, CycleTontineConfigSerializer,
    SessionSerializer, SessionAttendanceSerializer,
    SessionPotSerializer, BeneficiaryPayoutSerializer,
    AuctionBidSerializer, OpenPotSerializer,
    DistributeSerializer, ProcessAuctionSerializer,
    SessionReportSerializer, SessionReportCreateSerializer,
    SessionReportAttachmentSerializer,
)
from apps.cycles.services import (
    PotDistributionService, SessionReportService, get_cycle_sessions_stats,
)
from django.db import models, transaction


def _generate_per_cycle_membership_fees(cycle):
    """
    Crée un MembershipFeePayment de fond de membre `per_cycle` pour chaque
    membre actif de l'association au moment de l'activation du cycle.

    No-op si :
    - le fond de membre n'est pas activé dans la config
    - le scope n'est pas 'per_cycle'
    """
    from apps.members import fees_service
    from apps.members.models import Membership, MembershipFeePayment
    from decimal import Decimal

    cfg = fees_service.get_config(cycle.association)
    fund = cfg.get('membership_fund', {})
    if not fund.get('enabled'):
        return {'created': 0, 'skipped': 0, 'reason': 'fund_not_enabled'}
    if fund.get('scope') != 'per_cycle':
        return {'created': 0, 'skipped': 0, 'reason': 'scope_is_lifetime'}
    if Decimal(fund.get('amount', 0)) <= 0:
        return {'created': 0, 'skipped': 0, 'reason': 'zero_amount'}

    active_members = Membership.all_objects.filter(
        association=cycle.association, is_active=True,
    )
    created, skipped = 0, 0
    for m in active_members:
        existing = MembershipFeePayment.all_objects.filter(
            membership=m,
            fee_type=MembershipFeePayment.FeeType.MEMBERSHIP_FUND,
            cycle=cycle,
        ).exists()
        if existing:
            skipped += 1
            continue
        MembershipFeePayment.all_objects.create(
            association=cycle.association,
            membership=m,
            fee_type=MembershipFeePayment.FeeType.MEMBERSHIP_FUND,
            cycle=cycle,
            expected_amount=Decimal(fund['amount']),
            paid_amount=Decimal('0'),
            status=MembershipFeePayment.Status.PENDING,
        )
        created += 1
    return {'created': created, 'skipped': skipped, 'reason': 'ok'}


####################################################################################################################################

class CycleViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Cycle.all_objects.prefetch_related('tontine_configs__tontine_type')
    serializer_class = CycleSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['status']

    # Transitions de statut protégées par triple validation (Tier 4)
    # — uniquement la transition vers `completed` (via cycle.close).
    # Les transitions `draft → active` ou autres ne nécessitent pas d'approbation
    # car la création/activation n'est pas un acte irréversible.
    PROTECTED_TARGET_STATUSES = ('completed',)

    def _guard(self, request, cycle):
        from apps.approvals.guards import reject_direct_write
        body = request.data if hasattr(request, 'data') else {}
        new_status = body.get('status')
        # On ne bloque que si on tente de passer à un statut protégé
        if new_status not in self.PROTECTED_TARGET_STATUSES:
            return None
        return reject_direct_write(
            request,
            target_model='cycles.Cycle',
            target_id=cycle.id,
            action_type='cycle.close',
            protected_fields=('status',),
        )

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        request.tenant = request.association  # Assigner le tenant à partir de l'association
        print("tenant dans create cycle", request.tenant)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        cycle = self.get_object()
        guard = self._guard(request, cycle)
        if guard is not None:
            return guard
        return self._do_update_and_maybe_generate(request, cycle, False, args, kwargs)

    def partial_update(self, request, *args, **kwargs):
        cycle = self.get_object()
        guard = self._guard(request, cycle)
        if guard is not None:
            return guard
        return self._do_update_and_maybe_generate(request, cycle, True, args, kwargs)

    def _do_update_and_maybe_generate(self, request, cycle, partial, args, kwargs):
        """Applique l'update, puis déclenche :
        - la génération des séances si pattern de récurrence + transition
          `draft → active` + jamais générées
        - la création des fonds de membre `per_cycle` pour tous les membres
          actifs si transition `draft → active`
        """
        from apps.cycles.session_generation import generate_sessions_for_cycle

        previous_status = cycle.status
        response = (super().partial_update if partial else super().update)(
            request, *args, **kwargs,
        )

        # Recharge l'objet après update
        cycle.refresh_from_db()
        just_activated = (
            previous_status == Cycle.Status.DRAFT
            and cycle.status == Cycle.Status.ACTIVE
        )

        # 1. Génération des séances (pattern récurrent)
        has_pattern = (
            cycle.recurrence_kind
            and cycle.recurrence_kind != Cycle.RecurrenceKind.NONE
        )
        if just_activated and has_pattern and cycle.sessions_generated_at is None:
            try:
                result = generate_sessions_for_cycle(cycle)
                if hasattr(response, 'data') and isinstance(response.data, dict):
                    response.data['sessions_generation'] = result
            except Exception as e:
                if hasattr(response, 'data') and isinstance(response.data, dict):
                    response.data['sessions_generation_error'] = str(e)

        # 2. Fonds de membre `per_cycle` : créer un FeePayment pour chaque
        # membre actif de l'association à l'activation du cycle
        if just_activated:
            try:
                result = _generate_per_cycle_membership_fees(cycle)
                if hasattr(response, 'data') and isinstance(response.data, dict):
                    response.data['membership_fees_generation'] = result
            except Exception as e:
                if hasattr(response, 'data') and isinstance(response.data, dict):
                    response.data['membership_fees_generation_error'] = str(e)

        return response

    @action(detail=True, methods=['get'], url_path='sessions-stats')
    def sessions_stats(self, request, pk=None):
        """
        Compteur de seances pour le calendrier.

        Renvoie : total, completed, remaining, in_progress, scheduled,
        cancelled, postponed, progress_percentage, next_session, last_session,
        et la liste compacte de toutes les seances.
        """
        cycle = self.get_object()
        return Response(get_cycle_sessions_stats(cycle))

    @action(detail=True, methods=['get'], url_path='preview-dates')
    def preview_dates(self, request, pk=None):
        """Calcule les N prochaines dates de séance selon le pattern de récurrence.
        Ne persiste rien. Query param : `limit` (défaut 12)."""
        from apps.cycles.session_generation import preview_dates
        cycle = self.get_object()
        try:
            limit = int(request.query_params.get('limit', 12))
            limit = max(1, min(limit, 60))
        except ValueError:
            limit = 12
        dates = [d.isoformat() for d in preview_dates(cycle, limit=limit)]
        return Response({'dates': dates, 'count': len(dates)})

    @action(detail=True, methods=['post'], url_path='generate-sessions')
    def generate_sessions(self, request, pk=None):
        """Génère (ou complète) les séances du cycle selon son pattern.
        Idempotent : les séances déjà créées à une date donnée ne sont pas
        dupliquées."""
        from apps.cycles.session_generation import generate_sessions_for_cycle
        cycle = self.get_object()
        result = generate_sessions_for_cycle(cycle)
        return Response(result)


class CycleTontineConfigViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = CycleTontineConfig.all_objects.select_related('tontine_type')
    serializer_class = CycleTontineConfigSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['cycle','tontine_type' ]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)


class SessionViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Session.all_objects.select_related('cycle')
    serializer_class = SessionSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['cycle', 'status', 'date']
    ordering_fields = ['date', 'session_number']

    # Annulation de séance = Tier 4 (triple validation)
    PROTECTED_STATUSES_INBOUND = ('cancelled',)

    def _guard_status(self, request, session):
        from apps.approvals.guards import reject_direct_write
        body = request.data if hasattr(request, 'data') else {}
        if 'status' not in body:
            return None
        if body.get('status') not in self.PROTECTED_STATUSES_INBOUND:
            return None
        return reject_direct_write(
            request,
            target_model='cycles.Session',
            target_id=session.id,
            action_type='session.cancel',
            protected_fields=('status',),
        )

    def update(self, request, *args, **kwargs):
        session = self.get_object()
        guard = self._guard_status(request, session)
        if guard is not None:
            return guard
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        session = self.get_object()
        guard = self._guard_status(request, session)
        if guard is not None:
            return guard
        return super().partial_update(request, *args, **kwargs)


class SessionAttendanceViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = SessionAttendance.all_objects.select_related('membership__user')
    serializer_class = SessionAttendanceSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['session', 'status']


class SessionPotViewSet(TenantViewMixin, viewsets.ReadOnlyModelViewSet):
    queryset = SessionPot.all_objects.select_related(
        'tontine_type', 'session',
    ).prefetch_related('payouts__membership__user')
    serializer_class = SessionPotSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['session', 'tontine_type', 'is_closed', 'effective_method']


class BeneficiaryPayoutViewSet(TenantViewMixin, viewsets.ReadOnlyModelViewSet):
    queryset = BeneficiaryPayout.all_objects.select_related(
        'pot__session', 'pot__tontine_type', 'membership__user',
    )
    serializer_class = BeneficiaryPayoutSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['membership', 'acquisition_method', 'status']

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def sign_receipt(self, request, pk=None):
        """
        Signe le bordereau de réception et génère le PDF.

        Payload :
            {
                "signature": "data:image/png;base64,iVBORw0KGgo...",
                "device_info": { "platform": "...", "ip": "...", "user_agent": "..." }
            }
        """
        payout = self.get_object()
        if payout.receipt_pdf:
            return Response(
                {'error': "Ce versement a déjà un bordereau signé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        signature = request.data.get('signature')
        if not signature or not signature.startswith('data:image/'):
            return Response(
                {'error': "Signature manquante ou invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        device_info = request.data.get('device_info') or {}
        # Capture IP côté serveur
        ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() \
             or request.META.get('REMOTE_ADDR', '')
        device_info.setdefault('ip', ip)
        device_info.setdefault('user_agent', request.META.get('HTTP_USER_AGENT', ''))

        from apps.cycles.receipt_service import attach_receipt_to_payout
        base_url = request.build_absolute_uri('/').rstrip('/')

        try:
            attach_receipt_to_payout(
                payout,
                signature_b64=signature,
                device_info=device_info,
                base_url=base_url,
            )
        except Exception as e:
            return Response(
                {'error': f"Échec génération bordereau : {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            BeneficiaryPayoutSerializer(payout, context={'request': request}).data,
        )


class AuctionBidViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = AuctionBid.all_objects.select_related('membership__user', 'pot')
    serializer_class = AuctionBidSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['pot', 'status']


# ==========================================================================
# RAPPORTS DE SEANCE
# ==========================================================================

def _get_user_bureau_member(association, user, cycle):
    """
    Resout le BureauMember de l'utilisateur connecte pour un cycle donne.
    Retourne None si l'utilisateur n'est pas au bureau.
    """
    from apps.members.models import BureauMember

    return BureauMember.all_objects.filter(
        association=association,
        membership__user=user,
        membership__is_active=True,
        cycle=cycle,
        is_active=True,
    ).select_related('position', 'membership__user').first()


class SessionReportViewSet(TenantViewMixin, viewsets.ModelViewSet):
    """
    Rapports individuels de seance par membre du bureau.

    - GET (list / retrieve) : tous les membres actifs voient les rapports publies.
      L'auteur voit aussi ses brouillons.
    - POST : seul un membre du bureau du cycle de la seance peut creer un rapport.
      Le BureauMember est resolu automatiquement depuis l'utilisateur connecte.
      Param `publish=true` pour publier directement.
    - PATCH/PUT : seul l'auteur peut editer.
    - DELETE : seul l'auteur peut supprimer.
    """
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['session', 'bureau_member', 'is_published']

    def get_queryset(self):
        qs = SessionReport.all_objects.select_related(
            'session', 'bureau_member__position',
            'bureau_member__membership__user',
        ).prefetch_related('attachments')

        association = self.request.association
        qs = qs.filter(session__association=association)

        # Brouillons : visibles uniquement par leur auteur
        user = self.request.user
        qs = qs.filter(
            models.Q(is_published=True)
            | models.Q(bureau_member__membership__user=user)
        )
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return SessionReportCreateSerializer
        return SessionReportSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        session = Session.all_objects.filter(
            id=data['session'].id, association=request.association,
        ).select_related('cycle').first()
        if not session:
            raise NotFound("Seance introuvable.")

        bureau_member = _get_user_bureau_member(
            association=request.association,
            user=request.user,
            cycle=session.cycle,
        )
        if not bureau_member:
            raise PermissionDenied(
                "Seuls les membres du bureau du cycle peuvent rediger un rapport."
            )

        # Un seul rapport par (session, bureau_member)
        if SessionReport.all_objects.filter(
            session=session, bureau_member=bureau_member,
        ).exists():
            return Response(
                {'error': "Vous avez deja un rapport pour cette seance."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        report = SessionReport.objects.create(
            session=session,
            bureau_member=bureau_member,
            title=data.get('title', ''),
            content=data['content'],
        )

        if data.get('publish'):
            SessionReportService.publish(report)

        return Response(
            SessionReportSerializer(report, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def _check_owner(self, report):
        if report.bureau_member.membership.user_id != self.request.user.id:
            raise PermissionDenied(
                "Vous ne pouvez modifier que vos propres rapports."
            )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        report = self.get_object()
        self._check_owner(report)
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        report = self.get_object()
        self._check_owner(report)
        return super().partial_update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        report = self.get_object()
        self._check_owner(report)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def publish(self, request, pk=None):
        """Publie un rapport (notifie tous les membres actifs)."""
        report = self.get_object()
        self._check_owner(report)
        SessionReportService.publish(report)
        return Response(
            SessionReportSerializer(report, context={'request': request}).data,
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def unpublish(self, request, pk=None):
        """Repasse un rapport en brouillon."""
        report = self.get_object()
        self._check_owner(report)
        SessionReportService.unpublish(report)
        return Response(
            SessionReportSerializer(report, context={'request': request}).data,
        )

    @action(
        detail=True,
        methods=['post'],
        url_path='attachments',
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    @transaction.atomic
    def add_attachment(self, request, pk=None):
        """Ajoute une piece jointe (PDF, image) au rapport."""
        report = self.get_object()
        self._check_owner(report)

        serializer = SessionReportAttachmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachment = SessionReportAttachment.objects.create(
            report=report,
            **serializer.validated_data,
        )
        return Response(
            SessionReportAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )


class SessionReportAttachmentViewSet(TenantViewMixin, viewsets.ModelViewSet):
    """Suppression d'une piece jointe par son auteur."""
    queryset = SessionReportAttachment.all_objects.select_related(
        'report__bureau_member__membership__user',
    )
    serializer_class = SessionReportAttachmentSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    http_method_names = ['get', 'delete', 'head', 'options']

    def destroy(self, request, *args, **kwargs):
        attachment = self.get_object()
        if attachment.report.bureau_member.membership.user_id != request.user.id:
            raise PermissionDenied(
                "Vous ne pouvez supprimer que vos propres pieces jointes."
            )
        return super().destroy(request, *args, **kwargs)


# ==========================================================================
# VUES ACTIONS — Distribution de la cagnotte
# ==========================================================================

class OpenPotView(APIView):
    """Ouvrir le pot d'une session (calcul collecte + report)."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def post(self, request, session_id):
        serializer = OpenPotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        from apps.tontines.models import TontineType
        session = Session.all_objects.get(
            id=session_id, association=request.association,
        )
        tontine_type = TontineType.all_objects.get(
            id=d['tontine_type_id'], association=request.association,
        )

        try:
            pot = PotDistributionService.open_pot(
                session=session,
                tontine_type=tontine_type,
                override_method=d.get('override_method'),
                override_reason=d.get('override_reason', ''),
            )
            return Response(SessionPotSerializer(pot).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


def _apply_proxy_to_payout(association, session, principal_membership, tontine_type, payout, explicit_proxy_id=None):
    """
    Si un proxy_id est fourni, on charge la procuration et on l'applique.
    Sinon on cherche automatiquement une procuration approuvée pour ce contexte.
    Met à jour payout.received_by et payout.proxy_record + consume la procuration.
    """
    from apps.proxies.models import Proxy
    from apps.proxies.services import ProxyService

    proxy_obj = None
    if explicit_proxy_id:
        try:
            proxy_obj = Proxy.all_objects.get(
                id=explicit_proxy_id, association=association,
            )
        except Proxy.DoesNotExist:
            raise ValueError("Procuration introuvable.")
        if proxy_obj.session_id != session.id:
            raise ValueError("Cette procuration ne correspond pas à la séance.")
        if proxy_obj.principal_id != principal_membership.id:
            raise ValueError("Cette procuration ne correspond pas au bénéficiaire.")
        if proxy_obj.tontine_type_id and proxy_obj.tontine_type_id != tontine_type.id:
            raise ValueError("Cette procuration ne correspond pas à la tontine.")
        if proxy_obj.status != Proxy.Status.APPROVED:
            raise ValueError("Procuration non approuvée.")
    else:
        proxy_obj = ProxyService.find_active_for_payout(
            association, session, principal_membership, tontine_type,
        )

    if proxy_obj is None:
        return None

    payout.received_by = proxy_obj.proxy
    payout.proxy_record = proxy_obj
    payout.save(update_fields=['received_by', 'proxy_record'])

    ProxyService.consume(proxy_obj, payout)
    return proxy_obj


class DistributeView(APIView):
    """Verser la tontine a un beneficiaire."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def post(self, request, pot_id):
        serializer = DistributeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        from apps.members.models import Membership
        pot = SessionPot.all_objects.get(
            id=pot_id, association=request.association,
        )
        membership = Membership.all_objects.get(
            id=d['membership_id'], association=request.association,
        )

        try:
            payout = PotDistributionService.distribute_to_beneficiary(
                pot=pot,
                membership=membership,
                shares_claimed=d.get('shares_claimed'),
            )
            try:
                _apply_proxy_to_payout(
                    association=request.association,
                    session=pot.session,
                    principal_membership=membership,
                    tontine_type=pot.tontine_type,
                    payout=payout,
                    explicit_proxy_id=d.get('proxy_id'),
                )
            except ValueError as pe:
                return Response({'error': str(pe)}, status=status.HTTP_400_BAD_REQUEST)

            return Response(
                BeneficiaryPayoutSerializer(payout).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProcessAuctionView(APIView):
    """Traiter une enchere gagnee."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def post(self, request, pot_id):
        serializer = ProcessAuctionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        from apps.members.models import Membership
        pot = SessionPot.all_objects.get(
            id=pot_id, association=request.association,
        )
        winner = Membership.all_objects.get(
            id=d['winner_membership_id'], association=request.association,
        )

        try:
            payout = PotDistributionService.process_auction(
                pot=pot,
                winner_membership=winner,
                bid_amount=d['bid_amount'],
            )
            try:
                _apply_proxy_to_payout(
                    association=request.association,
                    session=pot.session,
                    principal_membership=winner,
                    tontine_type=pot.tontine_type,
                    payout=payout,
                    explicit_proxy_id=d.get('proxy_id'),
                )
            except ValueError as pe:
                return Response({'error': str(pe)}, status=status.HTTP_400_BAD_REQUEST)

            return Response(
                BeneficiaryPayoutSerializer(payout).data,
                status=status.HTTP_201_CREATED,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ClosePotView(APIView):
    """Cloturer le pot et reporter le reliquat."""
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def post(self, request, pot_id):
        pot = SessionPot.all_objects.get(
            id=pot_id, association=request.association,
        )
        remainder = PotDistributionService.close_and_carry_over(pot)

        from apps.wallets.services import WalletService
        wallet_results = WalletService.process_pot_closure(pot)

        return Response({
            'remainder': str(remainder),
            'message': f"Pot cloture. {remainder} XAF reportes a la prochaine seance.",
            'wallet_distribution': {
                'auction_premium': bool(wallet_results['auction_premium']),
                'loan_interests_distributed': len(wallet_results['loan_interests']),
                'sanctions_distributed': len(wallet_results['sanctions']),
                'defaults_recorded': len(wallet_results['defaults']),
                'compensation': wallet_results['compensation'],
            },
        })

# class BeneficiaryScheduleViewSet(TenantViewMixin, viewsets.ModelViewSet):
#     queryset = BeneficiarySchedule.all_objects.select_related(
#         'membership__user', 'tontine_type', 'session',
#     )
#     serializer_class = BeneficiaryScheduleSerializer
#     permission_classes = [IsAuthenticated, HasAssociation, IsMember]
#     filterset_fields = ['cycle', 'tontine_type', 'status']
