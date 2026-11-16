"""Contrato API10 tipado e codec decimal. Transporte de escrita real permanece bloqueado."""
from dataclasses import dataclass, asdict
from datetime import datetime
from decimal import Decimal
import json
import re

from mtr.catalogos_mvp import TIPOS, catalogos_mvp


class ErroContratoMTR(ValueError):
    pass


@dataclass(frozen=True)
class ParteSIGOR:
    unidade: int
    cpfCnpj: str


@dataclass(frozen=True)
class ResiduoSIGOR:
    resCodigoIbama: str
    marQuantidade: Decimal
    uniCodigo: int
    traCodigo: int
    tieCodigo: int
    tiaCodigo: int
    claCodigo: int


@dataclass(frozen=True)
class ManifestoSIGOR:
    nomeResponsavel: str
    seuCodigo: str
    transportador: ParteSIGOR
    destinador: ParteSIGOR
    listaManifestoResiduos: tuple[ResiduoSIGOR, ...]


def identificador(valor):
    if not isinstance(valor,str) or not re.fullmatch(r'[0-9./-]+',valor): raise ErroContratoMTR('Informe CPF/CNPJ somente com números ou máscara usual.')
    n = re.sub(r'[./-]','',valor)
    if len(n) not in {11,14}: raise ErroContratoMTR('Identificador com comprimento inválido.')
    return n


def inteiro(valor):
    if isinstance(valor,bool) or not isinstance(valor,(int,str)) or not re.fullmatch(r'[0-9]{1,10}',str(valor)):
        raise ErroContratoMTR('Informe código inteiro positivo.')
    n=int(valor)
    if not 1<=n<=2147483647: raise ErroContratoMTR('Código fora do intervalo permitido.')
    return n


def validar_dados(dados,cnpj_vendedora,*,catalogo=None):
    """Validações e catálogo deste MVP são explicitamente MOCK; não atestam habilitação real."""
    erros={}
    permitidos={'gerador_cnpj','gerador_unidade','transportador_cnpj','transportador_unidade','destinador_cnpj','destinador_unidade',
        'resCodigoIbama','marQuantidade','uniCodigo','traCodigo','tieCodigo','tiaCodigo','claCodigo',
        'dataExpedicao','nomeMotorista','placaVeiculo','observacoes','origem_codigo'}
    if not isinstance(dados,dict): return {'dados':'Informe um objeto de dados ambientais.'}
    if set(dados)-permitidos: erros['dados']='Há campos não permitidos no primeiro cenário.'
    for campo in ['gerador_cnpj','transportador_cnpj','destinador_cnpj']:
        try:
            n=identificador(dados.get(campo))
            if campo=='gerador_cnpj' and n!=identificador(cnpj_vendedora): erros[campo]='Primeiro cenário exige vendedora e geradora com mesmo CNPJ.'
        except ErroContratoMTR as e: erros[campo]=str(e)
    for campo in ['gerador_unidade','transportador_unidade','destinador_unidade']:
        try: inteiro(dados.get(campo))
        except ErroContratoMTR as e: erros[campo]=str(e)
    cat=catalogos_mvp() if catalogo is None else catalogo
    encontrados=[r for r in cat['residuos'] if r['codigo']==dados.get('resCodigoIbama') and (not dados.get('origem_codigo') or r['origem']==dados['origem_codigo'])]
    residuo=encontrados[0] if len(encontrados)==1 else None
    if residuo is None: erros['resCodigoIbama']='Selecione um código exato do catálogo de referência, sem alterar zeros ou marcador.'
    if residuo and residuo['perigoso']:
        erros['resCodigoIbama']='Resíduo perigoso exige campos condicionais ainda não disponíveis neste primeiro MVP; selecione outro cenário ou mantenha a pendência.'
    for tipo,(campo,_) in TIPOS.items():
        try:
            codigo=inteiro(dados.get(campo))
            if codigo not in [r['codigo'] for r in cat[tipo]]: erros[campo]='Código não consta neste catálogo MOCK/versão.'
        except ErroContratoMTR as e: erros[campo]=str(e)
    try:
        v=dados.get('marQuantidade')
        if isinstance(v,(bool,float)) or not isinstance(v,(str,int,Decimal)): raise ValueError()
        qtd=Decimal(v)
        if not qtd.is_finite() or not Decimal('0')<qtd<Decimal('1000000000') or qtd!=qtd.quantize(Decimal('.001')): raise ValueError()
    except Exception: erros['marQuantidade']='Confirme quantidade positiva com até três casas decimais.'
    if dados.get('dataExpedicao'):
        try:
            dt=datetime.fromisoformat(dados['dataExpedicao'])
            if dt.tzinfo is None: raise ValueError()
        except (ValueError,TypeError): erros['dataExpedicao']='Use data/hora ISO com fuso explícito.'
    for campo,limite in [('nomeMotorista',120),('observacoes',1000),('placaVeiculo',7)]:
        v=dados.get(campo,'')
        if not isinstance(v,str) or len(v)>limite or any(ord(c)<32 for c in v): erros[campo]='Texto inválido ou acima do limite local.'
    if dados.get('placaVeiculo') and not re.fullmatch(r'[A-Za-z0-9]{7}',dados['placaVeiculo']): erros['placaVeiculo']='Informe placa sem hífen, com sete caracteres.'
    return erros


