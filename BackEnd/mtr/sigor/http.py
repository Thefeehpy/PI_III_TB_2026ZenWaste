"""Contratos DRF de preparacao, sem endpoint de escrita governamental habilitado."""
from rest_framework import serializers
from rest_framework.response import Response
from mtr.serializers import ContratoMTR,ComandoVazioMTR
from mtr.views import VisaoMTR
from mtr.models import VinculoAmbientalSIGOR,CapturaCatalogoSIGOR
from mtr.servicos_mvp import ErroMTR
from mtr.sigor import ambiental as a,despacho as d
from mtr.sigor.leitura import Operacao,CAMINHOS,metodo_http
from mtr.sigor.privacidade import ErroSeguro

class EntradaVinculo(ContratoMTR):
    papel=serializers.ChoiceField(choices=a.PAPEIS)
    cpf_cnpj=serializers.CharField(max_length=18,trim_whitespace=False)
    unidade=serializers.IntegerField(min_value=1,max_value=2147483647)
    simulado=serializers.BooleanField()
    evidencia_sha256=serializers.RegexField(r'^[0-9a-f]{64}$')
    valido_ate=serializers.CharField(max_length=40,allow_null=True,required=False)
    confirmar_habilitacao=serializers.BooleanField()

class EntradaConsulta(ContratoMTR):
    vinculo_id=serializers.UUIDField()
    parametro=serializers.CharField(max_length=80,required=False,trim_whitespace=False)

class EntradaRevisao(ContratoMTR):
    versao=serializers.IntegerField(min_value=1)
    vinculos=serializers.JSONField()
    catalogos=serializers.JSONField()
    confirmacoes=serializers.JSONField()

class EntradaPreparacao(ContratoMTR):
    revisao_id=serializers.UUIDField()
    modo=serializers.ChoiceField(choices=['SIMULACAO','HOMOLOGACAO'])
    confirmar_preparacao=serializers.BooleanField()

class EntradaSimulacao(ContratoMTR):
    cenario=serializers.ChoiceField(choices=['sucesso','rejeicao','timeout','malformada','participante_invalido','parcial'],default='sucesso')

class ContratosSIGOR(VisaoMTR):
    def get(self,request):
        from mtr.sigor.preparacao import proposta_publica
        return Response({'ambiente':'SIGOR_HOMOLOG','emissao_real_habilitada':False,'rede_habilitada_por_requisicao':False,
            'preparacao_controlada':proposta_publica(self.empresa),
            'operacoes':[{'operacao':op.value,'metodo':metodo_http(op),'rota':CAMINHOS[op],
                'situacao':'RELATO_OPERADOR_SUCESSO' if op in {Operacao.AUTENTICAR,Operacao.CLASSES} else 'PENDENTE_HOMOLOGACAO_INDIVIDUAL'} for op in Operacao],
            'escrita':{'metodo':'POST','rota':'/salvarManifestoLote','habilitada':False}})

class DiagnosticoCenarioSIGOR(VisaoMTR):
    def get(self,request,id):
        from mtr.servicos_mvp import rascunho_da_empresa
        r=rascunho_da_empresa(self.empresa,id)
        if r.frete_id is None:
            from mtr.operacional import validar
            return Response(validar(r))
        from mtr.sigor.diagnostico import diagnosticar_cenario
        if set(request.query_params)-{'revisao_id'} or any(len(request.query_params.getlist(k))!=1 for k in request.query_params):
            raise ErroMTR('PARAMETRO_INVALIDO','Informe apenas uma revisao_id opcional.',400)
        # A empresa gestora pode consultar suas pendencias sem conceder permissao individual.
        try: op=self.operador('pode_revisar')
        except ErroMTR: op=None
        resultado=diagnosticar_cenario(self.empresa,id,op,revisao_id=request.query_params.get('revisao_id'))
        return Response(resultado,status=422 if resultado['estado']=='BLOQUEADO' else 200)

