from django.apps import AppConfig

class AnunciosConfig(AppConfig):
    name = 'anuncios'
    def ready(self):
        import anuncios.signals

