"""
Configuration Celery pour le projet Tontine.

Usage :
    # Lancer le worker
    celery -A config.celery worker -l info

    # Lancer le beat (tâches planifiées)
    celery -A config.celery beat -l info

    # Lancer les deux en même temps (dev uniquement)
    celery -A config.celery worker -B -l info
"""
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

app = Celery('tontine_project')

# Charger la config depuis settings Django (prefix CELERY_)
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-découverte des tasks dans chaque app
app.autodiscover_tasks()

# =============================================================================
# CELERY BEAT — Tâches planifiées
# =============================================================================

app.conf.beat_schedule = {

    # --- RAPPELS DE SÉANCES ---

    # Rappel 24h avant la séance
    'session-reminder-24h': {
        'task': 'apps.notifications.tasks.send_session_reminders',
        'schedule': crontab(hour=8, minute=0),  # Chaque jour à 8h
        'kwargs': {'hours_before': 24},
    },

    # Rappel 2h avant la séance
    'session-reminder-2h': {
        'task': 'apps.notifications.tasks.send_session_reminders',
        'schedule': crontab(minute='*/30'),  # Toutes les 30 min
        'kwargs': {'hours_before': 2},
    },

    # --- RAPPELS DE REMBOURSEMENT ---

    # Rappel 3 jours avant l'échéance du prêt
    'loan-reminder-3days': {
        'task': 'apps.notifications.tasks.send_loan_reminders',
        'schedule': crontab(hour=9, minute=0),  # Chaque jour à 9h
        'kwargs': {'days_before': 3},
    },

    # Rappel le jour de l'échéance
    'loan-reminder-due-today': {
        'task': 'apps.notifications.tasks.send_loan_reminders',
        'schedule': crontab(hour=8, minute=0),
        'kwargs': {'days_before': 0},
    },

    # Détection des prêts en retard
    'loan-overdue-check': {
        'task': 'apps.notifications.tasks.check_overdue_loans',
        'schedule': crontab(hour=10, minute=0),  # Chaque jour à 10h
    },

    # --- RAPPELS DE COTISATION ---

    # Rappel de cotisation impayée après la séance
    'contribution-unpaid-reminder': {
        'task': 'apps.notifications.tasks.send_contribution_reminders',
        'schedule': crontab(hour=18, minute=0),  # Chaque jour à 18h
    },

    # --- ABONNEMENT ---

    # Vérifier les trials qui expirent dans 3 jours
    'trial-expiring-reminder': {
        'task': 'apps.notifications.tasks.check_expiring_trials',
        'schedule': crontab(hour=9, minute=0),
    },

    # Expirer les abonnements périmés
    'expire-subscriptions': {
        'task': 'apps.subscriptions.tasks.expire_overdue_subscriptions',
        'schedule': crontab(hour=0, minute=30),  # Chaque jour à 00h30
    },

    # Créer les paiements de renouvellement pour les abonnements arrivant à échéance
    'auto-renew-subscriptions': {
        'task': 'apps.subscriptions.tasks.auto_renew_subscriptions',
        'schedule': crontab(hour=2, minute=0),  # Chaque jour à 2h
    },

    # Mesure 90 jours : recommander le bon tier selon l'activité
    'evaluate-subscription-tier': {
        'task': 'apps.subscriptions.tasks.evaluate_subscription_tier',
        'schedule': crontab(hour=3, minute=0, day_of_week=1),  # Chaque lundi à 3h
    },

    # --- INVITATIONS ---

    # Expirer les invitations périmées
    'expire-invitations': {
        'task': 'apps.invitations.tasks.expire_old_invitations',
        'schedule': crontab(hour=1, minute=0),  # Chaque jour à 1h
    },
}
