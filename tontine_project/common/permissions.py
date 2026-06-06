from rest_framework.permissions import BasePermission


class IsAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class HasAssociation(BasePermission):
    """Un tenant (association) est sélectionné."""
    def has_permission(self, request, view):
        return getattr(request, 'association', None) is not None


class IsMember(BasePermission):
    """L'utilisateur est membre actif de l'association courante."""
    def has_permission(self, request, view):
        association = getattr(request, 'association', None)
        if not association:
            return False
        from apps.members.models import Membership
        return Membership.all_objects.filter(
            association=association, user=request.user, is_active=True,
        ).exists()


class HasPermission(BasePermission):
    """
    Vérifie une permission spécifique dans les rôles du membre.

    Usage :
        class MyView(APIView):
            permission_classes = [HasPermission]
            required_permission = 'finance.collect'
    """
    def has_permission(self, request, view):
        required = getattr(view, 'required_permission', None)
        if not required:
            return True

        association = getattr(request, 'association', None)
        if not association:
            return False

        from apps.members.models import Membership, MemberRole

        try:
            membership = Membership.all_objects.get(
                association=association, user=request.user, is_active=True
            )
        except Membership.DoesNotExist:
            return False

        roles = MemberRole.all_objects.filter(
            membership=membership, is_active=True
        ).select_related('role')

        for member_role in roles:
            perms = member_role.role.permissions
            if '*' in perms:
                return True
            app = required.split('.')[0]
            if f'{app}.*' in perms or required in perms:
                return True

        return False
