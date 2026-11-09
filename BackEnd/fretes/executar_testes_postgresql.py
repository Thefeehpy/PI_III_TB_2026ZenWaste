r"""Executa testes em PostgreSQL novo, removido ao final, sem migrar o principal.

Em BackEnd: .\.venv-local\Scripts\python.exe -B -m fretes.executar_testes_postgresql
Rótulos opcionais podem ser passados depois do nome do módulo.
"""

import os
from pathlib import Path
import re
import sys
import uuid
from unittest.mock import patch

from dotenv import load_dotenv
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import parse_dsn


def executar():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
    principal = os.environ.get("ZENWASTE_DB_NAME", "")
    nome = "test_zenwaste_fretes_" + uuid.uuid4().hex[:16]
    if not principal or not re.fullmatch(r"test_zenwaste_fretes_[0-9a-f]{16}", nome) or nome == principal:
        raise RuntimeError("Configuração de isolamento inválida.")
    parametros = {
        "dbname": "postgres", "user": os.environ["ZENWASTE_DB_USER"],
        "password": os.environ["ZENWASTE_DB_PASSWORD"], "host": os.environ["ZENWASTE_DB_HOST"],
        "port": os.environ["ZENWASTE_DB_PORT"], "connect_timeout": 10,
        "application_name": "zenwaste_fretes_testes_descartaveis",
    }
    conectar_original = psycopg2.connect
    contagens = {nome: 0, "postgres": 0, "bloqueadas": 0}

    def conectar_protegido(dsn=None, *argumentos, **opcoes):
        configuracao = parse_dsn(dsn) if dsn else {}
        configuracao.update(opcoes)
        banco = configuracao.get("dbname") or configuracao.get("database")
        if banco not in (nome, "postgres"):
            contagens["bloqueadas"] += 1
            raise RuntimeError("Conexão fora do banco descartável bloqueada.")
        contagens[banco] += 1
        return conectar_original(dsn, *argumentos, **opcoes)

    criado = False
    manutencao = None
    resultado = 1
    try:
        with patch("psycopg2.connect", conectar_protegido):
            manutencao = psycopg2.connect(**parametros)
            manutencao.autocommit = True
            with manutencao.cursor() as cursor:
                cursor.execute("SELECT 1 FROM pg_database WHERE datname=%s", (nome,))
                if cursor.fetchone():
                    raise RuntimeError("O nome descartável já existe; não será reutilizado.")
                cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(nome)))
                criado = True
            # Mudanças apenas no processo: o arquivo privado permanece intocado.
            os.environ["ZENWASTE_DB_NAME"] = nome
            os.environ["DJANGO_SETTINGS_MODULE"] = "app.settings"
            import django
            django.setup()
            from django.conf import settings
            from django.db import connections
            from django.test.runner import DiscoverRunner
            connections["default"].settings_dict["TEST"]["NAME"] = nome
            assert settings.DATABASES["default"]["NAME"] == nome
            rotulos = sys.argv[1:] or ["fretes", "pedidos", "produtos", "anuncios", "comercializacao", "empresas", "acesso", "mercado", "app.test_padronizacao_colunas"]
            resultado = DiscoverRunner(keepdb=True, interactive=False, verbosity=2).run_tests(rotulos)
            connections.close_all()
            print("Conexões bloqueadas fora do escopo:", contagens["bloqueadas"])
    finally:
        # Somente o nome aleatório criado por esta execução é removido.
        if criado and manutencao is not None:
            from django.db import connections
            connections.close_all()
            assert nome != principal and re.fullmatch(r"test_zenwaste_fretes_[0-9a-f]{16}", nome)
            with manutencao.cursor() as cursor:
                cursor.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(nome)))
            print("PostgreSQL descartável removido:", nome)
        if manutencao is not None:
            manutencao.close()
    return resultado


if __name__ == "__main__":
    raise SystemExit(bool(executar()))
