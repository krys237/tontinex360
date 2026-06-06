from django.apps import AppConfig


class CyclesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.cycles'
    verbose_name = 'Cycles, Sessions & Bénéficiaires'

    def ready(self):
        # Import des signaux pour créer les sessions par défaut lors de la création d'un cycle
        import apps.cycles.signals
