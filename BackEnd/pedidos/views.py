from django.conf import settings
from rest_framework import status as codigos_http
from rest_framework.response import Response

from autenticacao.servicos import VisaoAPIZenWaste, exigir_empresa
from pedidos.integracoes import ErroIntegracaoPagamento, obter_integracao_pagamento
from pedidos.models import Pedido
from pedidos.serializers import (
    SerializadorPagamentoCartao,
    SerializadorCriacaoPedido,
    SerializadorPagamentoPix,
    SerializadorResultadoSimulado,
)
from pedidos.servicos import (
    processar_evento_webhook,
    cancelar_pedido,
    criar_pedido,
    obter_pedido_compradora,
    listar_pedidos_compradora,
    simular_resultado_pagamento,
    iniciar_pagamento,
)


def serializar_pedido(pedido):
    tentativas = getattr(pedido, 'tentativas_pagamento', None)
    pagamento = tentativas[0] if tentativas else pedido.pagamentos.order_by('-criado_em').first()
    metodo = pagamento.metodo if pagamento else pedido.metodo or None
    material = {
        "id": str(pedido.anuncio_id),
        "name": pedido.nome_material_negociado,
        "type": pedido.categoria_material_negociado,
        "description": pedido.descricao_material_negociado,
        "quantity": float(pedido.quantidade),
        "unit": pedido.unidade_material_negociado,
        "price": float(pedido.preco_unitario),
        "location": pedido.localizacao_material_negociado,
        "company": pedido.razao_social_vendedora,
        "imageUrl": pedido.imagem_material_negociado,
    }
    resultado = {
        "id": str(pedido.pk),
        "number": pedido.numero,
        "createdAt": pedido.criado_em.isoformat(),
        "totalCents": int(pedido.valor_total * 100),
        "item": material,
        "quantity": float(pedido.quantidade),
        "buyer": {
            "name": pedido.nome_comprador,
            "email": pedido.email_comprador,
            "document": pedido.documento_comprador,
            "phone": pedido.telefone_comprador,
        },
        "fulfillment": pedido.modalidade_entrega,
        "status": pedido.situacao,
        "installments": pedido.parcelas,
    }
    if pedido.pago_em:
        resultado["paidAt"] = pedido.pago_em.isoformat()
    if metodo:
        resultado["method"] = metodo
    if pagamento and metodo in ("credit", "debit") and (pagamento.bandeira_cartao or pagamento.final_cartao):
        resultado["card"] = {"brand": pagamento.bandeira_cartao, "last4": pagamento.final_cartao}
    if pagamento and metodo == "pix" and pagamento.pix_copia_cola:
        resultado["pix"] = {
            "id": str(pagamento.pk),
            "copyPaste": pagamento.pix_copia_cola,
            "expiresAt": pagamento.pix_expira_em.isoformat() if pagamento.pix_expira_em else "",
        }
    return resultado


def _obter_pedido_autorizado(requisicao, pk):
    empresa, erro = exigir_empresa(requisicao)
    if erro:
        return None, None, erro
    pedido = obter_pedido_compradora(pk, empresa)
    if not pedido:
        return empresa, None, Response(
            {"message": "Pedido nao encontrado."},
            status=codigos_http.HTTP_404_NOT_FOUND,
        )
    return empresa, pedido, None


