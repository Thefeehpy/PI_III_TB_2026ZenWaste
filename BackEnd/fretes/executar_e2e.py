"""Frontend, Django e PostgreSQL reais; dados sintéticos e banco removido ao final."""
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import time
import unittest
from unittest.mock import patch
import uuid

from dotenv import load_dotenv
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import parse_dsn


def porta_livre():
    with socket.socket() as conexao:
        conexao.bind(("127.0.0.1", 0))
        return conexao.getsockname()[1]


def executar():
    raiz = Path(__file__).resolve().parents[2]
    load_dotenv(raiz / "BackEnd" / ".env", override=False)
    principal = os.environ["ZENWASTE_DB_NAME"]
    nome = "test_zenwaste_fretes_e2e_" + uuid.uuid4().hex[:12]
    assert nome != principal and re.fullmatch(r"test_zenwaste_fretes_e2e_[0-9a-f]{12}", nome)
    pasta = raiz / "test-results" / nome
    pasta.mkdir(parents=True, exist_ok=False)
    parametros = {"dbname": "postgres", "user": os.environ["ZENWASTE_DB_USER"], "password": os.environ["ZENWASTE_DB_PASSWORD"], "host": os.environ["ZENWASTE_DB_HOST"], "port": os.environ["ZENWASTE_DB_PORT"], "connect_timeout": 10}
    original = psycopg2.connect
    def conectar(dsn=None, *argumentos, **opcoes):
        dados = parse_dsn(dsn) if dsn else {}
        dados.update(opcoes)
        if (dados.get("dbname") or dados.get("database")) not in (nome, "postgres"):
            raise RuntimeError("Conexão fora do E2E bloqueada.")
        return original(dsn, *argumentos, **opcoes)
    manutencao = None
    criado = False
    servidor = None
    registro_servidor = None
    try:
        with patch("psycopg2.connect", conectar):
            manutencao = psycopg2.connect(**parametros)
            manutencao.autocommit = True
            with manutencao.cursor() as cursor:
                cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(nome)))
                criado = True
            porta_api, porta_frontend = porta_livre(), porta_livre()
            os.environ.update({
                "ZENWASTE_DB_NAME": nome, "ZENWASTE_E2E_BANCO": nome,
                "ZENWASTE_SECRET_KEY": secrets.token_urlsafe(64), "ZENWASTE_DEBUG": "true",
                "ZENWASTE_E2E_PORTA_API": str(porta_api), "ZENWASTE_E2E_PORTA_FRONTEND": str(porta_frontend),
                "ZENWASTE_E2E_API_URL": f"http://127.0.0.1:{porta_api}/api",
                "VITE_API_URL": f"http://127.0.0.1:{porta_api}/api", "VITE_PAYMENT_MODE": "backend",
                "FRONTEND_URL": f"http://127.0.0.1:{porta_frontend}",
                "ZENWASTE_E2E_RESULTADOS": str(pasta), "DJANGO_SETTINGS_MODULE": "app.settings",
                "ZENWASTE_E2E_SENHA": secrets.token_urlsafe(24),
            })
            import django
            django.setup()
            from django.core.management import call_command
            from django.db import connections
            from fretes.test_integracao import CenarioFretes
            call_command("migrate", interactive=False, verbosity=0)
            class Preparacao(CenarioFretes, unittest.TestCase):
                pass
            preparacao = Preparacao()
            preparacao.setUp()
            identidades = {}
            for papel in ("vendedora", "compradora", "transportadora", "concorrente", "terceira"):
                empresa = getattr(preparacao, papel)
                empresa.definir_senha(os.environ["ZENWASTE_E2E_SENHA"])
                empresa.save(update_fields=["senha"])
                identidades[papel] = {"id": empresa.pk, "email": empresa.email, "nome": empresa.razao_social}
            identidades["pedido"] = {"id": str(preparacao.pedido.pk), "numero": preparacao.pedido.numero}
            os.environ["ZENWASTE_E2E_CENARIO"] = json.dumps(identidades)
            estado_comercial = (preparacao.produto.quantidade, preparacao.pedido.situacao, preparacao.reserva.situacao, preparacao.anuncio.nr_qtd)
            connections.close_all()
            registro_servidor = (pasta / "servidor.log").open("w", encoding="utf-8")
            servidor = subprocess.Popen([sys.executable, "-B", "-m", "fretes.servidor_e2e"], cwd=raiz / "BackEnd", stdout=registro_servidor, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            for _ in range(100):
                if servidor.poll() is not None:
                    raise RuntimeError("O servidor de teste encerrou antes da execução; consulte o log local.")
                try:
                    with socket.create_connection(("127.0.0.1", porta_api), timeout=0.2):
                        break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("O servidor de teste não iniciou no prazo.")
            comando = ["cmd", "/d", "/c", "npx", "playwright", "test", "--config=playwright.fretes.config.ts"] if os.name == "nt" else ["npx", "playwright", "test", "--config=playwright.fretes.config.ts"]
            resultado = subprocess.run(comando, cwd=raiz, timeout=600).returncode
            from django.db.models import Count
            from fretes.models import Frete, DocumentoCTe, DivergenciaFrete, ConfirmacaoEntrega, DemandaTransporte, HistoricoFrete
            from produtos.models import MovimentacaoEstoque
            preparacao.produto.refresh_from_db(); preparacao.pedido.refresh_from_db(); preparacao.reserva.refresh_from_db(); preparacao.anuncio.refresh_from_db()
            assert estado_comercial == (preparacao.produto.quantidade, preparacao.pedido.situacao, preparacao.reserva.situacao, preparacao.anuncio.nr_qtd)
            assert not MovimentacaoEstoque.objects.exists()
            resumo = {
                "resultado_playwright": resultado, "fretes": Frete.objects.count(),
                "documentos": DocumentoCTe.objects.count(), "divergencias": DivergenciaFrete.objects.count(),
                "confirmacoes": ConfirmacaoEntrega.objects.count(), "demandas": DemandaTransporte.objects.count(),
                "eventos_historico": HistoricoFrete.objects.count(),
                "situacoes": list(Frete.objects.values("situacao").annotate(total=Count("id")).order_by("situacao")),
                "estado_comercial_preservado": True,
            }
            (pasta / "persistencia.json").write_text(json.dumps(resumo, indent=2), encoding="utf-8")
            print("Resumo PostgreSQL:", json.dumps(resumo))
            print("Evidências locais:", pasta)
            return resultado
    finally:
        if servidor is not None:
            servidor.terminate()
            try:
                servidor.wait(timeout=10)
            except subprocess.TimeoutExpired:
                servidor.kill(); servidor.wait(timeout=10)
        if registro_servidor is not None:
            registro_servidor.close()
        if criado:
            from django.db import connections
            connections.close_all()
            assert nome != principal and re.fullmatch(r"test_zenwaste_fretes_e2e_[0-9a-f]{12}", nome)
            with manutencao.cursor() as cursor:
                cursor.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(nome)))
            print("Banco E2E removido:", nome)
        if manutencao is not None:
            manutencao.close()


if __name__ == "__main__":
    raise SystemExit(executar())
