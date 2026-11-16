"""Concessão pessoal e explícita. Nunca envia HTTP e não abre o gate de escrita."""
from datetime import timedelta
from getpass import getpass
import sys
import json
from pathlib import Path
from django.core.management.base import BaseCommand,CommandError
from django.db import transaction
from django.utils import timezone
from mtr.models import SolicitacaoEmissaoSIGOR
from mtr.sigor.autoridade_api10 import AutoridadeHMACAPI10
from mtr.sigor.emissao_controlada import registrar_concessao
from mtr.sigor.preparacao import metadata,pendencias,exigir_ambiente_mtr05
from mtr.servicos_mvp import ErroMTR


class Command(BaseCommand):
    help='Registra somente concessão específica por confirmação pessoal; sem emissão ou habilitação do gate.'
    def add_arguments(self,parser):
        parser.add_argument('--solicitacao',required=True)
        parser.add_argument('--evidencia-aprovacao',required=True)
        parser.add_argument('--minutos',type=int,default=15)
        parser.add_argument('--preparar-liberacao',default=None)
    def handle(self,*args,**options):
        if not sys.stdin.isatty():raise CommandError('A aprovação exige terminal pessoal interativo; não é automática.')
        exigir_ambiente_mtr05()
        if not 1<=options['minutos']<=60:raise CommandError('Use janela explícita de 1 a 60 minutos.')
        from mtr.sigor.preparacao import carregar_metadata_runtime
        carregar_metadata_runtime()
        try:
            with transaction.atomic():
                pedido=SolicitacaoEmissaoSIGOR.objects.select_related('despacho__rascunho__empresa','operador__usuario').get(pk=options['solicitacao'])
                empresa=pedido.despacho.rascunho.empresa;op=pedido.operador
                if pendencias(empresa,metadata(),op):raise CommandError('Vínculo, pessoa ou evidências ainda pendentes.')
                self.stdout.write('Intenção: '+str(pedido.despacho_id)+' | referência: '+pedido.escopo['referencia'])
                self.stdout.write('Snapshot SHA-256: '+pedido.escopo['snapshot_sha256'])
                self.stdout.write('Payload SHA-256: '+pedido.escopo['payload_sha256'])
                self.stdout.write('Responsável individual: '+op.usuario.get_full_name())
                from django.contrib.auth import authenticate
                pessoa=authenticate(username=op.usuario.username,password=getpass('Senha individual ZenWaste (não SIGOR): '))
                if pessoa is None or pessoa.pk!=op.usuario_id:raise CommandError('Identidade individual não confirmada.')
                if getpass('Digite AUTORIZAR '+pedido.escopo['referencia']+' para confirmar pessoalmente: ')!='AUTORIZAR '+pedido.escopo['referencia']:
                    raise CommandError('Não autorizado; nenhum registro criado.')
                agora=timezone.now();escopo={**pedido.escopo,'inicio':agora.isoformat(),'fim':(agora+timedelta(minutes=options['minutos'])).isoformat(),
                    'aprovador':op.usuario.get_full_name(),'evidencia_aprovacao':options['evidencia_aprovacao']}
                autoridade=AutoridadeHMACAPI10()
                c=registrar_concessao(pedido,escopo,autoridade.assinar(escopo),autoridade)
            if options['preparar_liberacao']:
                destino=Path(options['preparar_liberacao'])
                if destino.name!='liberacao-api10.json':raise CommandError('Nome do manifesto deve ser liberacao-api10.json; concessão registrada, gate ainda fechado.')
                with destino.open('x',encoding='utf-8') as arquivo:
                    json.dump({k:escopo[k] for k in ['intencao_id','referencia','snapshot_sha256','payload_sha256']},arquivo)
            self.stdout.write('Concessão registrada: '+str(c.pk)+'. Nenhum HTTP executado. A liberação só será carregada se configurada explicitamente no servidor.')
        except ErroMTR as e:raise CommandError('Preparação/concessão não concluída: '+str(e.detail.get('codigo','BLOQUEADA'))) from None
