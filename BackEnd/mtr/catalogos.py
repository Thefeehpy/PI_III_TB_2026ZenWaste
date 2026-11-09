"""Contrato JSON local de intercâmbio para fixtures, não leitor da planilha oficial.

Nenhum arquivo oficial completo foi validado na Fase 1A. Importação de fonte
declarada oficial permanece bloqueada; não há seed ou importação no startup.
"""

from dataclasses import dataclass
import hashlib
import json

from django.db import transaction
from django.db.models import Q

from mtr.dominio import ErroValidacaoMTR
from mtr.models import CodigoResiduoIBAMA, VersaoCatalogoIBAMA
from mtr.validacoes import validar_codigo_ibama, validar_texto


LIMITE_ARQUIVO = 5 * 1024 * 1024
LIMITE_REGISTROS = 20000
FORMATO = "zenwaste.catalogo-ibama.v1"


@dataclass(frozen=True)
class ResultadoImportacao:
    catalogo_id: int
    quantidade_codigos: int
    criado: bool
    simulado: bool = True


def _objeto_sem_chaves_repetidas(pares):
    objeto = {}
    for chave, valor in pares:
        if chave in objeto:
            raise ErroValidacaoMTR("chave_duplicada", "Objeto JSON com chave repetida.")
        objeto[chave] = valor
    return objeto


def _constante_invalida(_valor):
    raise ErroValidacaoMTR("json_invalido", "Constante não admitida no JSON.")


def ler_catalogo_json(conteudo):
    if not isinstance(conteudo, bytes) or not 0 < len(conteudo) <= LIMITE_ARQUIVO:
        raise ErroValidacaoMTR("arquivo_invalido", "Envie bytes de um arquivo dentro do limite interno de 5 MiB.")
    try:
        dados = json.loads(conteudo.decode("utf-8-sig"), object_pairs_hook=_objeto_sem_chaves_repetidas, parse_constant=_constante_invalida)
    except (UnicodeError, json.JSONDecodeError, RecursionError):
        raise ErroValidacaoMTR("arquivo_invalido", "Arquivo deve ser JSON UTF-8 válido.") from None
    campos = {"formato", "fonte", "versao", "referencia_fonte", "simulado", "codigos"}
    if not isinstance(dados, dict) or set(dados) != campos or dados["formato"] != FORMATO:
        raise ErroValidacaoMTR("estrutura_invalida", "Estrutura de catálogo incompatível com o contrato local.")
    if dados["simulado"] is not True:
        raise ErroValidacaoMTR("fonte_oficial_pendente", "Importação real exige arquivo oficial validado e leitor revisado em etapa posterior.")
    for campo, limite in (("fonte", 80), ("versao", 80), ("referencia_fonte", 500)):
        dados[campo] = validar_texto(dados[campo], campo, limite=limite)
    codigos = dados["codigos"]
    if not isinstance(codigos, list) or not 0 < len(codigos) <= LIMITE_REGISTROS:
        raise ErroValidacaoMTR("lista_invalida", "Informe uma lista não vazia dentro do limite interno de registros.")
    vistos = set()
    itens = []
    for linha in codigos:
        if not isinstance(linha, dict) or set(linha) != {"codigo", "descricao", "perigoso"}:
            raise ErroValidacaoMTR("item_invalido", "Cada item deve conter código, descrição e indicação de perigo.")
        codigo = linha["codigo"]
        busca = validar_codigo_ibama(codigo)
        if busca in vistos:
            raise ErroValidacaoMTR("codigo_duplicado", "Código repetido ou marcadores equivalentes na mesma versão.")
        vistos.add(busca)
        perigoso = linha["perigoso"]
        if perigoso is not None and type(perigoso) is not bool:
            raise ErroValidacaoMTR("perigo_invalido", "Indicação de perigo deve ser booleana ou não informada.")
        if "*" in codigo and perigoso is not True:
            raise ErroValidacaoMTR("perigo_inconsistente", "O marcador exige indicação explícita de perigo na fonte.")
        itens.append({"codigo": codigo, "codigo_busca": busca, "descricao": validar_texto(linha["descricao"], "descricao", limite=1000), "perigoso": perigoso})
    return dados, tuple(itens)


def importar_catalogo_json(conteudo):
    # Toda validação acontece antes da primeira escrita.
    dados, itens = ler_catalogo_json(conteudo)
    resumo = hashlib.sha256(conteudo).hexdigest()
    with transaction.atomic():
        catalogo, criado = VersaoCatalogoIBAMA.objects.get_or_create(
            fonte=dados["fonte"], versao=dados["versao"], simulado=True,
            defaults={"referencia_fonte": dados["referencia_fonte"], "sha256_arquivo": resumo},
        )
        catalogo = VersaoCatalogoIBAMA.objects.select_for_update().get(pk=catalogo.pk)
        if not criado:
            persistidos = list(catalogo.codigos.order_by("codigo_busca").values("codigo", "codigo_busca", "descricao", "perigoso"))
            if (catalogo.sha256_arquivo != resumo or catalogo.referencia_fonte != dados["referencia_fonte"]
                    or persistidos != sorted(itens, key=lambda item: item["codigo_busca"])):
                raise ErroValidacaoMTR("versao_conflitante", "Versão já registrada com conteúdo diferente ou persistência inconsistente; não será sobrescrita.")
            return ResultadoImportacao(catalogo.pk, len(itens), False)
        catalogo.full_clean()
        CodigoResiduoIBAMA.objects.bulk_create([CodigoResiduoIBAMA(catalogo=catalogo, **item) for item in itens])
        return ResultadoImportacao(catalogo.pk, len(itens), True)


def buscar_codigos(catalogo_id, termo="", *, incluir_simulados=False, limite=100):
    termo = validar_texto(termo, "termo", limite=256, permitir_vazio=True)
    if type(catalogo_id) is not int or catalogo_id <= 0:
        raise ErroValidacaoMTR("catalogo_invalido", "Informe identificador inteiro positivo do catálogo.")
    if type(limite) is not int or not 1 <= limite <= 100 or type(incluir_simulados) is not bool:
        raise ErroValidacaoMTR("consulta_invalida", "Limite interno entre 1 e 100 e opção booleana obrigatórios.")
    consulta = CodigoResiduoIBAMA.objects.select_related("catalogo").filter(catalogo_id=catalogo_id, catalogo__vigente=True)
    if not incluir_simulados:
        consulta = consulta.filter(catalogo__simulado=False)
    if termo:
        normalizado = termo.replace("(", "").replace(")", "").replace(" ", "")
        filtro = Q(descricao__icontains=termo)
        if normalizado:
            filtro |= Q(codigo_busca__icontains=normalizado)
        consulta = consulta.filter(filtro)
    return consulta[:limite]
