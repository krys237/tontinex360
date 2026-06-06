"""
Registry global des handlers d'approbation.

Chaque handler hérite de `BaseApprovalHandler` et est enregistré via
`@register_handler('action.type')`. Le service générique trouve le bon
handler par `action_type` au moment du request/apply.
"""
_REGISTRY: dict = {}


def register_handler(action_type: str):
    def decorator(cls):
        if action_type in _REGISTRY:
            raise ValueError(f"Handler déjà enregistré pour {action_type}")
        _REGISTRY[action_type] = cls
        cls.action_type = action_type
        return cls
    return decorator


def get_handler(action_type: str):
    handler_cls = _REGISTRY.get(action_type)
    if not handler_cls:
        raise ValueError(f"Aucun handler enregistré pour action_type='{action_type}'")
    return handler_cls()


def list_handlers():
    return dict(_REGISTRY)


class BaseApprovalHandler:
    """
    Contrat des handlers. Chaque sous-classe doit implémenter :
    - target_model_label : "app.Model" (ex: "finance.LoanRepayment")
    - get_target_object(target_id, association) -> instance ou None
    - validate(association, target, payload, requested_by) -> None | raise ValueError
    - snapshot(target) -> dict (état avant pour audit)
    - summary(target, payload) -> str
    - apply(approval_request, applied_by) -> dict (side_effects)

    Si `requires_triple_approval = True`, l'application nécessite 3 approbations
    distinctes : Président + 2 autres membres bureau (Tier 4).

    Convention : tous les changements doivent passer par ce handler ;
    le viewset cible doit refuser les écritures directes équivalentes
    (renvoyer le user vers /api/approvals/request/).
    """
    action_type: str = ""  # défini par @register_handler
    target_model_label: str = ""
    human_label: str = ""  # libellé court pour les notifications
    requires_triple_approval: bool = False

    def get_target_object(self, target_id, association):
        raise NotImplementedError

    def validate(self, association, target, payload, requested_by):
        """Lève ValueError ou DjangoValidationError en cas de payload invalide."""
        return None

    def snapshot(self, target) -> dict:
        return {}

    def summary(self, target, payload) -> str:
        return self.human_label or self.action_type

    def apply(self, approval_request, applied_by) -> dict:
        raise NotImplementedError