class VisaoAPIPedidos(VisaoAPIZenWaste):
    def get(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro
        pedidos = listar_pedidos_compradora(empresa)
        return Response({"items": [serializar_pedido(pedido) for pedido in pedidos]})

    def post(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro
        serializador = SerializadorCriacaoPedido(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        pedido = criar_pedido(
            empresa,
            serializador.validated_data,
            requisicao.headers.get("Idempotency-Key"),
        )
        return Response(serializar_pedido(pedido), status=codigos_http.HTTP_201_CREATED)


class VisaoAPIDetalhePedido(VisaoAPIZenWaste):
    def get(self, requisicao, pk):
        _, pedido, erro = _obter_pedido_autorizado(requisicao, pk)
        if erro:
            return erro
        return Response(serializar_pedido(pedido))


class VisaoAPIPagamentoCartao(VisaoAPIZenWaste):
    def post(self, requisicao, pk):
        empresa, _, erro = _obter_pedido_autorizado(requisicao, pk)
        if erro:
            return erro
        serializador = SerializadorPagamentoCartao(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        pedido = iniciar_pagamento(
            pk,
            empresa,
            "card",
            serializador.validated_data,
            requisicao.headers.get("Idempotency-Key"),
        )
        return Response(serializar_pedido(pedido))


class VisaoAPIPagamentoPix(VisaoAPIZenWaste):
    def post(self, requisicao, pk):
        empresa, _, erro = _obter_pedido_autorizado(requisicao, pk)
        if erro:
            return erro
        serializador = SerializadorPagamentoPix(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        pedido = iniciar_pagamento(
            pk,
            empresa,
            "pix",
            serializador.validated_data,
            requisicao.headers.get("Idempotency-Key"),
        )
        return Response(serializar_pedido(pedido))


class VisaoAPICancelamentoPedido(VisaoAPIZenWaste):
    def post(self, requisicao, pk):
        empresa, _, erro = _obter_pedido_autorizado(requisicao, pk)
        if erro:
            return erro
        pedido = cancelar_pedido(pk, empresa)
        return Response(serializar_pedido(pedido))


class VisaoAPISimulacaoPagamento(VisaoAPIZenWaste):
    def post(self, requisicao, pk):
        empresa, _, erro = _obter_pedido_autorizado(requisicao, pk)
        if erro:
            return erro
        serializador = SerializadorResultadoSimulado(data=requisicao.data)
        serializador.is_valid(raise_exception=True)
        pedido = simular_resultado_pagamento(pk, empresa, serializador.validated_data["result"])
        return Response(serializar_pedido(pedido))


class VisaoAPINotificacaoPagamento(VisaoAPIZenWaste):
    authentication_classes = []
    permission_classes = []

    def post(self, requisicao, provedor):
        segredo = getattr(settings, 'SEGREDO_NOTIFICACAO_PAGAMENTO', "")
        assinatura = requisicao.headers.get("X-Payment-Signature", "")
        if not segredo:
            return Response(
                {"message": "Webhook nao configurado."},
                status=codigos_http.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            integracao = obter_integracao_pagamento()
            conteudo = integracao.validar_notificacao(requisicao.body, assinatura)
        except ErroIntegracaoPagamento as erro:
            return Response({"message": str(erro)}, status=codigos_http.HTTP_401_UNAUTHORIZED)

        campos_textuais = ("eventId", "paymentReference", "status")
        if (
            any(not isinstance(conteudo.get(campo), str) or not conteudo[campo] for campo in campos_textuais)
            or not isinstance(conteudo.get("amountCents"), int)
            or isinstance(conteudo.get("amountCents"), bool)
            or conteudo["amountCents"] <= 0
        ):
            return Response({"message": "Evento incompleto."}, status=codigos_http.HTTP_400_BAD_REQUEST)

        if conteudo.get("currency", "BRL") != "BRL":
            return Response({"message": "Moeda do evento invalida."}, status=codigos_http.HTTP_400_BAD_REQUEST)

        if provedor != getattr(settings, 'INTEGRACAO_PAGAMENTO', "disabled"):
            return Response({"message": "Provedor nao habilitado."}, status=codigos_http.HTTP_404_NOT_FOUND)
        pedido = processar_evento_webhook(
            provedor,
            conteudo["eventId"],
            conteudo["paymentReference"],
            conteudo["status"],
            conteudo["amountCents"],
        )
        return Response({"received": True, "orderId": str(pedido.pk) if pedido else None})
