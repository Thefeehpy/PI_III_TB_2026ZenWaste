"""Carregamento offline para gerar/conferir migrations, sem ler .env."""

from fretes.configuracao_testes import *  # noqa: F403

INSTALLED_APPS = [*INSTALLED_APPS, "mtr.apps.ConfiguracaoMTR"]  # noqa: F405
MTR_PROVEDOR = "MOCK"
