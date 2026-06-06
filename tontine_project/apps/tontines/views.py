from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.tontines.models import TontineType, MemberSubscription
from apps.tontines.serializers import TontineTypeSerializer, MemberSubscriptionSerializer


class TontineTypeViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = TontineType.all_objects.all()
    serializer_class = TontineTypeSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['is_active', 'rate_mode', 'has_beneficiary']
    search_fields = ['name', 'description']


class MemberSubscriptionViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = MemberSubscription.all_objects.select_related(
        'membership__user', 'tontine_type', 'cycle',
    )
    serializer_class = MemberSubscriptionSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['cycle', 'tontine_type', 'is_active']

    def _is_bureau(self, membership):
        """Le bureau (président + roles bureau) peut souscrire pour autrui."""
        if not membership:
            return False
        from apps.members.models import MemberRole
        roles = MemberRole.all_objects.filter(
            membership=membership, is_active=True,
        ).select_related('role')
        for mr in roles:
            perms = mr.role.permissions or []
            if '*' in perms or 'members.*' in perms or 'tontines.*' in perms:
                return True
            if getattr(mr.role, 'is_bureau_role', False):
                return True
        return False

    def perform_create(self, serializer):
        """Un membre lambda ne peut souscrire que pour lui-même.
        Le bureau peut souscrire pour autrui (cas où on inscrit un membre
        absent à la session de souscription)."""
        membership = self._get_membership()
        requested = serializer.validated_data.get('membership')
        if requested and requested != membership and not self._is_bureau(membership):
            raise PermissionDenied(
                "Vous ne pouvez souscrire que pour vous-même.",
            )
        serializer.save(association=self.request.association)
