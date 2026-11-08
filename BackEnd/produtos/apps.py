from django.apps import AppConfig


class ConfiguracaoProdutos(AppConfig):
    name = 'produtos'
    def ready(self):
        import produtos.sinais

