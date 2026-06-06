"""
Taches Celery pour la gestion des abonnements.
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# =============================================================================
# EXPIRATION
# =============================================================================

@shared_task(name='apps.subscriptions.tasks.expire_overdue_subscriptions')
def expire_overdue_subscriptions():
    """
    Expire les abonnements dont le trial ou la periode payee est terminee.

    Planifie chaque jour a 00h30 via celery-beat.
    """
    from apps.subscriptions.models import Subscription

    now = timezone.now()
    expired_count = 0

    expired_trials = Subscription.objects.filter(
        status=Subscription.Status.TRIALING,
        trial_end__lt=now,
    ).select_related('association', 'plan')

    for sub in expired_trials:
        sub.status = Subscription.Status.EXPIRED
        sub.save(update_fields=['status', 'updated_at'])
        _notify_trial_ended_with_recommendation(sub)
        expired_count += 1

    expired_paid = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE,
        current_period_end__lt=now,
    ).select_related('association', 'plan')

    for sub in expired_paid:
        sub.status = Subscription.Status.EXPIRED
        sub.save(update_fields=['status', 'updated_at'])
        _notify_expiration(sub, 'paid')
        expired_count += 1

    logger.info("Abonnements expires: %s", expired_count)
    return {'expired': expired_count}


def _get_president_membership(association):
    from apps.members.models import BureauMember

    president = BureauMember.all_objects.filter(
        association=association,
        position__slug='president',
        is_active=True,
    ).select_related('membership').first()
    return president.membership if president else None


def _notify_expiration(subscription, sub_type):
    from apps.notifications.services import NotificationService

    recipient = _get_president_membership(subscription.association)
    if not recipient:
        return

    title = "Abonnement expire"
    body = (
        f"L'abonnement {subscription.plan.name} de "
        f"{subscription.association.name} a expire. Renouvelez pour conserver "
        f"l'acces complet."
    )

    try:
        NotificationService.notify(
            association=subscription.association,
            recipient=recipient,
            notification_type='subscription_expired',
            title=title,
            body=body,
            data={
                'subscription_id': str(subscription.id),
                'plan_name': subscription.plan.name,
                'sub_type': sub_type,
            },
        )
    except Exception as e:
        logger.error("Erreur notification expiration %s: %s", subscription.id, e)


def _notify_trial_ended_with_recommendation(subscription):
    """
    Fin du trial : envoie une notification personnalisee avec le plan recommande
    selon l'activite des 90 derniers jours.
    """
    from apps.notifications.services import NotificationService
    from apps.subscriptions.services import get_recommended_plan

    recipient = _get_president_membership(subscription.association)
    if not recipient:
        return

    try:
        recommended, metrics = get_recommended_plan(subscription.association)
    except Exception as e:
        logger.error("Echec calcul recommandation %s: %s", subscription.id, e)
        # Fallback : notification generique d'expiration
        _notify_expiration(subscription, 'trial')
        return

    title = f"Periode d'essai terminee - Plan recommande : {recommended.name}"
    body = (
        f"La periode d'essai de {subscription.association.name} est terminee. "
        f"Selon votre activite (cagnotte mensuelle : "
        f"{metrics['monthly_cagnotte']:.0f} {recommended.currency}, "
        f"{metrics['members_count']} membres), nous vous recommandons le plan "
        f"{recommended.name} ({recommended.price_monthly:.0f} "
        f"{recommended.currency}/mois). "
        f"Vous pouvez bien sur choisir un autre plan."
    )

    try:
        NotificationService.notify(
            association=subscription.association,
            recipient=recipient,
            notification_type='trial_ended_recommendation',
            title=title,
            body=body,
            data={
                'subscription_id': str(subscription.id),
                'recommended_plan_slug': recommended.slug,
                'recommended_plan_name': recommended.name,
                'recommended_price_monthly': str(recommended.price_monthly),
                'currency': recommended.currency,
                'monthly_cagnotte': str(metrics['monthly_cagnotte']),
                'members_count': metrics['members_count'],
                'window_days': metrics['window_days'],
            },
        )
    except Exception as e:
        logger.error(
            "Erreur notification fin de trial %s: %s", subscription.id, e,
        )


# =============================================================================
# RENOUVELLEMENT AUTO
# =============================================================================

@shared_task(name='apps.subscriptions.tasks.auto_renew_subscriptions')
def auto_renew_subscriptions(days_before=3):
    """
    Cree un Payment `pending` pour les abonnements actifs avec auto_renew=True
    dont la periode courante se termine dans `days_before` jours.

    Le president devra confirmer le paiement (Mobile Money, virement, etc.)
    pour que la subscription soit reconduite. Une fois le hub de paiement
    integre, la confirmation sera automatique via webhook.
    """
    from apps.subscriptions.models import Payment, Subscription
    from apps.subscriptions.services import SubscriptionService

    now = timezone.now()
    deadline = now + timedelta(days=days_before)

    candidates = Subscription.objects.filter(
        status=Subscription.Status.ACTIVE,
        auto_renew=True,
        current_period_end__gte=now,
        current_period_end__lte=deadline,
    ).select_related('association', 'plan')

    created = 0
    for sub in candidates:
        # Eviter le doublon : si un paiement pending existe deja pour la prochaine
        # periode, on n'en cree pas un nouveau.
        if Payment.objects.filter(
            subscription=sub,
            status=Payment.Status.PENDING,
            period_start__gte=sub.current_period_end,
        ).exists():
            continue

        try:
            SubscriptionService.initiate_payment(
                subscription=sub,
                billing_cycle=sub.billing_cycle,
                payment_method=Payment.PaymentMethod.MOBILE_MONEY,
                description=f"Renouvellement automatique - {sub.plan.name}",
            )
            _notify_renewal_pending(sub)
            created += 1
        except Exception as e:
            logger.error("Echec renouvellement %s: %s", sub.id, e)

    logger.info("Paiements de renouvellement crees: %s", created)
    return {'created': created}


def _notify_renewal_pending(subscription):
    from apps.members.models import BureauMember
    from apps.notifications.services import NotificationService

    president = BureauMember.all_objects.filter(
        association=subscription.association,
        position__slug='president',
        is_active=True,
    ).select_related('membership').first()

    if not president:
        return

    try:
        NotificationService.notify(
            association=subscription.association,
            recipient=president.membership,
            notification_type='subscription_renewal_pending',
            title="Renouvellement de votre abonnement",
            body=(
                f"Votre abonnement {subscription.plan.name} arrive a echeance. "
                f"Confirmez le paiement pour continuer."
            ),
            data={'subscription_id': str(subscription.id)},
        )
    except Exception as e:
        logger.error("Erreur notif renouvellement %s: %s", subscription.id, e)


# =============================================================================
# MESURE 90 JOURS — recommandation de tier
# =============================================================================

@shared_task(name='apps.subscriptions.tasks.evaluate_subscription_tier')
def evaluate_subscription_tier(association_id=None):
    """
    Evalue l'activite de la/les association(s) sur les 90 derniers jours et
    notifie le tier recommande si different du tier courant.

    - Si `association_id` est fourni, n'evalue que celle-la (utile a la fin
      du trial via `apply_async(args=[id], eta=trial_end)`).
    - Sinon, evalue tous les abonnements actifs ou en trialing.
    """
    from apps.subscriptions.models import Subscription
    from apps.subscriptions.services import get_recommended_plan

    qs = Subscription.objects.select_related('association', 'plan')
    if association_id:
        qs = qs.filter(association_id=association_id)
    else:
        qs = qs.filter(status__in=[
            Subscription.Status.TRIALING,
            Subscription.Status.ACTIVE,
        ])

    notified = 0
    for sub in qs:
        try:
            recommended, metrics = get_recommended_plan(sub.association)
            if recommended.slug == sub.plan.slug:
                continue
            _notify_tier_recommendation(sub, recommended, metrics)
            notified += 1
        except Exception as e:
            logger.error("Echec evaluation tier %s: %s", sub.id, e)

    logger.info("Recommandations de tier envoyees: %s", notified)
    return {'notified': notified}


def _notify_tier_recommendation(subscription, recommended_plan, metrics):
    from apps.members.models import BureauMember
    from apps.notifications.services import NotificationService

    president = BureauMember.all_objects.filter(
        association=subscription.association,
        position__slug='president',
        is_active=True,
    ).select_related('membership').first()

    if not president:
        return

    try:
        NotificationService.notify(
            association=subscription.association,
            recipient=president.membership,
            notification_type='subscription_tier_recommended',
            title=f"Plan recommande : {recommended_plan.name}",
            body=(
                f"Selon votre activite des 90 derniers jours "
                f"(cagnotte mensuelle : {metrics['monthly_cagnotte']:.0f} "
                f"{recommended_plan.currency}, {metrics['members_count']} membres), "
                f"le plan {recommended_plan.name} "
                f"({recommended_plan.price_monthly:.0f} {recommended_plan.currency}/mois) "
                f"correspond a votre profil."
            ),
            data={
                'subscription_id': str(subscription.id),
                'recommended_plan_slug': recommended_plan.slug,
                'monthly_cagnotte': str(metrics['monthly_cagnotte']),
                'members_count': metrics['members_count'],
            },
        )
    except Exception as e:
        logger.error("Erreur notif recommandation %s: %s", subscription.id, e)
