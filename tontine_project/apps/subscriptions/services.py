"""
Services metier pour les abonnements.

Le flux principal :
  1. A la creation d'une association : Subscription en TRIALING (90 jours), plan Famille.
  2. Pendant le trial : tout est debloque.
  3. Apres le trial : le tier est suggere par `evaluate_subscription_tier` (Mesure 90j).
  4. Le president initie un paiement (`initiate_payment`) puis le confirme
     (`confirm_payment`) -> Subscription passe a ACTIVE.
  5. La tache `auto_renew_subscriptions` cree des paiements de renouvellement
     a J-3 de la fin de periode pour les abonnements `auto_renew=True`.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.subscriptions.models import Payment, Plan, Subscription


def _period_for(billing_cycle):
    """Retourne la duree d'une periode selon le cycle de facturation."""
    if billing_cycle == Subscription.BillingCycle.YEARLY:
        return timedelta(days=365)
    return timedelta(days=30)


def _price_for(plan, billing_cycle):
    if billing_cycle == Subscription.BillingCycle.YEARLY:
        return plan.price_yearly
    return plan.price_monthly


class SubscriptionService:

    @staticmethod
    @transaction.atomic
    def change_plan(subscription, new_plan, billing_cycle):
        """
        Change le plan d'un abonnement (upgrade ou downgrade).

        - Si l'abonnement est en TRIAL : on garde le trial, on change juste le plan.
        - Si l'abonnement est ACTIF : le changement prendra effet a la prochaine
          periode (le paiement deja effectue n'est pas rembourse).
        """
        subscription.plan = new_plan
        subscription.billing_cycle = billing_cycle
        subscription.save(update_fields=['plan', 'billing_cycle', 'updated_at'])
        return subscription

    @staticmethod
    @transaction.atomic
    def initiate_payment(subscription, billing_cycle, payment_method, description=''):
        """Cree un Payment en `pending` pour la prochaine periode."""
        amount = _price_for(subscription.plan, billing_cycle)
        period = _period_for(billing_cycle)
        now = timezone.now()

        # Le point de depart de la prochaine periode :
        #   - si abonnement actif et non expire : a la fin de la periode courante
        #   - sinon : maintenant
        if (
            subscription.current_period_end
            and subscription.current_period_end > now
        ):
            period_start = subscription.current_period_end
        else:
            period_start = now
        period_end = period_start + period

        return Payment.objects.create(
            subscription=subscription,
            amount=amount,
            currency=subscription.plan.currency,
            status=Payment.Status.PENDING,
            payment_method=payment_method,
            description=description or (
                f"Abonnement {subscription.plan.name} ({billing_cycle})"
            ),
            period_start=period_start,
            period_end=period_end,
        )

    @staticmethod
    @transaction.atomic
    def confirm_payment(payment, provider_reference=''):
        """
        Confirme manuellement un paiement.

        L'activation de l'abonnement est faite par le signal post_save
        sur Payment (cf. apps/subscriptions/signals.py).
        """
        if payment.status == Payment.Status.COMPLETED:
            return payment

        payment.status = Payment.Status.COMPLETED
        payment.paid_at = timezone.now()
        if provider_reference:
            payment.provider_reference = provider_reference
        payment.save(update_fields=[
            'status', 'paid_at', 'provider_reference', 'updated_at',
        ])
        return payment

    @staticmethod
    def activate_from_payment(payment):
        """
        Met l'abonnement en ACTIVE et cale `current_period_*` sur le paiement.
        Appele par le signal post_save quand status passe a COMPLETED.
        """
        sub = payment.subscription
        sub.status = Subscription.Status.ACTIVE
        sub.current_period_start = payment.period_start
        sub.current_period_end = payment.period_end
        # Si le paiement couvre une periode plus longue que le trial restant,
        # on garde quand meme le `trial_end` pour traçabilite.
        sub.save(update_fields=[
            'status', 'current_period_start', 'current_period_end', 'updated_at',
        ])
        return sub


# =============================================================================
# MESURE 90 JOURS — determine le tier recommande selon l'activite
# =============================================================================

# Seuils issus de l'arbre de decision metier.
# (cagnotte_mensuelle_min, membres_min, plan_slug)
# Le premier match (en partant du plus eleve) gagne.
TIER_THRESHOLDS = [
    (Decimal('50000000'), 100, 'president'),
    (Decimal('30000000'), 50, 'vip'),
    (Decimal('1000000'), 30, 'pro'),
    (Decimal('250000'), 15, 'quartier'),
    (Decimal('100000'), 10, 'village'),
]
DEFAULT_TIER_SLUG = 'famille'


def measure_activity(association, lookback_days=90):
    """
    Calcule la cagnotte mensuelle moyenne et le nombre de membres actifs
    sur la fenetre `lookback_days` jours.
    """
    from django.db.models import Sum

    from apps.cycles.models import SessionPot

    since = timezone.now() - timedelta(days=lookback_days)

    pots_total = SessionPot.objects.filter(
        session__association=association,
        created_at__gte=since,
    ).aggregate(total=Sum('total_collected'))['total'] or Decimal('0')

    months = max(Decimal(lookback_days) / Decimal('30'), Decimal('1'))
    monthly_cagnotte = pots_total / months

    members_count = association.membership_set.filter(is_active=True).count()

    return {
        'monthly_cagnotte': monthly_cagnotte,
        'members_count': members_count,
        'window_days': lookback_days,
    }


def recommend_plan(monthly_cagnotte, members_count):
    """
    Retourne le slug du plan recommande selon les seuils (le plus contraignant
    des deux criteres gagne).
    """
    for cagnotte_min, members_min, slug in TIER_THRESHOLDS:
        if monthly_cagnotte >= cagnotte_min or members_count > members_min:
            return slug
    return DEFAULT_TIER_SLUG


def get_recommended_plan(association, lookback_days=90):
    """Combine measure_activity + recommend_plan et retourne (Plan, metrics)."""
    metrics = measure_activity(association, lookback_days)
    slug = recommend_plan(metrics['monthly_cagnotte'], metrics['members_count'])
    plan = Plan.objects.get(slug=slug)
    return plan, metrics
