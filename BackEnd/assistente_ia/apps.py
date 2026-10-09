from django.apps import AppConfig


class AssistenteIAConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "assistente_ia"
    verbose_name = "Assistente de IA"

    def ready(self):
        import assistente_ia.signals  # noqa: F401
