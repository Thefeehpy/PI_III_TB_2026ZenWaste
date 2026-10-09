from decimal import Decimal

from rest_framework import serializers

from anuncios.models import Anuncio
from transportes.models import (
    Caminhao,
    DocumentoFrete,
    Entrega,
    HistoricoFrete,
    Motorista,
    OportunidadeFrete,
    ProcessoFrete,
    PropostaFrete,
    Transportadora,
)


class DecimalNumberField(serializers.DecimalField):
    def to_representation(self, value):
        representation = super().to_representation(value)
        return float(representation)


class TransportadoraSerializer(serializers.ModelSerializer):
    razao_social = serializers.CharField(source="empresa.razao_social", read_only=True)
    cnpj = serializers.CharField(source="empresa.cnpj", read_only=True)

    class Meta:
        model = Transportadora
        fields = (
            "id_transportadora", "empresa", "razao_social", "cnpj", "codigo_unidade_sigor", "registro_antt",
            "tipo_transporte", "regioes_atendidas", "tamanho_frota", "custos_por_km", "is_homologada",
            "status_sigor", "transportadora_sugerida", "validado_em", "criado_em", "atualizado_em",
        )
        read_only_fields = (
            "id_transportadora", "empresa", "is_homologada", "status_sigor", "transportadora_sugerida",
            "validado_em", "criado_em", "atualizado_em",
        )


class CaminhaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Caminhao
        fields = (
            "id_caminhao", "transportadora", "placa", "tipo_veiculo", "capacidade_carga_kg",
            "capacidade_volume_m3", "is_ativo", "criado_em",
        )
        read_only_fields = ("id_caminhao", "transportadora", "criado_em")

    def validate_placa(self, value):
        placa = value.upper().replace("-", "").strip()
        if len(placa) != 7 or not placa.isalnum():
            raise serializers.ValidationError("A placa deve ter 7 caracteres alfanuméricos.")
        return placa


class MotoristaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Motorista
        fields = (
            "id_motorista", "transportadora", "funcionario", "nome_completo", "cpf", "cnh", "categoria_cnh",
            "validade_cnh", "telefone", "is_ativo", "criado_em",
        )
        read_only_fields = ("id_motorista", "transportadora", "criado_em")

    def validate_nome_completo(self, value):
        if len(value.strip().split()) < 2:
            raise serializers.ValidationError("Informe nome e sobrenome do motorista.")
        return value.strip()


class HistoricoFreteSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="id_historico", read_only=True)
    at = serializers.DateTimeField(source="criado_em", read_only=True)
    author = serializers.CharField(source="autor")
    note = serializers.CharField(source="observacao")

    class Meta:
        model = HistoricoFrete
        fields = ("id", "at", "author", "evento", "note")


class DocumentoFreteSerializer(serializers.ModelSerializer):
    fileName = serializers.CharField(source="nome_arquivo")
    cteNumber = serializers.CharField(source="numero_cte")
    cteValue = serializers.SerializerMethodField()
    receivedAt = serializers.DateTimeField(source="recebido_em", read_only=True)

    class Meta:
        model = DocumentoFrete
        fields = ("fileName", "cteNumber", "cteValue", "receivedAt")

    def get_cteValue(self, instance):
        return float(instance.valor_cte)


class PropostaFreteSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="id_proposta", read_only=True)
    carrier = serializers.CharField(source="transportadora.empresa.razao_social", read_only=True)
    value = serializers.SerializerMethodField()
    deliveryDays = serializers.IntegerField(source="prazo_entrega_dias")
    note = serializers.CharField(source="observacao", required=False, allow_blank=True)
    approved = serializers.SerializerMethodField()

    class Meta:
        model = PropostaFrete
        fields = ("id", "carrier", "value", "deliveryDays", "note", "approved", "status", "enviada_em")
        read_only_fields = ("id", "carrier", "approved", "status", "enviada_em")

    def get_value(self, instance):
        return float(instance.valor)

    def get_approved(self, instance):
        return instance.status == PropostaFrete.Status.APROVADA


class ProcessoFreteSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="id_processo_frete", read_only=True)
    orderNumber = serializers.CharField(source="numero_pedido")
    adId = serializers.PrimaryKeyRelatedField(
        source="anuncio", queryset=Anuncio.objects.all(), required=False, allow_null=True
    )
    client = serializers.CharField(source="cliente")
    origin = serializers.CharField(source="origem")
    destination = serializers.CharField(source="destino")
    cubicMeters = DecimalNumberField(source="cubagem_m3", max_digits=12, decimal_places=3, min_value=0)
    weightTon = DecimalNumberField(source="peso_ton", max_digits=12, decimal_places=3, min_value=0)
    orderDate = serializers.DateField(source="data_pedido", required=False)
    forecastDate = serializers.DateField(source="previsao_entrega", required=False, allow_null=True)
    source = serializers.CharField(source="fonte", required=False)
    freightMode = serializers.CharField(source="modalidade", required=False)
    noQuoteReason = serializers.CharField(source="motivo_sem_cotacao", required=False, allow_blank=True)
    packageQuantity = serializers.IntegerField(source="quantidade_embalagens", required=False)
    boxDimensionsCm = serializers.JSONField(source="dimensoes_caixa_cm", required=False)
    nfeFileName = serializers.CharField(source="arquivo_nfe", required=False, allow_blank=True)
    pickupRecord = serializers.JSONField(source="registro_coleta", read_only=True)
    quotes = serializers.SerializerMethodField()
    document = serializers.SerializerMethodField()
    treatments = HistoricoFreteSerializer(source="historico", many=True, read_only=True)
    delivery = serializers.SerializerMethodField()

    class Meta:
        model = ProcessoFrete
        fields = (
            "id", "orderNumber", "adId", "client", "material", "origin", "destination", "cubicMeters", "weightTon",
            "orderDate", "forecastDate", "status", "source", "freightMode", "noQuoteReason", "packageQuantity",
            "boxDimensionsCm", "nfeFileName", "pickupRecord", "quotes", "document", "treatments", "delivery",
        )
        read_only_fields = ("id", "status", "pickupRecord", "quotes", "document", "treatments", "delivery")

    def get_quotes(self, instance):
        oportunidade = getattr(instance, "oportunidade", None)
        return PropostaFreteSerializer(oportunidade.propostas.all(), many=True).data if oportunidade else []

    def get_document(self, instance):
        documento = getattr(instance, "documento", None)
        return DocumentoFreteSerializer(documento).data if documento else None

    def get_delivery(self, instance):
        entrega = getattr(instance, "entrega", None)
        return EntregaResumoSerializer(entrega).data if entrega else None


class PublicarOportunidadeSerializer(serializers.Serializer):
    suggestedValue = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False)
    pickupWindow = serializers.CharField(max_length=180)
    vehicleType = serializers.CharField(max_length=100, required=False, allow_blank=True)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True)
    distanceKm = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, default=0)
    environmentalScore = serializers.IntegerField(min_value=0, max_value=100, required=False, default=0)


class OportunidadeFreteSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="id_oportunidade", read_only=True)
    orderNumber = serializers.CharField(source="processo.numero_pedido", read_only=True)
    seller = serializers.CharField(source="processo.empresa_solicitante.razao_social", read_only=True)
    material = serializers.CharField(source="processo.material", read_only=True)
    origin = serializers.CharField(source="processo.origem", read_only=True)
    destination = serializers.CharField(source="processo.destino", read_only=True)
    weightTon = serializers.SerializerMethodField()
    cubicMeters = serializers.SerializerMethodField()
    suggestedValue = serializers.SerializerMethodField()
    deadline = serializers.DateField(source="processo.previsao_entrega", read_only=True)
    pickupWindow = serializers.CharField(source="janela_coleta", read_only=True)
    vehicle = serializers.CharField(source="tipo_veiculo", read_only=True)
    environmentalScore = serializers.IntegerField(source="score_ambiental", read_only=True)
    proposals = serializers.IntegerField(source="propostas.count", read_only=True)

    class Meta:
        model = OportunidadeFrete
        fields = (
            "id", "orderNumber", "seller", "material", "origin", "destination", "weightTon", "cubicMeters",
            "suggestedValue", "deadline", "pickupWindow", "vehicle", "status", "environmentalScore", "proposals",
            "observacoes", "publicada_em",
        )

    def get_weightTon(self, instance):
        return float(instance.processo.peso_ton)

    def get_cubicMeters(self, instance):
        return float(instance.processo.cubagem_m3)

    def get_suggestedValue(self, instance):
        return float(instance.valor_sugerido)


class CriarPropostaSerializer(serializers.Serializer):
    value = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    deliveryDays = serializers.IntegerField(min_value=1, max_value=365)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)


class CriarDocumentoSerializer(serializers.Serializer):
    fileName = serializers.CharField(max_length=255)
    cteNumber = serializers.CharField(max_length=80)
    cteValue = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)


class CriarHistoricoSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=1000)
    event = serializers.CharField(max_length=80, required=False, default="observacao")


class CriarEntregaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Entrega
        fields = (
            "transportadora", "motorista", "caminhao", "endereco", "cidade", "previsao", "numero_nfe",
            "nome_recebedor_autorizado", "cpf_recebedor_autorizado",
        )

    def validate(self, attrs):
        transportadora = attrs["transportadora"]
        motorista = attrs.get("motorista")
        caminhao = attrs.get("caminhao")
        if motorista and motorista.transportadora_id != transportadora.id_transportadora:
            raise serializers.ValidationError({"motorista": "O motorista não pertence à transportadora."})
        if caminhao and caminhao.transportadora_id != transportadora.id_transportadora:
            raise serializers.ValidationError({"caminhao": "O caminhão não pertence à transportadora."})
        return attrs


class EntregaResumoSerializer(serializers.ModelSerializer):
    receiverName = serializers.CharField(source="nome_recebedor", read_only=True)
    confirmedAt = serializers.DateTimeField(source="confirmada_em", read_only=True)
    receiptType = serializers.CharField(source="tipo_recebimento", read_only=True)
    reservationNote = serializers.CharField(source="ressalva", read_only=True)

    class Meta:
        model = Entrega
        fields = ("receiverName", "confirmedAt", "receiptType", "reservationNote", "status")


class EntregaSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="id_entrega", read_only=True)
    orderNumber = serializers.CharField(source="processo.numero_pedido", read_only=True)
    client = serializers.CharField(source="processo.cliente", read_only=True)
    material = serializers.CharField(source="processo.material", read_only=True)
    carrier = serializers.CharField(source="transportadora.empresa.razao_social", read_only=True)
    qrToken = serializers.CharField(source="token_qr", read_only=True)
    authorizedReceiverName = serializers.CharField(source="nome_recebedor_autorizado", read_only=True)
    authorizedReceiverCpf = serializers.CharField(source="cpf_recebedor_autorizado", read_only=True)
    receiverName = serializers.CharField(source="nome_recebedor", read_only=True)
    confirmedAt = serializers.DateTimeField(source="confirmada_em", read_only=True)
    volume = serializers.SerializerMethodField()

    class Meta:
        model = Entrega
        fields = (
            "id", "orderNumber", "client", "material", "carrier", "endereco", "cidade", "previsao", "volume",
            "status", "qrToken", "authorizedReceiverName", "authorizedReceiverCpf", "receiverName", "confirmedAt",
            "numero_nfe",
        )

    def get_volume(self, instance):
        return f"{float(instance.processo.cubagem_m3):g} m³ / {float(instance.processo.peso_ton):g} ton"


class EntregaPublicaSerializer(serializers.ModelSerializer):
    orderNumber = serializers.CharField(source="processo.numero_pedido", read_only=True)
    client = serializers.CharField(source="processo.cliente", read_only=True)
    material = serializers.CharField(source="processo.material", read_only=True)
    carrier = serializers.CharField(source="transportadora.empresa.razao_social", read_only=True)
    destination = serializers.SerializerMethodField()
    forecast = serializers.DateTimeField(source="previsao", read_only=True)
    volume = serializers.SerializerMethodField()
    invoice = serializers.CharField(source="numero_nfe", read_only=True)
    authorizedReceiverCpf = serializers.SerializerMethodField()

    class Meta:
        model = Entrega
        fields = (
            "orderNumber", "client", "material", "carrier", "destination", "forecast", "volume", "invoice",
            "authorizedReceiverCpf", "status",
        )

    def get_destination(self, instance):
        return f"{instance.endereco} - {instance.cidade}"

    def get_volume(self, instance):
        return f"{float(instance.processo.cubagem_m3):g} m³ / {float(instance.processo.peso_ton):g} ton"

    def get_authorizedReceiverCpf(self, instance):
        digits = "".join(character for character in instance.cpf_recebedor_autorizado if character.isdigit())
        return f"{digits[:3]}.***.***-{digits[-2:]}" if len(digits) == 11 else "***"


class ValidarEntregaSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=100)
    receiverName = serializers.CharField(max_length=150)
    receiverCpf = serializers.CharField(max_length=14)


class ConfirmarEntregaSerializer(ValidarEntregaSerializer):
    signatureData = serializers.CharField(max_length=2_000_000, trim_whitespace=False)
    receiptType = serializers.ChoiceField(choices=Entrega.TipoRecebimento.choices)
    reservationNote = serializers.CharField(max_length=1000, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["receiptType"] == Entrega.TipoRecebimento.COM_RESSALVA and not attrs.get("reservationNote", "").strip():
            raise serializers.ValidationError({"reservationNote": "Descreva a ressalva do recebimento."})
        return attrs
