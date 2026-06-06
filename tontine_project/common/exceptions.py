class LimitExceededError(Exception):
    """Limite du plan atteinte (membres, tontines, cycles)."""
    pass


class FeatureNotAvailableError(Exception):
    """Fonctionnalité non incluse dans le plan."""
    pass


class InsufficientPermissionError(Exception):
    """Permission insuffisante pour cette action."""
    pass


class InvalidOperationError(Exception):
    """Opération métier invalide (ex: cotiser dans une session clôturée)."""
    pass
