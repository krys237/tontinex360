from django.db import transaction
from django.utils import timezone

from apps.proxies.models import Proxy


def _get_proxy_settings(association) -> dict:
    settings = (association.settings or {}).get('proxy', {})
    return {
        'require_document': settings.get('require_document', False),
        'require_approval': settings.get('require_approval', True),
    }


class ProxyService:
    """Logique métier des procurations."""

    @staticmethod
    @transaction.atomic
    def approve(proxy: Proxy, reviewer, note: str = '') -> Proxy:
        if proxy.status != Proxy.Status.PENDING:
            raise ValueError("Seule une procuration en attente peut être approuvée.")
        proxy.status = Proxy.Status.APPROVED
        proxy.approved_by = reviewer
        proxy.approved_at = timezone.now()
        proxy.review_note = note
        proxy.save()

        # Auto-update SessionAttendance du principal en REPRESENTED
        from apps.cycles.models import SessionAttendance
        att, _ = SessionAttendance.all_objects.update_or_create(
            association=proxy.association,
            session=proxy.session,
            membership=proxy.principal,
            defaults={
                'status': SessionAttendance.AttendanceStatus.REPRESENTED,
                'represented_by': proxy.proxy,
            },
        )
        return proxy

    @staticmethod
    @transaction.atomic
    def auto_approve_if_configured(proxy: Proxy) -> Proxy:
        cfg = _get_proxy_settings(proxy.association)
        if cfg['require_approval']:
            return proxy
        # auto-approbation : reviewer = principal
        return ProxyService.approve(proxy, reviewer=proxy.principal, note="Auto-approuvée (config association).")

    @staticmethod
    @transaction.atomic
    def reject(proxy: Proxy, reviewer, note: str = '') -> Proxy:
        if proxy.status != Proxy.Status.PENDING:
            raise ValueError("Seule une procuration en attente peut être rejetée.")
        proxy.status = Proxy.Status.REJECTED
        proxy.approved_by = reviewer
        proxy.approved_at = timezone.now()
        proxy.review_note = note
        proxy.save()
        return proxy

    @staticmethod
    @transaction.atomic
    def cancel(proxy: Proxy, by_membership) -> Proxy:
        if proxy.principal_id != by_membership.id:
            raise PermissionError("Seul le principal peut annuler sa procuration.")
        if proxy.status not in (Proxy.Status.PENDING, Proxy.Status.APPROVED):
            raise ValueError("Cette procuration ne peut plus être annulée.")
        proxy.status = Proxy.Status.CANCELLED
        proxy.save()
        return proxy

    @staticmethod
    @transaction.atomic
    def consume(proxy: Proxy, payout) -> Proxy:
        """
        Marque la procuration comme utilisée et la lie au BeneficiaryPayout.
        Appelée par le service de distribution lorsqu'un payout est créé.
        """
        if proxy.status != Proxy.Status.APPROVED:
            raise ValueError("Procuration non approuvée — consommation impossible.")
        proxy.status = Proxy.Status.USED
        proxy.used_at = timezone.now()
        proxy.resulting_payout = payout
        proxy.save()
        return proxy

    @staticmethod
    def find_active_for_payout(association, session, principal_membership, tontine_type) -> Proxy:
        """
        Trouve une procuration approuvée valide pour ce contexte.
        - Match exact tontine_type prioritaire
        - Sinon match avec tontine_type=None (procuration globale séance)
        Renvoie None si rien trouvé.
        """
        qs = Proxy.all_objects.filter(
            association=association,
            session=session,
            principal=principal_membership,
            status=Proxy.Status.APPROVED,
        )
        match = qs.filter(tontine_type=tontine_type).first()
        if match:
            return match
        return qs.filter(tontine_type__isnull=True).first()

    @staticmethod
    @transaction.atomic
    def expire_unused_after_session(session) -> int:
        """Passe les procurations APPROVED non utilisées en EXPIRED quand la séance est terminée."""
        return Proxy.all_objects.filter(
            session=session,
            status=Proxy.Status.APPROVED,
        ).update(status=Proxy.Status.EXPIRED)
