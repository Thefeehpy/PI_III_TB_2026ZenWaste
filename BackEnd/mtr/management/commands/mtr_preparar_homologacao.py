"""Inspeção consultiva no Django já configurado. Não cria empresa, poderes ou concessão."""
import json
from django.core.management.base import BaseCommand,CommandError
from django.db import connection
from mtr.sigor.preparacao import carregar_metadata_runtime,inspecionar,exigir_ambiente_mtr05


class Command(BaseCommand):
    help='Inspeciona cadastro/unidade API10 sem carregar senha, token ou chave e sem escrita.'
    def add_arguments(self,parser):
        parser.add_argument('--email',required=True)
        parser.add_argument('--usuario',default=None)
    def handle(self,*args,**options):
        if connection.vendor!='postgresql':raise CommandError('PostgreSQL isolado exigido.')
        banco,porta,system_id=exigir_ambiente_mtr05()
        carregar_metadata_runtime()
        result=inspecionar(options['email'],options['usuario']);result['database']=banco;result['porta']=porta;result['system_id']=system_id
        self.stdout.write(json.dumps(result,ensure_ascii=False))
