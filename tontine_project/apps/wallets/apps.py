from django.apps import AppConfig


class WalletsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.wallets'
    verbose_name = 'Portefeuilles virtuels'

    def ready(self):
        from apps.wallets import signals  # noqa: F401
