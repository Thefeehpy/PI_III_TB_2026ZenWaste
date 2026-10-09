from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from assistente_ia.services import run_freight_recommendation
from transportes.models import (
    DocumentoFrete,
    Entrega,
    HistoricoFrete,
    OportunidadeFrete,
    ProcessoFrete,
    PropostaFrete,
)


@transaction.atomic
def publicar_oportunidade(processo, dados):
    if hasattr(processo, "oportunidade"):
        raise ValidationError("Este processo já possui uma oportunidade publicada.")

    recommendation = run_freight_recommendation(
        {
            "material": processo.material,
            "distanceKm": dados.get("distanceKm", 0),
            "weightTon": processo.peso_ton,
            "cubicMeters": processo.cubagem_m3,
        },
        processo.empresa_solicitante,
    )
    oportunidade = OportunidadeFrete.objects.create(
        processo=processo,
        valor_sugerido=dados.get("suggestedValue") or recommendation["suggestedValue"],
        janela_coleta=dados["pickupWindow"],
        tipo_veiculo=dados.get("vehicleType") or recommendation["vehicleType"],
        observacoes=dados.get("notes", ""),
        score_ambiental=dados.get("environmentalScore", 0),
    )
    processo.atualizar_status(ProcessoFrete.Status.EM_COTACAO)
    HistoricoFrete.objects.create(
        processo=processo,
        autor=processo.empresa_solicitante.razao_social,
        evento="oportunidade_publicada",
        observacao="Oportunidade de transporte publicada para cotação.",
    )
    return oportunidade


@transaction.atomic
def aprovar_proposta(proposta, empresa):
    processo = proposta.oportunidade.processo
    if processo.empresa_solicitante_id != empresa.id_empresa:
        raise ValidationError("A proposta não pertence a um frete desta empresa.")
    if proposta.oportunidade.status in (OportunidadeFrete.Status.ENCERRADA, OportunidadeFrete.Status.CANCELADA):
        raise ValidationError("A oportunidade já foi encerrada.")

    proposta.oportunidade.propostas.exclude(pk=proposta.pk).update(
        status=PropostaFrete.Status.RECUSADA,
        respondida_em=timezone.now(),
    )
    proposta.status = PropostaFrete.Status.APROVADA
    proposta.respondida_em = timezone.now()
    proposta.save(update_fields=["status", "respondida_em"])
    proposta.oportunidade.status = OportunidadeFrete.Status.ENCERRADA
    proposta.oportunidade.encerrada_em = timezone.now()
    proposta.oportunidade.save(update_fields=["status", "encerrada_em"])
    processo.atualizar_status(ProcessoFrete.Status.AGUARDANDO_DOCUMENTO)
    HistoricoFrete.objects.create(
        processo=processo,
        autor=empresa.razao_social,
        evento="proposta_aprovada",
        observacao=f"Proposta da {proposta.transportadora.empresa.razao_social} aprovada.",
    )
    return proposta


@transaction.atomic
def registrar_documento(processo, dados, empresa):
    if processo.empresa_solicitante_id != empresa.id_empresa:
        raise ValidationError("O processo de frete não pertence a esta empresa.")
    documento, _ = DocumentoFrete.objects.update_or_create(
        processo=processo,
        defaults={
            "nome_arquivo": dados["fileName"],
            "numero_cte": dados["cteNumber"],
            "valor_cte": dados["cteValue"],
        },
    )
    aprovada = PropostaFrete.objects.filter(
        oportunidade__processo=processo,
        status=PropostaFrete.Status.APROVADA,
    ).first()
    divergente = bool(aprovada and abs(documento.valor_cte - aprovada.valor) > Decimal("5.00"))
    processo.atualizar_status(
        ProcessoFrete.Status.DIVERGENTE if divergente else ProcessoFrete.Status.EM_TRANSPORTE
    )
    HistoricoFrete.objects.create(
        processo=processo,
        autor=empresa.razao_social,
        evento="cte_recebido",
        observacao=("CT-e recebido com divergência de valor." if divergente else "CT-e recebido e validado."),
    )
    return documento


@transaction.atomic
def criar_entrega(processo, dados, empresa):
    if processo.empresa_solicitante_id != empresa.id_empresa:
        raise ValidationError("O processo de frete não pertence a esta empresa.")
    if hasattr(processo, "entrega"):
        raise ValidationError("Este processo já possui uma entrega.")
    entrega = Entrega.objects.create(processo=processo, **dados)
    HistoricoFrete.objects.create(
        processo=processo,
        autor=empresa.razao_social,
        evento="entrega_criada",
        observacao="Entrega e QR Code do canhoto digital criados.",
    )
    return entrega


@transaction.atomic
def confirmar_entrega(entrega, dados):
    if not entrega.validar_token(dados.get("token")):
        raise ValidationError("Token do QR Code inválido.")
    if not entrega.validar_identidade(dados.get("receiverName"), dados.get("receiverCpf")):
        raise ValidationError("Nome ou CPF não conferem com o recebedor autorizado.")
    confirmado = entrega.confirmar_recebimento(
        nome=dados["receiverName"],
        cpf=dados["receiverCpf"],
        assinatura=dados["signatureData"],
        tipo_recebimento=dados["receiptType"],
        ressalva=dados.get("reservationNote", ""),
    )
    if not confirmado:
        raise ValidationError("A entrega já foi confirmada ou a assinatura está ausente.")
    HistoricoFrete.objects.create(
        processo=entrega.processo,
        autor=entrega.nome_recebedor,
        evento="entrega_confirmada",
        observacao="Canhoto digital assinado e entrega confirmada.",
    )
    return entrega
