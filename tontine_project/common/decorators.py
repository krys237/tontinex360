from functools import wraps
from django.http import JsonResponse


def require_member_limit():
    """Décorateur : vérifie que la limite de membres n'est pas atteinte."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            subscription = getattr(request, 'subscription', None)
            if subscription and not subscription.check_member_limit():
                return JsonResponse({
                    'error': 'member_limit_reached',
                    'limit': subscription.plan.max_members,
                }, status=403)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator
