"""Diagnostico consultivo: somente SELECTs, sem comandos, rede ou credenciais."""
from dataclasses import asdict, dataclass
from enum import Enum
from hashlib import sha256
import re

from django.utils import timezone
from mtr.models import CapturaCatalogoSIGOR, DespachoSIGOR, OperadorMTR, RevisaoAmbientalSIGOR
from mtr.servicos_mvp import ErroMTR, fingerprint, fonte_comercial, hash_dados, rascunho_da_empresa
from mtr.sigor.ambiental import (
    CONFIRMACOES, PAPEIS, TIPOS, catalogos_da_revisao, conferir_transportador_frete,
    obter_vinculo, uuid_valido,
)
from mtr.sigor.privacidade import json_estrito
from mtr.sigor.protocolo import politica_escrita_permite
from mtr.sigor_contrato import construir_payload, identificador, inteiro, json_wire, validar_dados


class EstadoDiagnostico(str, Enum):
    APTO = 'APTO TECNICAMENTE'
    EXTERNA = 'PENDENTE DE EVIDÊNCIA EXTERNA'
    BLOQUEADO = 'BLOQUEADO'


@dataclass(frozen=True)
class VerificacaoCenario:
    requisito: str
    codigo: str
    camada: str
    situacao: str
    origem: str
    validacao: str
    evidencia: str
    status_http_origem: int | None = None


def classificar(tem_bloqueio, tem_pendencia_externa):
    if tem_bloqueio: return EstadoDiagnostico.BLOQUEADO
    if tem_pendencia_externa: return EstadoDiagnostico.EXTERNA
    return EstadoDiagnostico.APTO


def diagnosticar_cenario(empresa, rascunho_id, operador=None, *, revisao_id=None):
    """Nao aprova, nao prepara, nao recupera worker e nao consome tentativa.

    A leitura e consultiva; as transicoes continuam revalidando suas precondicoes.
    A selecao de participantes/catalogos vem de revisao explicita ja persistida.
    """
    r = rascunho_da_empresa(empresa, uuid_valido(rascunho_id))
    f = r.frete
    inicio_frete = fingerprint(f)
    inicio_versao = r.versao
    dados = r.dados if isinstance(r.dados, dict) else {}
    checks = []

    def interno(requisito, codigo, ok, origem, validacao, evidencia='', status=None):
        checks.append(VerificacaoCenario(requisito, codigo, 'INTERNA', 'VERIFICADO INTERNAMENTE' if ok else EstadoDiagnostico.BLOQUEADO.value,
            origem, validacao, evidencia, status))

    def externo(requisito, codigo, origem, evidencia):
        checks.append(VerificacaoCenario(requisito, codigo, 'EXTERNA', EstadoDiagnostico.EXTERNA.value, origem,
            'Exige evidencia externa; cadastro, hash ou teste local nao comprovam habilitacao.', evidencia))

    interno('Frete', 'FRETE_ATIVO', f.situacao != 'cancelado', 'Frete.situacao', 'Frete cancelado nao pode iniciar emissao.')
    try:
        fonte = fonte_comercial(empresa, f)
        interno('Procedencia comercial', 'PROCEDENCIA_COMERCIAL', True, 'mtr.consultas.consultar_pre_preenchimento',
            'Consistencia de pedido, partes, reserva e unidade.', f'{len(fonte["campos"])} campos informativos; nao equivalem a habilitacao.')
    except ValueError:
        interno('Procedencia comercial', 'PROCEDENCIA_INCONSISTENTE', False, 'Consulta comercial', 'Relacoes comerciais precisam de revisao.')

    d = DespachoSIGOR.objects.filter(rascunho=r).select_related('revisao').first()
    revisoes = RevisaoAmbientalSIGOR.objects.filter(rascunho=r)
    if revisao_id is not None:
        rev = revisoes.filter(pk=uuid_valido(revisao_id)).first()
        if not rev: raise ErroMTR('NAO_ENCONTRADO', 'Revisao nao encontrada neste contexto.', 404)
    else:
        rev = d.revisao if d else revisoes.order_by('-criada_em', '-id').first()
    s = rev.snapshot if rev and isinstance(rev.snapshot, dict) else {}
    try: integra = bool(rev) and hash_dados(s) == rev.resumo
    except (TypeError, ValueError): integra = False
    interno('Revisao ambiental', 'REVISAO_INTEGRA', integra, 'RevisaoAmbientalSIGOR.snapshot/resumo', 'Revisao explicita e hash coerente sao obrigatorios.')
    if not integra: s = {}
    atual = bool(rev) and s.get('versao_rascunho') == r.versao and s.get('dados') == r.dados and s.get('fingerprint_frete') == inicio_frete
    interno('Atualidade', 'SNAPSHOT_ATUAL', atual, 'Snapshot x RascunhoMTR/Frete', 'Mudanca apos revisao exige nova revisao; historico nao e reescrito.')
    conf = s.get('confirmacoes')
    interno('Confirmacoes', 'CONFIRMACOES_COMPLETAS', isinstance(conf, dict) and set(conf) == CONFIRMACOES and all(v is True for v in conf.values()),
        'RevisaoAmbientalSIGOR.snapshot.confirmacoes', 'Participantes, classificacao, quantidade, tratamento/destinador, condicionais e ambiente.')

    op = OperadorMTR.objects.select_related('usuario').filter(pk=getattr(operador, 'pk', None), empresa=empresa).first()
    pessoa_ok = bool(op and op.ativo and op.pode_revisar and op.pode_autorizar and op.usuario.is_active and op.usuario.get_full_name().strip())
    if pessoa_ok:
        pessoa_ok = op.usuario.get_session_auth_hash() == operador.usuario.get_session_auth_hash()
    interno('Responsavel individual', 'OPERADOR_AUTORIZADO', pessoa_ok, 'OperadorMTR + usuario Django ativo',
        'Login empresarial nao substitui pessoa identificada e autorizada; diagnostico nao concede permissoes.')

    selecionados = s.get('vinculos') if isinstance(s.get('vinculos'), dict) else {}
    vinculos = {}
    for papel, prefixo in [('GERADOR', 'gerador'), ('TRANSPORTADOR', 'transportador'), ('DESTINADOR', 'destinador')]:
        ref = selecionados.get(papel)
        try:
            if not isinstance(ref, dict): raise ErroMTR('VINCULO_NAO_SELECIONADO', 'Selecione o vinculo explicitamente.', 422)
            v = obter_vinculo(empresa, ref.get('id'), papel)
            vinculos[papel] = v
            documento_ok = identificador(dados.get(prefixo + '_cnpj')) == v.cpf_cnpj
            unidade_ok = inteiro(dados.get(prefixo + '_unidade')) == v.unidade
            evidencia_ok = bool(re.fullmatch(r'[0-9a-f]{64}', v.evidencia_sha256))
            interno(papel, 'VINCULO_' + papel, documento_ok and unidade_ok and evidencia_ok, 'VinculoAmbientalSIGOR + rascunho',
                'Papel, contexto empresarial, documento, unidade, validade e revogacao; hash e apenas referencia da evidencia.',
                'Declaracao simulada.' if v.simulado else 'Declaracao individual com hash; evidencia nao inspecionada automaticamente.')
        except (ErroMTR, ValueError):
            interno(papel, 'VINCULO_' + papel, False, 'VinculoAmbientalSIGOR', 'Vinculo ausente, invalido, expirado, revogado ou fora do contexto.', status=422)
        externo(papel + ': habilitacao', 'HABILITACAO_EXTERNA_' + papel, 'Evidencia ambiental da unidade',
            'Nao verificada contra a CETESB nesta etapa; existencia do identificador e declaracao nao comprovam aptidao.')

    try:
        transportador = vinculos.get('TRANSPORTADOR')
        conferir_transportador_frete(f, dados, transportador.cpf_cnpj if transportador else None)
        interno('DA01', 'TRANSPORTADOR_COINCIDE_FRETE', True, 'Frete.transportadora.cnpj + rascunho + vinculo', 'Comparacao por documento, removendo apenas mascara e preservando zeros.')
    except ErroMTR as erro:
        interno('DA01', str(erro.detail['codigo']), False, 'Frete.transportadora + dados/vinculo ambiental',
            'Defina/corrija a transportadora no frete antes de nova revisao; nada e substituido automaticamente.', status=erro.status_code)

    try: gerador_ok = identificador(dados.get('gerador_cnpj')) == identificador(empresa.cnpj)
    except ValueError: gerador_ok = False
    interno('Geradora x vendedora', 'GERADOR_MESMO_CNPJ', gerador_ok, 'Empresa vendedora + dados ambientais', 'Primeiro cenario exige mesmo CNPJ; isso nao comprova habilitacao.')

    catalogos = s.get('catalogos') if isinstance(s.get('catalogos'), dict) else {}
    ids = {nome: meta.get('id') for nome, meta in catalogos.items() if isinstance(meta, dict)}
    cat = {nome: [] for nome in [*TIPOS, 'residuos']}
    try:
        capturas, cat = catalogos_da_revisao(empresa, ids, dados)
        hashes_ok = all(c.resumo == catalogos[nome].get('resumo') and c.fonte_sha256 == catalogos[nome].get('fonte_sha256') for nome, c in capturas.items())
        interno('Catalogos e compatibilidades', 'CATALOGOS_COMPATIVEIS', hashes_ok, 'Oito CapturaCatalogoSIGOR referenciadas na revisao',
            'Integridade, pertencimento, filtros, classe/residuo e acondicionamento/estado; tratamento/destinador requer confirmacao humana.')
    except (ErroMTR, ValueError) as erro:
        codigo = str(erro.detail['codigo']) if isinstance(erro, ErroMTR) else 'DADOS_AMBIENTAIS_INVALIDOS'
        interno('Catalogos e compatibilidades', codigo, False, 'Capturas + dados ambientais',
            'Catalogos, filtros, combinacoes ou campos ambientais nao passaram nas validacoes existentes.', status=422)
        # Para apontar campos invalidos, usa somente a selecao de snapshot com hash valido.
        if isinstance(s.get('catalogo_validacao'), dict) and set(s['catalogo_validacao']) == set(cat):
            cat = s['catalogo_validacao']
    erros = validar_dados(dados, empresa.cnpj, catalogo=cat)
    for campo, mensagem in erros.items():
        interno(campo, 'CAMPO_INVALIDO_' + campo, False, 'RascunhoMTR.dados.' + campo, str(mensagem), status=422)
    interno('Dados do manifesto', 'DADOS_AMBIENTAIS_VALIDOS', not erros, 'RascunhoMTR.dados + capturas',
        'Documentos, unidades, codigo textual, Decimal, codigos selecionados e opcionais fornecidos.')
    for requisito, codigo, fonte in [
        ('Identidade civil e representacao', 'IDENTIDADE_EXTERNA_PENDENTE', 'Pessoa/conta SIGOR e autorizacao da geradora'),
        ('Classificacao, tratamento e condicionais', 'CLASSIFICACAO_EXTERNA_PENDENTE', 'Origem/processo, habilitacao do destinador e analise ambiental'),
        ('Catalogos oficiais e metodos', 'CATALOGOS_EXTERNOS_PENDENTES', 'Capturas oficiais e homologacao individual das operacoes'),
        ('Contrato API10/API20', 'CONTRATO_VIGENTE_PENDENTE', 'Manual historico v1.15 e evidencia atual de homologacao'),
        ('Configuracao privada e conta', 'CONFIGURACAO_EXTERNA_PENDENTE', 'Configuracao exclusivamente do servidor'),
    ]:
        externo(requisito, codigo, fonte, 'Nao comprovado pelos modelos atuais; nenhum provedor de segredo ou rede foi chamado pelo diagnostico.')

    payload_ok = False
    if d:
        try:
            payload = json_estrito(d.payload_wire)
            esperado = construir_payload(dados, s['responsavel']['nome'], d.referencia, empresa.cnpj, catalogo=cat)
            payload_ok = d.revisao_id == getattr(rev, 'pk', None) and sha256(d.payload_wire.encode()).hexdigest() == d.resumo and json_wire(payload) == json_wire(esperado)
        except (KeyError, TypeError, ValueError): payload_ok = False
    interno('Preparacao e payload', 'PAYLOAD_COERENTE_REVISAO', payload_ok, 'DespachoSIGOR.payload_wire/resumo + revisao selecionada',
        'Array de um manifesto/um item, tipos exatos, referencia persistida; sem gerador na raiz, AT ou financeiro.')
    interno('Tentativa', 'SEM_TENTATIVA_PREVIA', bool(d and d.estado == 'PREPARADA' and d.tentativas == 0), 'DespachoSIGOR.estado/tentativas',
        'Diagnostico nao recupera worker, nao reconcilia e nao libera novo envio de tentativa anterior.')
    interno('Protecao de escrita', 'POLITICA_ESCRITA_FECHADA', politica_escrita_permite() is False, 'Politica de escrita MTR-02',
        'A politica permanece fechada; esta leitura nunca chama o adaptador.')

    # Detecta alteracao observada entre as leituras, sem locks ou efeitos colaterais.
    fim = rascunho_da_empresa(empresa, r.pk)
    consistente = fim.versao == inicio_versao and fim.dados == r.dados and fingerprint(fim.frete) == inicio_frete
    interno('Consistencia da consulta', 'LEITURA_CONSISTENTE', consistente, 'Versao/fingerprint antes e depois',
        'Resposta consultiva; uma transicao posterior deve revalidar suas precondicoes.')
    bloqueios = [asdict(c) for c in checks if c.situacao == EstadoDiagnostico.BLOQUEADO.value]
    pendencias = [asdict(c) for c in checks if c.camada == 'EXTERNA']
    estado = classificar(bool(bloqueios), bool(pendencias))
    prioridade = next((c['codigo'] for c in bloqueios if c['requisito'] == 'DA01'), 'CENARIO_BLOQUEADO')
    return {
        'schema': 'mtr-diagnostico-cenario-v1', 'avaliado_em': timezone.now().isoformat(),
        'rascunho_id': str(r.pk), 'frete_id': str(f.pk), 'versao_rascunho': r.versao,
        'revisao_id': str(rev.pk) if rev else None, 'despacho_id': str(d.pk) if d else None,
        'estado': estado.value, 'estado_interno': classificar(bool(bloqueios), False).value,
        'codigo': prioridade if bloqueios else 'EVIDENCIA_EXTERNA_PENDENTE',
        'natureza_preparacao': 'SIMULACAO' if d and d.simulado else 'HOMOLOGACAO' if d else 'NAO_PREPARADA',
        'somente_leitura': True, 'emissao_real_habilitada': False, 'autorizacao_de_emissao': False, 'pode_despachar': False,
        'codigo_residuo': dados.get('resCodigoIbama') if isinstance(dados.get('resCodigoIbama'), str) else None,
        'payload_sha256': d.resumo if d else None, 'bloqueios': bloqueios, 'pendencias_externas': pendencias,
        'verificacoes': [asdict(c) for c in checks],
    }
