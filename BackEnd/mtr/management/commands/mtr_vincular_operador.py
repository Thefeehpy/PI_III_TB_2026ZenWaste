"""Criação/vínculo pessoais pelo Django; nunca recebe senha como argumento."""
import json
import sys
from getpass import getpass
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand,CommandError
from django.db import IntegrityError
from mtr.sigor.preparacao import exigir_ambiente_mtr05
from mtr.servicos_mvp import ErroMTR
from mtr.vinculacao_individual import conferir_identidades,vincular_sem_permissoes


class Command(BaseCommand):
    help='Cria/confere usuário e vínculo no MTR-05 isolado, sem conceder permissões ambientais.'
    def add_arguments(self,parser):
        for campo in ['email','cnpj','usuario','nome']:parser.add_argument('--'+campo,required=True)
    def handle(self,*args,**options):
        if not sys.stdin.isatty():raise CommandError('Execute pessoalmente em terminal interativo; nenhuma senha por argumento ou pipeline.')
        try:
            exigir_ambiente_mtr05()
            empresa,pessoa=conferir_identidades(options['email'],options['cnpj'],options['usuario'],options['nome'])
            self.stdout.write(f'Empresa #{empresa.pk}; usuário {options["usuario"]}; nome {options["nome"]}. Permissões novas permanecerão falsas.')
            senha=getpass('Senha individual ZenWaste: ')
            if pessoa is None and senha!=getpass('Confirme a senha individual: '):raise CommandError('Senhas diferentes; nada criado.')
            if input('Digite VINCULAR '+options['usuario']+' para confirmar: ')!='VINCULAR '+options['usuario']:
                raise CommandError('Vínculo não confirmado; nada criado.')
            result=vincular_sem_permissoes(options['email'],options['cnpj'],options['usuario'],options['nome'],senha,nova_pessoa_esperada=pessoa is None)
            self.stdout.write(json.dumps(result,ensure_ascii=False))
        except ErroMTR as e:raise CommandError(str(e.detail['message'])) from None
        except ValidationError:raise CommandError('Nome, usuário ou senha não atendem aos validadores nativos; nada criado.') from None
        except IntegrityError:raise CommandError('Cadastro concorrente identificado; inspecione novamente sem duplicar ou restaurar registros.') from None
