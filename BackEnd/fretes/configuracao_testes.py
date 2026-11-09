"""Configuração exclusiva para testes de modelagem sem acesso a banco ou .env.

Executar somente SimpleTestCase. Testes transacionais exigem um PostgreSQL
descartável configurado e validado separadamente.
"""

SECRET_KEY = "configuracao-publica-exclusiva-testes-sem-banco"
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "empresas",
    "produtos",
    "anuncios",
    "pedidos",
    "fretes",
]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "testes_modelagem_sem_conexao",
        "USER": "sem_acesso",
        "PASSWORD": "",
        "HOST": "127.0.0.1",
        "PORT": "1",
    },
}
