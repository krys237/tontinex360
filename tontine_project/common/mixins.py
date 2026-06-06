class TenantViewMixin:
    """
    Mixin pour les ViewSets DRF tenant-aware.
    Filtre les querysets par association et injecte association_id à la création.

    Usage :
        class RoleViewSet(TenantViewMixin, viewsets.ModelViewSet):
            serializer_class = RoleSerializer
            queryset = Role.all_objects.all()
    """
    def get_queryset(self):
        qs = super().get_queryset()
        association = getattr(self.request, 'association', None)
        if association:
            return qs.filter(association=association)
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(association=self.request.association)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['association'] = getattr(self.request, 'association', None)
        context['membership'] = self._get_membership()
        return context

    def _get_membership(self):
        association = getattr(self.request, 'association', None)
        if not association or not self.request.user.is_authenticated:
            return None
        from apps.members.models import Membership
        return Membership.all_objects.filter(
            association=association, user=self.request.user, is_active=True
        ).first()
