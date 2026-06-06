"""
Tâches Celery pour les notifications automatiques.

Planifiées via celery-beat (voir config/celery.py).
Chaque tâche itère sur TOUTES les associations actives
et envoie les rappels pertinents.
"""
import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from django.db.models import Q, Sum

logger = logging.getLogger(__name__)


# =============================================================================
# RAPPELS DE SÉANCES
# =============================================================================

@shared_task(name='apps.notifications.tasks.send_session_reminders')
def send_session_reminders(hours_before=24):
    """
    Envoie un rappel aux membres pour les séances à venir.

    Appelé par celery-beat :
    - Chaque jour à 8h pour les rappels 24h
    - Toutes les 30 min pour les rappels 2h

    Logique :
    - Cherche les sessions programmées dans les N prochaines heures
    - Notifie tous les membres actifs de l'association
    - Marque la session comme "rappel envoyé" pour éviter les doublons
    """
    from apps.cycles.models import Session
    from apps.members.models import Membership
    from apps.notifications.services import NotificationService

    now = timezone.now()
    target_start = now
    target_end = now + timedelta(hours=hours_before + 1)

    # Sessions programmées dans la fenêtre
    sessions = Session.all_objects.filter(
        status='scheduled',
        date__gte=target_start.date(),
        date__lte=target_end.date(),
    ).select_related('cycle', 'association')

    sent_count = 0

    for session in sessions:
        # Construire le datetime de la séance
        if session.start_time:
            from datetime import datetime, date
            session_datetime = timezone.make_aware(
                datetime.combine(session.date, session.start_time)
            )
        else:
            from datetime import datetime, time
            session_datetime = timezone.make_aware(
                datetime.combine(session.date, time(hour=14))  # 14h par défaut
            )

        # Vérifier que c'est dans la bonne fenêtre
        time_until = session_datetime - now
        hours_until = time_until.total_seconds() / 3600

        if not (hours_before - 1 <= hours_until <= hours_before + 1):
            continue

        # Éviter les doublons via le JSON notes
        reminder_key = f'reminder_{hours_before}h_sent'
        if session.notes and reminder_key in session.notes:
            continue

        # Notifier tous les membres actifs
        members = Membership.all_objects.filter(
            association=session.association,
            is_active=True,
        )

        time_label = f"{int(hours_until)} heures" if hours_until > 1 else "bientôt"
        location_info = f" à {session.location}" if session.location else ""

        for member in members:
            try:
                NotificationService.notify(
                    association=session.association,
                    recipient=member,
                    notification_type='session_reminder',
                    title=f"Rappel — Séance {session.session_number}",
                    body=(
                        f"La séance {session.session_number} est dans {time_label}"
                        f"{location_info}. "
                        f"Date : {session.date.strftime('%d/%m/%Y')}"
                        f"{f' à {session.start_time.strftime('%Hh%M')}' if session.start_time else ''}."
                    ),
                    data={
                        'session_id': str(session.id),
                        'cycle_id': str(session.cycle_id),
                        'date': str(session.date),
                        'hours_before': hours_before,
                    },
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Erreur rappel séance {session.id} -> {member.id}: {e}")

        # Marquer comme envoyé
        notes = session.notes or ''
        session.notes = f"{notes}\n{reminder_key}={now.isoformat()}"
        session.save(update_fields=['notes'])

    logger.info(f"Rappels séances ({hours_before}h): {sent_count} envoyés")
    return {'sent': sent_count, 'hours_before': hours_before}


# =============================================================================
# RAPPELS DE REMBOURSEMENT
# =============================================================================

@shared_task(name='apps.notifications.tasks.send_loan_reminders')
def send_loan_reminders(days_before=3):
    """
    Rappel de remboursement de prêt avant l'échéance.

    - 3 jours avant : rappel amical
    - Le jour J : rappel urgent
    """
    from apps.finance.models import Loan
    from apps.notifications.services import NotificationService

    today = timezone.now().date()
    target_date = today + timedelta(days=days_before)

    # Prêts avec échéance = target_date, pas encore remboursés
    loans = Loan.all_objects.filter(
        due_date=target_date,
        status__in=['approved', 'disbursed', 'repaying'],
    ).select_related('membership__user', 'association')

    sent_count = 0

    for loan in loans:
        remaining = loan.total_due - loan.total_repaid

        if remaining <= 0:
            continue

        if days_before == 0:
            title = "Remboursement dû aujourd'hui"
            notif_type = 'loan_due'
        else:
            title = f"Remboursement dans {days_before} jours"
            notif_type = 'loan_due'

        try:
            NotificationService.notify(
                association=loan.association,
                recipient=loan.membership,
                notification_type=notif_type,
                title=title,
                body=(
                    f"Votre prêt de {loan.amount} XAF a un solde de "
                    f"{remaining} XAF à rembourser. "
                    f"Échéance : {loan.due_date.strftime('%d/%m/%Y')}."
                ),
                data={
                    'loan_id': str(loan.id),
                    'amount_remaining': str(remaining),
                    'due_date': str(loan.due_date),
                },
            )
            sent_count += 1
        except Exception as e:
            logger.error(f"Erreur rappel prêt {loan.id}: {e}")

    logger.info(f"Rappels prêts ({days_before}j avant): {sent_count} envoyés")
    return {'sent': sent_count, 'days_before': days_before}


@shared_task(name='apps.notifications.tasks.check_overdue_loans')
def check_overdue_loans():
    """
    Détecte les prêts en retard et notifie le membre + le bureau.
    Change le statut du prêt en 'defaulted' si retard > 7 jours.
    """
    from apps.finance.models import Loan
    from apps.notifications.services import NotificationService

    today = timezone.now().date()

    overdue_loans = Loan.all_objects.filter(
        due_date__lt=today,
        status__in=['approved', 'disbursed', 'repaying'],
    ).select_related('membership__user', 'association')

    notified = 0
    defaulted = 0

    for loan in overdue_loans:
        remaining = loan.total_due - loan.total_repaid
        if remaining <= 0:
            continue

        days_overdue = (today - loan.due_date).days

        # Notifier le membre
        try:
            NotificationService.notify(
                association=loan.association,
                recipient=loan.membership,
                notification_type='loan_overdue',
                title=f"Prêt en retard ({days_overdue} jours)",
                body=(
                    f"Votre prêt de {loan.amount} XAF est en retard de "
                    f"{days_overdue} jours. Solde restant : {remaining} XAF. "
                    f"Veuillez régulariser votre situation."
                ),
                data={
                    'loan_id': str(loan.id),
                    'days_overdue': days_overdue,
                    'amount_remaining': str(remaining),
                },
            )
            notified += 1
        except Exception as e:
            logger.error(f"Erreur notif retard {loan.id}: {e}")

        # Notifier le bureau
        try:
            NotificationService.notify_bureau(
                association=loan.association,
                notification_type='loan_overdue',
                title=f"Prêt en retard — {loan.membership.user.first_name}",
                body=(
                    f"{loan.membership.user.first_name} {loan.membership.user.last_name} "
                    f"a un prêt en retard de {days_overdue} jours. "
                    f"Montant restant : {remaining} XAF."
                ),
                data={'loan_id': str(loan.id)},
            )
        except Exception:
            pass

        # Passer en défaut après 7 jours
        if days_overdue > 7 and loan.status != 'defaulted':
            loan.status = 'defaulted'
            loan.save(update_fields=['status'])
            defaulted += 1

    logger.info(f"Prêts en retard: {notified} notifiés, {defaulted} en défaut")
    return {'notified': notified, 'defaulted': defaulted}


# =============================================================================
# RAPPELS DE COTISATION
# =============================================================================

@shared_task(name='apps.notifications.tasks.send_contribution_reminders')
def send_contribution_reminders():
    """
    Rappelle les cotisations impayées après une séance.
    Vérifie les contributions en status 'pending' ou 'defaulted'
    pour les sessions terminées.
    """
    from apps.finance.models import Contribution
    from apps.notifications.services import NotificationService
    from django.conf import settings

    grace_hours = getattr(settings, 'NOTIFICATION_SETTINGS', {}).get(
        'CONTRIBUTION_GRACE_HOURS', 48
    )
    cutoff = timezone.now() - timedelta(hours=grace_hours)

    unpaid = Contribution.all_objects.filter(
        status__in=['pending', 'defaulted'],
        session__status='completed',
        session__date__lte=cutoff.date(),
    ).select_related(
        'membership__user', 'tontine_type', 'session', 'association'
    )

    sent_count = 0

    for contrib in unpaid:
        outstanding = contrib.expected_amount - contrib.paid_amount

        if outstanding <= 0:
            continue

        try:
            NotificationService.notify(
                association=contrib.association,
                recipient=contrib.membership,
                notification_type='contribution_due',
                title=f"Cotisation impayée — {contrib.tontine_type.name}",
                body=(
                    f"Votre cotisation de la séance {contrib.session.session_number} "
                    f"({contrib.tontine_type.name}) n'est pas encore réglée. "
                    f"Montant dû : {outstanding} XAF."
                ),
                data={
                    'contribution_id': str(contrib.id),
                    'session_id': str(contrib.session_id),
                    'amount_due': str(outstanding),
                },
            )
            sent_count += 1
        except Exception as e:
            logger.error(f"Erreur rappel cotisation {contrib.id}: {e}")

    logger.info(f"Rappels cotisations impayées: {sent_count} envoyés")
    return {'sent': sent_count}


# =============================================================================
# RAPPELS ABONNEMENT
# =============================================================================

@shared_task(name='apps.notifications.tasks.check_expiring_trials')
def check_expiring_trials():
    """
    Alerte les associations dont le trial expire dans N jours.
    Notifie le fondateur/président.
    """
    from apps.subscriptions.models import Subscription
    from apps.members.models import BureauMember
    from apps.notifications.services import NotificationService
    from django.conf import settings

    warning_days = getattr(settings, 'NOTIFICATION_SETTINGS', {}).get(
        'TRIAL_EXPIRY_WARNING_DAYS', 3
    )

    now = timezone.now()
    expiry_window_start = now
    expiry_window_end = now + timedelta(days=warning_days + 1)

    expiring = Subscription.objects.filter(
        status='trialing',
        trial_end__gte=expiry_window_start,
        trial_end__lte=expiry_window_end,
    ).select_related('association', 'plan')

    sent_count = 0

    for sub in expiring:
        days_left = (sub.trial_end - now).days

        # Notifier le président ou le fondateur
        president = BureauMember.all_objects.filter(
            association=sub.association,
            position__slug='president',
            is_active=True,
        ).select_related('membership').first()

        if not president:
            continue

        try:
            NotificationService.notify(
                association=sub.association,
                recipient=president.membership,
                notification_type='trial_expiring',
                title=f"Votre essai expire dans {days_left} jour(s)",
                body=(
                    f"La période d'essai de {sub.association.name} expire le "
                    f"{sub.trial_end.strftime('%d/%m/%Y')}. "
                    f"Passez au plan {sub.plan.name} pour continuer à utiliser "
                    f"toutes les fonctionnalités."
                ),
                data={
                    'subscription_id': str(sub.id),
                    'days_left': days_left,
                    'plan_name': sub.plan.name,
                },
            )
            sent_count += 1
        except Exception as e:
            logger.error(f"Erreur rappel trial {sub.id}: {e}")

    logger.info(f"Rappels trial expirant: {sent_count} envoyés")
    return {'sent': sent_count}


# =============================================================================
# RAPPEL PENDANT LA SÉANCE
# =============================================================================

@shared_task(name='apps.notifications.tasks.send_session_live_reminders')
def send_session_live_reminders(session_id):
    """
    Rappels envoyés PENDANT une séance (déclenchés manuellement
    quand le secrétaire ouvre la session).

    Rappelle aux membres absents de venir ou de se faire représenter.
    Rappelle aux membres avec prêts en cours de préparer leur remboursement.
    """
    from apps.cycles.models import Session, SessionAttendance
    from apps.finance.models import Loan
    from apps.members.models import Membership
    from apps.notifications.services import NotificationService

    try:
        session = Session.all_objects.get(id=session_id)
    except Session.DoesNotExist:
        return {'error': 'Session not found'}

    # Membres qui n'ont pas encore de présence enregistrée
    all_members = Membership.all_objects.filter(
        association=session.association, is_active=True,
    )
    present_ids = SessionAttendance.all_objects.filter(
        session=session,
        status__in=['present', 'late', 'represented'],
    ).values_list('membership_id', flat=True)

    absent_members = all_members.exclude(id__in=present_ids)
    sent_count = 0

    for member in absent_members:
        try:
            NotificationService.notify(
                association=session.association,
                recipient=member,
                notification_type='session_reminder',
                title="Séance en cours — vous êtes absent(e)",
                body=(
                    f"La séance {session.session_number} est en cours. "
                    f"Rejoignez-nous ou faites-vous représenter."
                ),
                data={'session_id': str(session.id)},
                channels=['in_app', 'whatsapp'],
            )
            sent_count += 1
        except Exception:
            pass

    # Rappel remboursement pour les membres avec prêts en cours
    loans_due = Loan.all_objects.filter(
        association=session.association,
        status__in=['disbursed', 'repaying'],
    ).select_related('membership')

    for loan in loans_due:
        remaining = loan.total_due - loan.total_repaid
        if remaining <= 0:
            continue
        try:
            NotificationService.notify(
                association=session.association,
                recipient=loan.membership,
                notification_type='loan_due',
                title="Remboursement attendu — séance en cours",
                body=(
                    f"Pensez à votre remboursement de prêt. "
                    f"Solde restant : {remaining} XAF."
                ),
                data={
                    'loan_id': str(loan.id),
                    'session_id': str(session.id),
                    'amount_remaining': str(remaining),
                },
                channels=['in_app'],
            )
        except Exception:
            pass

    logger.info(f"Rappels live séance {session_id}: {sent_count} absents notifiés")
    return {'absent_notified': sent_count}
