import logging
from django.core.exceptions import PermissionDenied
from common.managers import set_current_association

logger = logging.getLogger(__name__)


class TenantMiddleware:
    """
    Résout l'association active à partir de :
    1. Header X-Tenant (API)
    2. Query param ?tenant= (debug)
    3. Session (UI web — après sélection)
    """
    HEADER = 'X-Tenant'
    PARAM = 'tenant'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        association = self._resolve_tenant(request)

        if association is None:
            request.association = None
        else:
            if request.user.is_authenticated:
                if not association.members.filter(user=request.user).exists():
                    raise PermissionDenied("Non autorisé")

            request.association = association
            set_current_association(association)

        response = self.get_response(request)

        set_current_association(None)

        return response

    def _resolve_tenant(self, request):
        from apps.core.models import Association

        slug = (
            request.headers.get(self.HEADER, '').strip()
            or request.GET.get(self.PARAM, '').strip()
            or (
                request.session.get('active_association_slug', '')
                if hasattr(request, 'session')
                else ''
            )
        )
        if not slug:
            return None
        try:
            return Association.objects.get(slug=slug, is_active=True)
        except Association.DoesNotExist:
            logger.warning("Tenant introuvable : slug=%s", slug)
            return None


class SubscriptionMiddleware:
    """Vérifie que l'association a un abonnement valide."""
    EXEMPT_PATHS = [
        '/api/auth/',
        '/api/subscriptions/',
        '/api/associations/',
        '/admin/',
        '/api/invitations/accept/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        association = getattr(request, 'association', None)
        if not association:
            return self.get_response(request)
        if any(request.path.startswith(p) for p in self.EXEMPT_PATHS):
            return self.get_response(request)

        subscription = getattr(association, 'subscription', None)
        if subscription and not subscription.is_usable:
            from django.http import JsonResponse
            return JsonResponse({
                'error': 'subscription_expired',
                'message': 'Votre abonnement a expiré. Veuillez renouveler.',
                'plan_status': subscription.status,
            }, status=402)

        request.subscription = subscription
        return self.get_response(request)
