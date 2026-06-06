from django.apps import AppConfig


class ApprovalsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.approvals'
    verbose_name = "Approbations à double validation"

    def ready(self):
        # Importe les handlers pour les enregistrer dans le registry au boot
        from apps.approvals import handlers  # noqa: F401
