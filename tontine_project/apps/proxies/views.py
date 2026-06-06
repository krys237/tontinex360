from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction

from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.proxies.models import Proxy
from apps.proxies.serializers import (
    ProxyCreateSerializer, ProxySerializer, ProxyReviewSerializer,
)
from apps.proxies.services import ProxyService


def _current_membership(request):
    from apps.members.models import Membership
    return Membership.all_objects.filter(
        association=request.association, user=request.user, is_active=True,
    ).first()


def _bureau_membership(request, required_perm=None):
    from apps.members.views import _user_has_bureau_authority
    return _user_has_bureau_authority(
        request.user, request.association, required_perm=required_perm,
    )


class ProxyViewSet(viewsets.ModelViewSet):
    """
    Procurations entre membres pour la collecte d'une tontine à une séance.

    - create : un membre actif délègue à un autre membre.
    - list / retrieve : un membre voit ses procurations (données ou reçues) ;
      le bureau voit toutes celles de l'association.
    - approve / reject : bureau (ou auto-approuvée si config le prévoit).
    - cancel : le principal annule sa propre procuration tant que non utilisée.
    """
    queryset = Proxy.all_objects.select_related(
        'principal__user', 'proxy__user', 'session', 'tontine_type',
        'approved_by__user',
    )
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get_serializer_class(self):
        if self.action == 'create':
            return ProxyCreateSerializer
        if self.action in ('approve', 'reject'):
            return ProxyReviewSerializer
        return ProxySerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['principal'] = _current_membership(self.request)
        return ctx

    def get_queryset(self):
        association = getattr(self.request, 'association', None)
        if not association:
            return self.queryset.none()

        qs = self.queryset.filter(association=association)

        membership = _current_membership(self.request)
        if not membership:
            return qs.none()

        # Bureau voit tout, autres voient les leurs (données ou reçues)
        if _bureau_membership(self.request, required_perm='proxies.view_all'):
            pass
        else:
            from django.db.models import Q
            qs = qs.filter(Q(principal=membership) | Q(proxy=membership))

        for param in ('status', 'session', 'principal', 'proxy', 'tontine_type'):
            value = self.request.query_params.get(param)
            if value:
                qs = qs.filter(**{f'{param}': value})

        return qs

    def create(self, request, *args, **kwargs):
        principal = _current_membership(request)
        if not principal:
            raise PermissionDenied("Vous devez être membre actif.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        proxy_obj = Proxy.all_objects.create(
            association=request.association,
            principal=principal,
            **serializer.validated_data,
        )

        # Auto-approbation si configurée
        ProxyService.auto_approve_if_configured(proxy_obj)

        return Response(
            ProxySerializer(proxy_obj).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve(self, request, pk=None):
        proxy = self.get_object()
        reviewer = _bureau_membership(request, required_perm='proxies.approve')
        if reviewer is None:
            raise PermissionDenied("Réservé au bureau.")
        s = ProxyReviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            ProxyService.approve(proxy, reviewer, note=s.validated_data.get('review_note', ''))
        except ValueError as e:
            raise ValidationError(str(e))
        return Response(ProxySerializer(proxy).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def reject(self, request, pk=None):
        proxy = self.get_object()
        reviewer = _bureau_membership(request, required_perm='proxies.approve')
        if reviewer is None:
            raise PermissionDenied("Réservé au bureau.")
        s = ProxyReviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            ProxyService.reject(proxy, reviewer, note=s.validated_data.get('review_note', ''))
        except ValueError as e:
            raise ValidationError(str(e))
        return Response(ProxySerializer(proxy).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancel(self, request, pk=None):
        proxy = self.get_object()
        membership = _current_membership(request)
        if not membership:
            raise PermissionDenied("Vous n'êtes pas membre.")
        try:
            ProxyService.cancel(proxy, membership)
        except PermissionError as e:
            raise PermissionDenied(str(e))
        except ValueError as e:
            raise ValidationError(str(e))
        return Response(ProxySerializer(proxy).data)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Liste des procurations approuvées valides pour une séance/tontine donnée."""
        if _bureau_membership(request, required_perm='proxies.view_all') is None:
            raise PermissionDenied("Réservé au bureau.")

        session_id = request.query_params.get('session')
        tontine_id = request.query_params.get('tontine_type')
        if not session_id:
            raise ValidationError({'session': "Paramètre requis."})

        qs = Proxy.all_objects.filter(
            association=request.association,
            session_id=session_id,
            status=Proxy.Status.APPROVED,
        )
        if tontine_id:
            from django.db.models import Q
            qs = qs.filter(Q(tontine_type_id=tontine_id) | Q(tontine_type__isnull=True))

        return Response(ProxySerializer(qs, many=True).data)
