"""
Guards à utiliser dans les ViewSets sensibles : bloque les écritures
directes qui devraient passer par le workflow d'approbation.
"""
from rest_framework import status
from rest_framework.response import Response


def reject_direct_write(request, *, target_model, target_id, action_type,
                         protected_fields=None):
    """
    Si la requête tente de modifier un champ protégé, renvoie un 400 qui
    redirige le client vers l'endpoint d'approbation.
    """
    body = request.data if hasattr(request, 'data') else {}
    if not isinstance(body, dict):
        return None
    if protected_fields:
        touched = [f for f in protected_fields if f in body]
        if not touched:
            return None
    return Response(
        {
            'error': (
                f"Modification protégée. Soumettez une demande d'approbation "
                f"(Président + Bureau)."
            ),
            'action_type': action_type,
            'target_model': target_model,
            'target_id': str(target_id),
            'protected_fields_touched': touched if protected_fields else None,
            'use_endpoint': "/api/approvals/request/",
            'help': "POST {action_type, target_id, payload, reason}",
        },
        status=status.HTTP_400_BAD_REQUEST,
    )
