from django.apps import AppConfig

class ConfiguracaoAnuncios(AppConfig):
    name = 'anuncios'
    def ready(self):
        import anuncios.sinais

