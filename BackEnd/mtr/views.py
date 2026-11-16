from django.core.paginator import Paginator, InvalidPage
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from autenticacao.servicos import VisaoAPIZenWaste, exigir_empresa
from fretes.models import Frete
from mtr.catalogos_mvp import catalogos_mvp
from mtr.models import RascunhoMTR, ReciboMTR
from mtr import serializers as contratos
from mtr import servicos_mvp as s


class LimiteSessaoOperador(SimpleRateThrottle):
    scope='mtr_sessao'
    rate='10/min'
    def get_cache_key(self,request,view):
        return self.cache_format % {'scope':self.scope,'ident':f'{view.empresa.pk}:{self.get_ident(request)}'}


class VisaoMTR(VisaoAPIZenWaste):
    def initial(self,request,*args,**kwargs):
        # Resolve a empresa antes de permitir acesso; throttles especializados podem usá-la.
        self.empresa,erro=exigir_empresa(request)
        if erro is not None: raise s.ErroMTR('AUTENTICACAO_OBRIGATORIA','Autenticação empresarial obrigatória.',401)
        super().initial(request,*args,**kwargs)

    def entrada(self,tipo):
        obj=tipo(data=self.request.data); obj.is_valid(raise_exception=True)
        # UUIDs serializados como texto para digest/JSON estáveis.
        return s.primitivo(obj.validated_data)

    def operador(self,capacidade):
        return s.exigir_operador(self.empresa,self.request.headers.get('X-MTR-Actor-Token',''),capacidade)

    def comando(self,acao,dados,fn,op=None):
        chave=self.request.headers.get('Idempotency-Key')
        body,status=s.executar_comando(self.empresa,f'{acao}:{op.pk if op else "empresa"}',chave,dados,fn)
        return Response(body,status=status)


class ContextoMTR(VisaoMTR):
    def get(self,request):
        return Response({'ambiente':'MOCK','empresa_id':self.empresa.pk,'emissao_real_habilitada':False,
            'message':'Fluxo de preparação e emissão simulada. Nenhuma emissão governamental está habilitada.'})


class OperacoesMTR(VisaoMTR):
    def get(self,request):
        try:
            pagina=int(request.query_params.get('pagina',1))
            if not 1<=pagina<=100000: raise ValueError()
        except ValueError: raise s.ErroMTR('PAGINA_INVALIDA','Informe página válida.',400) from None
        busca=request.query_params.get('busca','')
        if len(busca)>100: raise s.ErroMTR('BUSCA_INVALIDA','Busca acima do limite.',400)
        q=Frete.objects.filter(empresa_vendedora=self.empresa).order_by('-criado_em','id')
        if busca: q=q.filter(numero_pedido__icontains=busca)
        pages=Paginator(q,20)
        try: p=pages.page(pagina)
        except InvalidPage: raise s.ErroMTR('PAGINA_INVALIDA','Página não disponível.',400) from None
        return Response({'resultados':[{'id':str(f.pk),'referencia':f.numero_pedido,'material':f.material,
            'quantidade':str(f.quantidade),'unidade':f.unidade,'situacao':f.situacao,'origem_cadastro':f.origem_cadastro} for f in p],
            'paginacao':{'pagina':p.number,'total_paginas':pages.num_pages,'total':pages.count}})


class PreenchimentoMTR(VisaoMTR):
    def get(self,request,id):
        f=s.frete_gestor(self.empresa,id)
        return Response({'dados':s.fonte_comercial(self.empresa,f),'ambiente':'MOCK','aprovado_ambientalmente':False})


class CatalogosMTR(VisaoMTR):
    def get(self,request):
        data=catalogos_mvp()
        busca=request.query_params.get('busca','').casefold()
        if len(busca)>100: raise s.ErroMTR('BUSCA_INVALIDA','Busca acima do limite.',400)
        data['residuos']=[r for r in data['residuos'] if busca in (r['codigo']+' '+r['descricao']).casefold()][:100]
        return Response(data)


class SessaoMTR(VisaoMTR):
    throttle_classes=[LimiteSessaoOperador]
    def post(self,request):
        data=self.entrada(contratos.SessaoOperadorMTR)
        return Response(s.sessao_operador(self.empresa,data['usuario'],data['senha']),status=201)