def construir_payload(dados,nome,referencia,cnpj_vendedora,*,catalogo=None):
    erros=validar_dados(dados,cnpj_vendedora,catalogo=catalogo)
    if erros: raise ErroContratoMTR('Dados ambientais incompletos ou incompatíveis.')
    if not isinstance(nome,str) or not nome.strip() or len(nome)>120 or any(ord(c)<32 for c in nome): raise ErroContratoMTR('Responsável individual identificado obrigatório.')
    if not isinstance(referencia,str) or not re.fullmatch(r'[A-Za-z0-9-]{1,30}',referencia): raise ErroContratoMTR('Referência própria inválida.')
    r=ResiduoSIGOR(dados['resCodigoIbama'],Decimal(str(dados['marQuantidade'])),*[inteiro(dados[c]) for c in ['uniCodigo','traCodigo','tieCodigo','tiaCodigo','claCodigo']])
    obj=ManifestoSIGOR(nome.strip(),referencia,ParteSIGOR(inteiro(dados['transportador_unidade']),identificador(dados['transportador_cnpj'])),
        ParteSIGOR(inteiro(dados['destinador_unidade']),identificador(dados['destinador_cnpj'])),(r,))
    body=asdict(obj)
    body['listaManifestoResiduos']=list(body['listaManifestoResiduos'])
    for campo in ['nomeMotorista','placaVeiculo','observacoes']:
        if dados.get(campo): body[campo]=dados[campo]
    if dados.get('dataExpedicao'): body['dataExpedicao']=int(datetime.fromisoformat(dados['dataExpedicao']).timestamp()*1000)
    return [body]


def json_wire(obj):
    """Número JSON Decimal exato, sem float e sem interpolar strings do usuário."""
    if isinstance(obj,Decimal):
        if not obj.is_finite(): raise ErroContratoMTR('Decimal inválido.')
        return format(obj,'f')
    if isinstance(obj,dict): return '{'+','.join(json.dumps(k,ensure_ascii=False)+':'+json_wire(v) for k,v in sorted(obj.items()))+'}'
    if isinstance(obj,(list,tuple)): return '['+','.join(json_wire(v) for v in obj)+']'
    return json.dumps(obj,ensure_ascii=False,allow_nan=False,separators=(',',':'))


class TransporteSIGOREscritaBloqueada:
    """Porta real preparada, sem possibilidade de desbloqueio por flags do request."""
    base='https://mtrr-hom.cetesb.sp.gov.br/apiws/rest'
    metodo='POST'
    caminho='/salvarManifestoLote'
    def enviar(self,*args,**kwargs):
        raise PermissionError('Emissão real bloqueada: exige homologação contratual/ambiental e autorização específica posterior.')
