from django.apps import AppConfig


class SubscriptionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.subscriptions'
    verbose_name = 'Plans & Abonnements'

    def ready(self):
        from apps.subscriptions import signals  # noqa: F401