class ListaRascunhosMTR(VisaoMTR):
    def get(self,request):
        q=RascunhoMTR.objects.filter(empresa=self.empresa)
        if request.query_params.get('tipo')=='HOMOLOGACAO_INDEPENDENTE':q=q.filter(frete__isnull=True)
        fid=request.query_params.get('frete_id')
        if fid:
            from uuid import UUID
            try: fid=UUID(fid)
            except ValueError: raise s.ErroMTR('FRETE_INVALIDO','Identificador inválido.',400) from None
            q=q.filter(frete_id=fid)
        return Response({'resultados':[s.rascunho_dto(r) for r in q.order_by('-atualizado_em')[:50]]})
    def post(self,request):
        data=self.entrada(contratos.CriacaoRascunhoMTR)
        return self.comando('criar',data,lambda:s.criar_rascunho(self.empresa,data))


class DetalheRascunhoMTR(VisaoMTR):
    def get(self,request,id): return Response(s.rascunho_dto(s.rascunho_da_empresa(self.empresa,id)))
    def patch(self,request,id):
        if s.rascunho_da_empresa(self.empresa,id).frete_id is None:
            from mtr import operacional
            data=self.entrada(contratos.AlteracaoOperacionalMTR)
            return self.comando(f'operacional-salvar:{id}',data,lambda:operacional.salvar(self.empresa,id,data))
        data=self.entrada(contratos.AlteracaoRascunhoMTR)
        return self.comando(f'salvar:{id}',data,lambda:s.salvar_rascunho(self.empresa,id,data))


class ValidacaoMTR(VisaoMTR):
    def get(self,request,id):
        r=s.rascunho_da_empresa(self.empresa,id)
        if r.frete_id is None:
            from mtr.operacional import validar
            return Response(validar(r))
        return Response(s.validar_rascunho(r))


class RevisaoMTR(VisaoMTR):
    def post(self,request,id):
        op=self.operador('pode_revisar'); data=self.entrada(contratos.RevisaoRascunhoMTR)
        if s.rascunho_da_empresa(self.empresa,id).frete_id is None:
            from mtr.operacional import revisar
            return self.comando(f'operacional-revisar:{id}',data,lambda:revisar(self.empresa,id,data,op),op)
        return self.comando(f'revisar:{id}',data,lambda:s.revisar(self.empresa,id,data,op),op)


class PreparacaoMTR(VisaoMTR):
    def post(self,request,id):
        if s.rascunho_da_empresa(self.empresa,id).frete_id is None:
            from mtr.operacional import preparar
            op=self.operador('pode_autorizar');data=self.entrada(contratos.PreparacaoOperacionalMTR)
            return self.comando(f'operacional-preparar:{id}',data,lambda:preparar(self.empresa,id,data,op),op)
        op=self.operador('pode_autorizar'); data=self.entrada(contratos.PreparacaoMTR)
        return self.comando(f'preparar:{id}',data,lambda:s.preparar(self.empresa,id,data,op),op)


class IntencaoMTR(VisaoMTR):
    def get(self,request,id): return Response(s.intencao_dto(s.obter_intencao(self.empresa,id)))


class EnvioMTR(VisaoMTR):
    def post(self,request,id):
        op=self.operador('pode_autorizar'); data=self.entrada(contratos.ComandoVazioMTR)
        return self.comando(f'enviar:{id}',data,lambda:s.enviar_mock(self.empresa,id,data,op),op)


class ReconciliacaoMTR(VisaoMTR):
    def post(self,request,id):
        op=self.operador('pode_autorizar'); data=self.entrada(contratos.ComandoVazioMTR)
        return self.comando(f'consultar:{id}',data,lambda:s.reconciliar_mock(self.empresa,id,data,op),op)


class ConsultaReciboMTR(VisaoMTR):
    def get(self,request,chave):
        r=ReciboMTR.objects.filter(empresa=self.empresa,chave=chave).first()
        if not r: raise s.ErroMTR('NAO_ENCONTRADO','Comando não localizado; isso não autoriza um novo envio.',404)
        return Response({'chave':str(r.chave),'operacao':r.operacao,'resposta':r.resposta,'status_http':r.status_http})


class EmissaoRealBloqueadaMTR(VisaoMTR):
    def post(self,request): raise s.ErroMTR('EMISSAO_REAL_BLOQUEADA','Emissão real indisponível: exige autorização específica e habilitação comprovada.',403)
