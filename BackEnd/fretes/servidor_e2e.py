"""Servidor exclusivo de E2E, com conexões restritas ao banco descartável."""
import os
import re
from unittest.mock import patch

import psycopg2
from psycopg2.extensions import parse_dsn


def executar():
    nome = os.environ.get("ZENWASTE_E2E_BANCO", "")
    if not re.fullmatch(r"test_zenwaste_fretes_e2e_[0-9a-f]{12}", nome):
        raise RuntimeError("Inicie o servidor pelo executor isolado de E2E.")
    assert os.environ.get("ZENWASTE_DB_NAME") == nome
    original = psycopg2.connect
    def conectar(dsn=None, *argumentos, **opcoes):
        dados = parse_dsn(dsn) if dsn else {}
        dados.update(opcoes)
        if (dados.get("dbname") or dados.get("database")) != nome:
            raise RuntimeError("Conexão fora do banco de E2E bloqueada.")
        return original(dsn, *argumentos, **opcoes)
    os.environ["DJANGO_SETTINGS_MODULE"] = "app.settings"
    with patch("psycopg2.connect", conectar):
        from django.core.management import execute_from_command_line
        execute_from_command_line(["servidor_e2e", "runserver", "--noreload", f"127.0.0.1:{os.environ['ZENWASTE_E2E_PORTA_API']}"])


if __name__ == "__main__":
    executar()
