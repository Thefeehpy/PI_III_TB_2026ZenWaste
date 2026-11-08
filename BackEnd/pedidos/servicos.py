from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from app.excecoes import ErroRegraNegocio, ErroConflito, ErroProcessamentoPagamento

from anuncios.models import Anuncio, Reserva
from empresas.models import Empresa
from pedidos.integracoes import ResultadoPagamento, ErroIntegracaoPagamento, obter_integracao_pagamento
from pedidos.models import Pedido, TentativaPagamento, EventoWebhook
from produtos.models import Produto
from produtos.disponibilidade import quantidade_comprometida
from produtos.servicos import registrar_movimentacao_estoque


def _calcular_resumo_dados(dados):
    conteudo = json.dumps(dados, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(conteudo.encode("utf-8")).hexdigest()


def _exigir_chave_idempotencia(valor):
    chave = (valor or "").strip()
    if not chave or len(chave) > 128:
        raise ErroRegraNegocio({"message": "Envie uma chave Idempotency-Key valida."})
    return chave


def _quantidade_comprometida(*, produto_id=None, anuncio_id=None, id_pedido_excluido=None, agora=None):
    if produto_id is None:
        produto_id = Anuncio.objects.values_list("produto_id", flat=True).get(pk=anuncio_id)
    return quantidade_comprometida(
        produto_id,
        id_anuncio=anuncio_id,
        id_pedido_excluido=id_pedido_excluido,
        agora=agora,
    )


def _bloquear_anuncio_e_produto(anuncio_id):
    """Bloqueia o produto antes do anúncio, sem bloquear empresas por junções."""
    try:
        produto_id = Anuncio.objects.values_list("produto_id", flat=True).get(pk=anuncio_id)
        produto = Produto.objects.select_for_update(of=("self",)).select_related("empresa", "categoria", "unidade_medida").get(pk=produto_id)
        anuncio = Anuncio.objects.select_for_update(of=("self",)).get(pk=anuncio_id)
    except (Anuncio.DoesNotExist, Produto.DoesNotExist) as erro:
        raise ErroRegraNegocio({"message": "Anuncio ou material indisponivel."}) from erro
    if anuncio.produto_id != produto.pk:
        raise ErroConflito("O produto da oferta foi alterado. Tente novamente.")
    return anuncio, produto


def _sincronizar_reserva_pedido(pedido):
    """Mantém uma reserva por compra, sem duplicar o compromisso de estoque.

    A baixa no pagamento permanece até a implantação do transporte. Por isso,
    a reserva do pedido pago é encerrada: o fluxo atual já baixou o material.
    """
    ativo = pedido.situacao in (Pedido.Situacao.AGUARDANDO_PAGAMENTO, Pedido.Situacao.PENDENTE)
    situacao = "pronta" if ativo else (
        "finalizada" if pedido.situacao == Pedido.Situacao.PAGO else
        "expirada" if pedido.situacao == Pedido.Situacao.EXPIRADO else "cancelada"
    )
    Reserva.objects.update_or_create(
        pedido=pedido,
        defaults={
            "produto_id": pedido.anuncio.produto_id,
            "empresa_compradora_id": pedido.empresa_compradora_id,
            "quantidade_reservada": pedido.quantidade,
            "preco_unitario": pedido.preco_unitario,
            "modalidade": "compromisso",
            'situacao': situacao,
            "nome_comprador": pedido.nome_comprador,
            "numero_comprador": pedido.telefone_comprador,
            "prazo_reserva": timezone.localtime(pedido.reserva_expira_em).date(),
            "data_finalizacao": None if ativo else (pedido.pago_em or timezone.now()),
        },
    )


def quantidade_comprometida_produto(produto_id):
    return _quantidade_comprometida(produto_id=produto_id)


def quantidade_comprometida_anuncio(anuncio_id):
    return _quantidade_comprometida(anuncio_id=anuncio_id)


def _gerar_numero_pedido():
    return f"ZW-{secrets.token_hex(5).upper()}"


@transaction.atomic
def criar_pedido(empresa, dados, chave_idempotencia):
    chave = _exigir_chave_idempotencia(chave_idempotencia)
    resumo_dados = _calcular_resumo_dados(dados)
    empresa = Empresa.objects.select_for_update().get(pk=empresa.pk)
    if not empresa.ativo:
        raise ErroRegraNegocio("Empresa compradora inativa.")
    existente = Pedido.objects.filter(
        empresa_compradora=empresa,
        chave_idempotencia_criacao=chave,
    ).first()
    if existente:
        if existente.resumo_dados_criacao != resumo_dados:
            raise ErroConflito("A chave de idempotencia ja foi usada com outros dados.")
        return existente

    anuncio, produto = _bloquear_anuncio_e_produto(dados["listingId"])

    existente = Pedido.objects.filter(
        empresa_compradora=empresa,
        chave_idempotencia_criacao=chave,
    ).first()
    if existente:
        if existente.resumo_dados_criacao != resumo_dados:
            raise ErroConflito("A chave de idempotencia ja foi usada com outros dados.")
        return existente

    if anuncio.situacao_anuncio != "ativo" or not produto.empresa_id or not produto.ativo or not produto.empresa.ativo:
        raise ErroRegraNegocio({"message": "Este anuncio nao esta disponivel."})
    if produto.empresa_id == empresa.id_empresa:
        raise ErroRegraNegocio({"message": "Nao e permitido comprar o proprio anuncio."})

    quantidade = dados["quantity"]
    disponivel_anuncio = anuncio.nr_qtd - _quantidade_comprometida(anuncio_id=anuncio.pk)
    disponivel_produto = produto.quantidade - _quantidade_comprometida(produto_id=produto.pk)
    disponivel = min(disponivel_anuncio, disponivel_produto)
    if quantidade <= 0 or quantidade > disponivel:
        raise ErroRegraNegocio({
            "message": f"Quantidade indisponivel. Saldo livre: {disponivel}."
        })

    total = (anuncio.preco_final * quantidade).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    if total <= 0 or total > Decimal("999999999999.99"):
        raise ErroRegraNegocio({"message": "O total deve ser positivo e respeitar o limite de valor do pedido."})

    compradora = dados["buyer"]
    documento_empresa = "".join(caractere for caractere in empresa.cnpj if caractere.isdigit())
    if compradora["document"] != documento_empresa:
        raise ErroRegraNegocio({
            "buyer": {"document": "O CNPJ do comprador deve corresponder a empresa autenticada."}
        })
    vendedora = produto.empresa
    pedido = Pedido.objects.create(
        numero=_gerar_numero_pedido(),
        empresa_compradora=empresa,
        anuncio=anuncio,
        situacao=Pedido.Situacao.AGUARDANDO_PAGAMENTO,
        quantidade=quantidade,
        preco_unitario=anuncio.preco_final,
        valor_total=total,
        nome_comprador=compradora["name"],
        email_comprador=compradora["email"],
        documento_comprador=compradora["document"],
        telefone_comprador=compradora["phone"],
        nome_material_negociado=produto.nome_residuo,
        categoria_material_negociado=produto.tipo_produto,
        descricao_material_negociado=anuncio.descricao_especifica or produto.descricao_produto,
        unidade_material_negociado=produto.unidade,
        imagem_material_negociado=anuncio.imagem_url,
        localizacao_material_negociado=anuncio.localizacao,
        razao_social_vendedora=vendedora.razao_social,
        chave_idempotencia_criacao=chave,
        resumo_dados_criacao=resumo_dados,
        reserva_expira_em=timezone.now() + timedelta(
            minutes=getattr(settings, 'MINUTOS_RESERVA_PEDIDO', 15)
        ),
    )
    _sincronizar_reserva_pedido(pedido)
    return pedido


def _verificar_disponibilidade_pedido(pedido):
    if pedido.situacao in (Pedido.Situacao.PAGO, Pedido.Situacao.CANCELADO):
        raise ErroConflito("Este pedido ja foi finalizado.")
    if pedido.reserva_expira_em <= timezone.now():
        if pedido.situacao in (Pedido.Situacao.AGUARDANDO_PAGAMENTO, Pedido.Situacao.PENDENTE):
            pedido.situacao = Pedido.Situacao.EXPIRADO
            pedido.save(update_fields=['situacao', 'atualizado_em'])
        raise ErroConflito("A reserva deste pedido expirou. Crie um novo pedido.")


def _restabelecer_reserva_pedido(pedido):
    repetindo_pedido_falho = pedido.situacao == Pedido.Situacao.FALHOU
    if pedido.reserva_expira_em <= timezone.now() and not repetindo_pedido_falho:
        raise ErroConflito("A reserva deste pedido expirou. Crie um novo pedido.")
    anuncio, produto = _bloquear_anuncio_e_produto(pedido.anuncio_id)
    if anuncio.situacao_anuncio != "ativo" or not produto.ativo or not produto.empresa.ativo:
        raise ErroConflito("Esta oferta nao esta mais disponivel para pagamento.")
    disponivel_anuncio = anuncio.nr_qtd - _quantidade_comprometida(
        anuncio_id=anuncio.pk,
        id_pedido_excluido=pedido.pk,
    )
    disponivel_produto = produto.quantidade - _quantidade_comprometida(
        produto_id=produto.pk,
        id_pedido_excluido=pedido.pk,
    )
    if pedido.quantidade > min(disponivel_anuncio, disponivel_produto):
        raise ErroConflito("A quantidade do pedido nao esta mais disponivel. Crie outro pedido.")
    pedido.situacao = Pedido.Situacao.AGUARDANDO_PAGAMENTO
    if repetindo_pedido_falho:
        pedido.reserva_expira_em = timezone.now() + timedelta(
            minutes=getattr(settings, 'MINUTOS_RESERVA_PEDIDO', 30)
        )
    pedido.save(update_fields=['situacao', 'reserva_expira_em', 'atualizado_em'])
    _sincronizar_reserva_pedido(pedido)


@transaction.atomic
def atualizar_situacao_pedido(pedido):
    # A expiração é uma escrita explícita. Recarrega sob o mesmo bloqueio do
    # pagamento para evitar alterações com base em uma consulta desatualizada.
    pedido = Pedido.objects.select_for_update().get(pk=pedido.pk)
    agora = timezone.now()
    tentativas_pagamento = list(pedido.pagamentos.order_by('-criado_em'))
    pagamentos_pendentes = [pagamento for pagamento in tentativas_pagamento if pagamento.situacao == TentativaPagamento.Situacao.PENDENTE]
    pix_expirados = [
        pagamento for pagamento in pagamentos_pendentes
        if pagamento.metodo == "pix" and pagamento.pix_expira_em and pagamento.pix_expira_em <= agora
    ]
    if pedido.situacao in (Pedido.Situacao.AGUARDANDO_PAGAMENTO, Pedido.Situacao.PENDENTE):
        if pedido.reserva_expira_em <= agora:
            pagamentos_expirados = pagamentos_pendentes
            pedido.situacao = Pedido.Situacao.EXPIRADO
        elif pix_expirados:
            pagamentos_expirados = pix_expirados
            pedido.situacao = Pedido.Situacao.EXPIRADO
        else:
            pagamentos_expirados = []
        for pagamento in pagamentos_expirados:
            pagamento.situacao = TentativaPagamento.Situacao.EXPIRADO
            pagamento.save(update_fields=['situacao', 'atualizado_em'])
        if pedido.situacao == Pedido.Situacao.EXPIRADO:
            pedido.save(update_fields=['situacao', 'atualizado_em'])
            _sincronizar_reserva_pedido(pedido)
    pedido.tentativas_pagamento = tentativas_pagamento
    return pedido


def _aplicar_resultado_pagamento(pedido, pagamento, resultado):
    pagamento.situacao = resultado.situacao
    pagamento.referencia_provedor = resultado.referencia
    pagamento.bandeira_cartao = resultado.bandeira_cartao
    pagamento.final_cartao = resultado.final_cartao
    pagamento.pix_copia_cola = resultado.pix_copia_cola
    pagamento.pix_expira_em = resultado.pix_expira_em
    pagamento.save(update_fields=[
        'situacao', 'referencia_provedor', 'bandeira_cartao', 'final_cartao',
        'pix_copia_cola', 'pix_expira_em', 'atualizado_em',
    ])
    pedido.metodo = pagamento.metodo
    pedido.parcelas = pagamento.parcelas

    if resultado.situacao == TentativaPagamento.Situacao.PAGO:
        if pedido.reserva_expira_em <= timezone.now():
            pagamento.situacao = TentativaPagamento.Situacao.EXPIRADO
            pagamento.save(update_fields=['situacao', 'atualizado_em'])
            pedido.situacao = Pedido.Situacao.EXPIRADO
        else:
            pedido.situacao = Pedido.Situacao.PAGO
            pedido.pago_em = timezone.now()
            pedido.save(update_fields=['situacao', 'pago_em', 'atualizado_em'])
            anuncio, produto = _bloquear_anuncio_e_produto(pedido.anuncio_id)
            registrar_movimentacao_estoque(produto, produto.empresa, {
                "type": "saida",
                "quantity": pedido.quantidade,
                "note": f"Pedido {pedido.numero} pago",
            })
            anuncio.nr_qtd = max(Decimal("0"), anuncio.nr_qtd - pedido.quantidade)
            update_fields = ["nr_qtd"]
            if anuncio.nr_qtd <= 0:
                anuncio.situacao_anuncio = "vendido"
                anuncio.data_final = timezone.localdate()
                update_fields.extend(["situacao_anuncio", "data_final"])
            anuncio.save(update_fields=update_fields)
    elif resultado.situacao == TentativaPagamento.Situacao.PENDENTE:
        pedido.situacao = Pedido.Situacao.PENDENTE
    elif resultado.situacao == TentativaPagamento.Situacao.FALHOU:
        pedido.situacao = Pedido.Situacao.FALHOU
    elif resultado.situacao == TentativaPagamento.Situacao.CANCELADO:
        pedido.situacao = Pedido.Situacao.CANCELADO
    elif resultado.situacao == TentativaPagamento.Situacao.EXPIRADO:
        pedido.situacao = Pedido.Situacao.EXPIRADO

    pedido.save(update_fields=['metodo', 'parcelas', 'situacao', 'pago_em', 'atualizado_em'])
    _sincronizar_reserva_pedido(pedido)
    return pedido


def iniciar_pagamento(pedido_id, empresa, metodo, dados, chave_idempotencia, *, integracao=None):
    chave = _exigir_chave_idempotencia(chave_idempotencia)
    resumo_pagamento = _calcular_resumo_dados({"method": metodo, **dados})
    ids_pagamentos_pendentes = []
    with transaction.atomic():
        try:
            pedido = Pedido.objects.select_for_update().get(pk=pedido_id, empresa_compradora=empresa)
        except Pedido.DoesNotExist:
            raise ErroRegraNegocio({"message": "Pedido nao encontrado."})
        if pedido.cancelamento_solicitado:
            raise ErroConflito("O cancelamento deste pedido esta sendo processado.")

        pagamento = TentativaPagamento.objects.filter(pedido=pedido, chave_idempotencia=chave).first()
        if pagamento:
            if pagamento.resumo_dados_requisicao != resumo_pagamento:
                raise ErroConflito("A chave de idempotencia ja foi usada com outros dados.")
            if pagamento.situacao != TentativaPagamento.Situacao.PROCESSANDO:
                return pedido
            _verificar_disponibilidade_pedido(pedido)
        else:
            if pedido.situacao in (Pedido.Situacao.EXPIRADO, Pedido.Situacao.FALHOU):
                _restabelecer_reserva_pedido(pedido)
            else:
                _verificar_disponibilidade_pedido(pedido)

            pagamento_ativo = pedido.pagamentos.filter(
                situacao__in=(TentativaPagamento.Situacao.PENDENTE, TentativaPagamento.Situacao.PROCESSANDO)
            ).order_by('-criado_em').first()
            if pagamento_ativo and pagamento_ativo.situacao == TentativaPagamento.Situacao.PROCESSANDO:
                raise ErroConflito("Outro pagamento deste pedido esta sendo processado.")
            if (
                pagamento_ativo
                and metodo == "pix"
                and pagamento_ativo.metodo == "pix"
                and pagamento_ativo.pix_expira_em
                and pagamento_ativo.pix_expira_em > timezone.now()
            ):
                return pedido
            ids_pagamentos_pendentes = list(
                pedido.pagamentos.filter(situacao=TentativaPagamento.Situacao.PENDENTE)
                .values_list("pk", flat=True)
            )

            if metodo == "card" and dados["method"] == "debit":
                metodo_pagamento = "debit"
            elif metodo == "card":
                metodo_pagamento = "credit"
            else:
                metodo_pagamento = "pix"

            pagamento = TentativaPagamento.objects.create(
                pedido=pedido,
                provedor=getattr(settings, 'INTEGRACAO_PAGAMENTO', "disabled"),
                metodo=metodo_pagamento,
                situacao=TentativaPagamento.Situacao.PROCESSANDO,
                chave_idempotencia=chave,
                resumo_dados_requisicao=resumo_pagamento,
                valor_centavos=int(pedido.valor_total * 100),
                parcelas=dados.get('parcelas', 1),
            )
            pedido.situacao = Pedido.Situacao.PENDENTE
            pedido.metodo = metodo_pagamento
            pedido.parcelas = pagamento.parcelas
            pedido.save(update_fields=['situacao', 'metodo', 'parcelas', 'atualizado_em'])

    try:
        integracao = integracao or obter_integracao_pagamento()
        for id_pagamento_pendente in ids_pagamentos_pendentes:
            pagamento_pendente = TentativaPagamento.objects.get(pk=id_pagamento_pendente)
            integracao.cancelar(pagamento_pendente)
            with transaction.atomic():
                TentativaPagamento.objects.filter(
                    pk=id_pagamento_pendente,
                    situacao=TentativaPagamento.Situacao.PENDENTE,
                ).update(situacao=TentativaPagamento.Situacao.CANCELADO)
        if metodo == "card":
            resultado = integracao.cobrar_cartao(pedido, dados, chave)
        else:
            resultado = integracao.criar_pix(pedido, chave)
    except ErroIntegracaoPagamento as erro:
        if erro.resultado_desconhecido:
            raise ErroProcessamentoPagamento(str(erro))
        with transaction.atomic():
            pedido = Pedido.objects.select_for_update().get(pk=pedido_id)
            pagamento = TentativaPagamento.objects.select_for_update().get(pk=pagamento.pk)
            pagamento.situacao = TentativaPagamento.Situacao.FALHOU
            pagamento.save(update_fields=['situacao', 'atualizado_em'])
            if pedido.situacao not in (Pedido.Situacao.PAGO, Pedido.Situacao.CANCELADO):
                pedido.situacao = (
                    Pedido.Situacao.PENDENTE
                    if ids_pagamentos_pendentes
                    else Pedido.Situacao.FALHOU
                )
                pedido.save(update_fields=['situacao', 'atualizado_em'])
                _sincronizar_reserva_pedido(pedido)
        raise ErroRegraNegocio({"message": str(erro)})

    with transaction.atomic():
        pedido = Pedido.objects.select_for_update().get(pk=pedido_id)
        pagamento = TentativaPagamento.objects.select_for_update().get(pk=pagamento.pk)
        if pedido.situacao in (Pedido.Situacao.PAGO, Pedido.Situacao.CANCELADO):
            if pedido.situacao == Pedido.Situacao.PAGO and pagamento.situacao == TentativaPagamento.Situacao.PAGO:
                return pedido
            pagamento.situacao = TentativaPagamento.Situacao.CANCELADO
            pagamento.save(update_fields=['situacao', 'atualizado_em'])
            return pedido
        return _aplicar_resultado_pagamento(pedido, pagamento, resultado)


def cancelar_pedido(pedido_id, empresa, *, integracao=None):
    with transaction.atomic():
        try:
            pedido = Pedido.objects.select_for_update().get(pk=pedido_id, empresa_compradora=empresa)
        except Pedido.DoesNotExist:
            raise ErroRegraNegocio({"message": "Pedido nao encontrado."})
        if pedido.situacao == Pedido.Situacao.CANCELADO:
            return pedido
        if pedido.situacao == Pedido.Situacao.PAGO:
            raise ErroConflito("Um pedido pago nao pode ser cancelado por esta operacao.")
        if pedido.situacao == Pedido.Situacao.EXPIRADO and pedido.reserva_expira_em <= timezone.now():
            return pedido
        if pedido.pagamentos.filter(situacao=TentativaPagamento.Situacao.PROCESSANDO).exists():
            raise ErroConflito("Um pagamento esta sendo processado. Aguarde antes de cancelar.")
        pedido.cancelamento_solicitado = True
        pedido.save(update_fields=['cancelamento_solicitado', 'atualizado_em'])
        ids_pagamentos = list(
            pedido.pagamentos.filter(situacao=TentativaPagamento.Situacao.PENDENTE)
            .values_list("pk", flat=True)
        )

    try:
        integracao = integracao or obter_integracao_pagamento()
        for pagamento_id in ids_pagamentos:
            integracao.cancelar(TentativaPagamento.objects.get(pk=pagamento_id))
    except ErroIntegracaoPagamento as erro:
        with transaction.atomic():
            Pedido.objects.filter(pk=pedido_id).update(cancelamento_solicitado=False)
        raise ErroRegraNegocio({"message": str(erro)})

    with transaction.atomic():
        pedido = Pedido.objects.select_for_update().get(pk=pedido_id)
        if pedido.situacao == Pedido.Situacao.PAGO:
            pedido.cancelamento_solicitado = False
            pedido.save(update_fields=['cancelamento_solicitado', 'atualizado_em'])
            return pedido
        TentativaPagamento.objects.filter(
            pk__in=ids_pagamentos,
            situacao=TentativaPagamento.Situacao.PENDENTE,
        ).update(situacao=TentativaPagamento.Situacao.CANCELADO)
        pedido.situacao = Pedido.Situacao.CANCELADO
        pedido.cancelamento_solicitado = False
        pedido.save(update_fields=['situacao', 'cancelamento_solicitado', 'atualizado_em'])
        _sincronizar_reserva_pedido(pedido)
        return pedido


@transaction.atomic
def processar_evento_webhook(provedor, identificador_externo, referencia, situacao_resultado, valor_centavos):
    identificadores = ((provedor, 40), (identificador_externo, 160), (referencia, 160))
    if any(not isinstance(valor, str) or not valor or len(valor) > limite for valor, limite in identificadores):
        raise ErroRegraNegocio({"message": "Identificadores do evento invalidos ou maiores que o limite permitido."})
    if situacao_resultado not in {
        TentativaPagamento.Situacao.PAGO,
        TentativaPagamento.Situacao.FALHOU,
        TentativaPagamento.Situacao.CANCELADO,
        TentativaPagamento.Situacao.EXPIRADO,
    }:
        raise ErroRegraNegocio({"message": "Status de pagamento invalido."})

    evento, criado = EventoWebhook.objects.get_or_create(
        provedor=provedor,
        identificador_externo=identificador_externo,
    )
    if not criado and evento.processado:
        return evento.pagamento.pedido if evento.pagamento_id else None

    pedido_id = TentativaPagamento.objects.filter(
        provedor=provedor,
        referencia_provedor=referencia,
    ).values_list('pedido_id', flat=True).first()
    if pedido_id is None:
        raise ErroRegraNegocio({"message": "Pagamento nao encontrado."})
    pedido = Pedido.objects.select_for_update().get(pk=pedido_id)
    pagamento = TentativaPagamento.objects.select_for_update().get(
        provedor=provedor,
        referencia_provedor=referencia,
        pedido=pedido,
    )
    if pagamento.valor_centavos != valor_centavos:
        raise ErroRegraNegocio({"message": "Valor do evento nao corresponde ao pedido."})
    evento.pagamento = pagamento
    if pedido.situacao not in (Pedido.Situacao.PAGO, Pedido.Situacao.CANCELADO):
        resultado = ResultadoPagamento(
            situacao=situacao_resultado,
            referencia=pagamento.referencia_provedor,
            bandeira_cartao=pagamento.bandeira_cartao,
            final_cartao=pagamento.final_cartao,
        )
        _aplicar_resultado_pagamento(pedido, pagamento, resultado)
    evento.processado = True
    evento.save(update_fields=['pagamento', 'processado'])
    return pedido


def listar_pedidos_compradora(empresa):
    pedidos = list(
        Pedido.objects.filter(empresa_compradora=empresa)
        .prefetch_related(Prefetch(
            'pagamentos',
            queryset=TentativaPagamento.objects.order_by('-criado_em'),
            to_attr='tentativas_pagamento',
        ))
    )
    return [atualizar_situacao_pedido(pedido) for pedido in pedidos]


def obter_pedido_compradora(pedido_id, empresa):
    pedido = Pedido.objects.filter(
        pk=pedido_id,
        empresa_compradora=empresa,
    ).prefetch_related(Prefetch(
        'pagamentos',
        queryset=TentativaPagamento.objects.order_by('-criado_em'),
        to_attr='tentativas_pagamento',
    )).first()
    return atualizar_situacao_pedido(pedido) if pedido else None


@transaction.atomic
def simular_resultado_pagamento(pedido_id, empresa, situacao_resultado):
    if not settings.DEBUG or getattr(settings, 'INTEGRACAO_PAGAMENTO', "disabled") != "sandbox":
        raise ErroConflito("Simulacao disponivel apenas no sandbox local.")
    try:
        pedido = Pedido.objects.select_for_update().get(pk=pedido_id, empresa_compradora=empresa)
    except Pedido.DoesNotExist:
        raise ErroRegraNegocio({"message": "Pedido nao encontrado."})
    _verificar_disponibilidade_pedido(pedido)
    pagamento = pedido.pagamentos.filter(metodo="pix", situacao=TentativaPagamento.Situacao.PENDENTE).first()
    if not pagamento:
        raise ErroConflito("Nao existe um Pix pendente para este pedido.")
    resultado = ResultadoPagamento(
        situacao=situacao_resultado,
        referencia=pagamento.referencia_provedor,
        pix_copia_cola=pagamento.pix_copia_cola,
        pix_expira_em=pagamento.pix_expira_em,
    )
    return _aplicar_resultado_pagamento(pedido, pagamento, resultado)