class VinculosSIGOR(VisaoMTR):
    def get(self,request):
        return Response({'resultados':[a.vinculo_dto(v) for v in VinculoAmbientalSIGOR.objects.filter(empresa=self.empresa).order_by('-criado_em')[:100]]})
    def post(self,request):
        op=self.operador('pode_revisar'); dados=self.entrada(EntradaVinculo)
        return self.comando('sigor-vinculo',dados,lambda:a.registrar_vinculo(self.empresa,dados,op),op)

class RevogacaoSIGOR(VisaoMTR):
    def post(self,request,id):
        op=self.operador('pode_revisar'); dados=self.entrada(ComandoVazioMTR)
        return self.comando(f'sigor-revogar:{id}',dados,lambda:a.revogar_vinculo(self.empresa,id,op),op)

class ReferenciaOperadorSIGOR(VisaoMTR):
    def post(self,request):
        op=self.operador('pode_revisar'); dados=self.entrada(ComandoVazioMTR)
        return self.comando('sigor-referencia-operador',dados,lambda:a.incorporar_referencia(self.empresa,op),op)

class ConsultaSIGOR(VisaoMTR):
    def post(self,request,operacao):
        op=self.operador('pode_revisar'); dados=self.entrada(EntradaConsulta)
        try: return Response(a.consultar(self.empresa,dados['vinculo_id'],operacao,dados.get('parametro'),op))
        except ErroSeguro as e:
            return Response({'codigo':'SIGOR_LEITURA_INDISPONIVEL','message':'Leitura não concluída. Confira a liberação do servidor e o contrato da operação. Nenhum método alternativo foi tentado.',
                'diagnostico':e.resumo_publico(),'emissao_real_habilitada':False},status=503)

class CapturasSIGOR(VisaoMTR):
    def get(self,request,id):
        c=CapturaCatalogoSIGOR.objects.filter(pk=id,empresa=self.empresa).first()
        if not c: raise ErroMTR('NAO_ENCONTRADO','Captura não encontrada neste contexto.',404)
        a.conferir_captura(c); return Response(a.captura_dto(c))

class RevisaoSIGOR(VisaoMTR):
    def post(self,request,id):
        op=self.operador('pode_revisar'); dados=self.entrada(EntradaRevisao)
        return self.comando(f'sigor-revisar:{id}',dados,lambda:a.revisar_ambiental(self.empresa,id,dados,op),op)

class PreparacaoSIGOR(VisaoMTR):
    def post(self,request,id):
        op=self.operador('pode_autorizar'); dados=self.entrada(EntradaPreparacao)
        return self.comando(f'sigor-preparar:{id}',dados,lambda:a.preparar_despacho(self.empresa,id,dados,op),op)

class DetalheDespachoSIGOR(VisaoMTR):
    def get(self,request,id): return Response(d.recuperar_interrompido(self.empresa,id))

class ExecutarSimulacaoSIGOR(VisaoMTR):
    def post(self,request,id):
        op=self.operador('pode_autorizar'); dados=self.entrada(EntradaSimulacao)
        body,status=d.despachar_simulado(self.empresa,id,op,request.headers.get('Idempotency-Key'),dados['cenario'])
        return Response(body,status=status)

class ReconciliacaoSIGOR(VisaoMTR):
    def post(self,request,id):
        op=self.operador('pode_autorizar'); self.entrada(ComandoVazioMTR)
        return Response(d.reconciliar(self.empresa,id,op))


class SolicitacaoEmissaoSIGOR(VisaoMTR):
    def post(self,request,id):
        from mtr.operacional import solicitar_emissao
        op=self.operador('pode_autorizar');dados=self.entrada(ComandoVazioMTR)
        return self.comando(f'operacional-solicitar:{id}',dados,lambda:solicitar_emissao(self.empresa,id,op),op)


class EmissaoGovernamentalSIGOR(VisaoMTR):
    def post(self,request,id):
        op=self.operador('pode_autorizar');self.entrada(ComandoVazioMTR)
        d.obter(self.empresa,id)
        from mtr.sigor.escrita import despachar_autorizado
        body,status=despachar_autorizado(self.empresa,id,op,request.headers.get('Idempotency-Key'))
        return Response(body,status=status)
