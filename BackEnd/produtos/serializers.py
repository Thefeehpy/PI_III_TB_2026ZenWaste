from decimal import Decimal
from rest_framework import serializers

from anuncios.models import Reserva
from produtos.models import MovimentacaoEstoque, Produto
from produtos.disponibilidade import quantidade_comprometida


class SerializadorProduto(serializers.ModelSerializer):
    """Contrato HTTP legado; alteracoes passam pelos servicos de estoque."""
    status = serializers.CharField(source="situacao", read_only=True)
    tipo_produto = serializers.CharField(max_length=50, required=False)
    unidade = serializers.CharField(max_length=12, required=False)
    nome_residuo = serializers.CharField(max_length=256, required=False)

    class Meta:
        model = Produto
        fields = (
            "id_produto", "nome_residuo", "descricao_produto", "tipo_produto", "unidade",
            "categoria", "unidade_medida", "quantidade", "status", "ativo", "empresa",
            "data_registro", "atualizado_em",
        )
        read_only_fields = (
            "id_produto", "categoria", "unidade_medida", "status", "ativo", "empresa",
            "data_registro", "atualizado_em",
        )

    def validate(self, dados):
        if self.instance is None:
            if not (dados.get("nome_residuo") or dados.get("descricao_produto")):
                raise serializers.ValidationError({"nome_residuo": "Informe o nome do residuo."})
            if not dados.get("tipo_produto"):
                raise serializers.ValidationError({"tipo_produto": "Informe a categoria do residuo."})
        elif "quantidade" in dados and dados["quantidade"] != self.instance.quantidade:
            raise serializers.ValidationError({"quantidade": "Altere o saldo pela rota de movimentacoes."})
        return dados

    def create(self, dados_validados):
        from produtos.servicos import criar_item_estoque

        nome = dados_validados.get("nome_residuo") or dados_validados.get("descricao_produto")
        return criar_item_estoque(dados_validados["empresa"], {
            "name": nome,
            "description": dados_validados.get("descricao_produto", "") if dados_validados.get("nome_residuo") else "",
            "type": dados_validados["tipo_produto"], "unit": dados_validados.get("unidade", "kg"),
            "quantity": dados_validados["quantidade"],
        })

    def update(self, instancia, dados_validados):
        from produtos.servicos import atualizar_item_estoque

        mapa_campos = {"nome_residuo": "name", "descricao_produto": "description", "tipo_produto": "type", "unidade": "unit"}
        return atualizar_item_estoque(instancia, {
            mapa_campos[chave]: valor for chave, valor in dados_validados.items() if chave in mapa_campos
        })


class SerializadorEntradaItemEstoque(serializers.Serializer):
    name = serializers.CharField(max_length=256)
    type = serializers.CharField(max_length=50)
    description = serializers.CharField(max_length=256, required=False, allow_blank=True)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0"))
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True, default="kg")
    targetQuantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0.001"),
        required=False,
        allow_null=True,
    )
    deadline = serializers.DateField(required=False, allow_null=True)


class SerializadorAtualizacaoItemEstoque(serializers.Serializer):
    name = serializers.CharField(max_length=256, required=False)
    type = serializers.CharField(max_length=50, required=False)
    description = serializers.CharField(max_length=256, required=False, allow_blank=True)
    unit = serializers.CharField(max_length=12, required=False, allow_blank=True)
    targetQuantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0.001"),
        required=False,
        allow_null=True,
    )
    deadline = serializers.DateField(required=False, allow_null=True)


class SerializadorEntradaMovimentacaoEstoque(serializers.Serializer):
    type = serializers.ChoiceField(choices=("entrada", "saida"))
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)


class SerializadorEntradaReserva(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    unitPrice = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))
    buyerCompanyId = serializers.IntegerField(min_value=1, required=False)
    buyerName = serializers.CharField(max_length=120, required=False, allow_blank=True)
    buyerPhone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    deadline = serializers.DateField(required=False, allow_null=True)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)


class SerializadorAtualizacaoSituacaoReserva(serializers.Serializer):
    status = serializers.ChoiceField(choices=("em_captacao", "pronta", "finalizada", "cancelada"))


class SerializadorItemEstoque(serializers.ModelSerializer):
    id = serializers.SerializerMethodField(method_name="obter_identificador")
    name = serializers.CharField(source="nome_residuo")
    type = serializers.CharField(source="tipo_produto")
    quantity = serializers.SerializerMethodField(method_name="obter_quantidade")
    description = serializers.CharField(source="descricao_produto")
    committedQuantity = serializers.SerializerMethodField(method_name="obter_quantidade_comprometida")
    availableQuantity = serializers.SerializerMethodField(method_name="obter_quantidade_disponivel")
    unit = serializers.CharField(source="unidade")
    targetQuantity = serializers.SerializerMethodField(method_name="obter_meta_captacao")
    deadline = serializers.SerializerMethodField(method_name="obter_prazo")
    status = serializers.SerializerMethodField(method_name="obter_situacao")
    createdAt = serializers.SerializerMethodField(method_name="obter_cadastrado_em")
    updatedAt = serializers.SerializerMethodField(method_name="obter_atualizado_em")

    class Meta:
        model = Produto
        fields = (
            "id",
            "name",
            "type",
            "quantity",
            "description",
            "committedQuantity",
            "availableQuantity",
            "unit",
            "targetQuantity",
            "deadline",
            "status",
            "createdAt",
            "updatedAt",
        )

    def obter_identificador(self, produto):
        return str(produto.id_produto)

    def obter_quantidade(self, produto):
        return float(produto.quantidade)

    def obter_quantidade_comprometida(self, produto):
        return float(quantidade_comprometida(produto.pk))

    def obter_quantidade_disponivel(self, produto):
        return float(max(Decimal("0"), produto.quantidade - quantidade_comprometida(produto.pk)))

    def obter_meta_captacao(self, produto):
        if hasattr(produto, "_meta_captacao"):
            return float(produto._meta_captacao)

        total = Decimal("0")
        reservas = getattr(produto, "reservas", None)
        if reservas is not None:
            total = sum(
                (reserva.quantidade_reservada for reserva in reservas.filter(modalidade="captacao", situacao__in=("em_captacao", "pronta"))),
                Decimal("0"),
            )

        return float(total)

    def obter_prazo(self, produto):
        if hasattr(produto, "_prazo_captacao") and produto._prazo_captacao:
            return produto._prazo_captacao.isoformat()

        reserva = produto.reservas.filter(
            modalidade="captacao", situacao__in=("em_captacao", "pronta"),
        ).order_by("data_reserva").first()
        if reserva and reserva.prazo_reserva:
            return reserva.prazo_reserva.isoformat()
        if reserva:
            return reserva.data_reserva.date().isoformat()

        return produto.data_registro.isoformat()

    def obter_situacao(self, produto):
        meta_captacao = Decimal(str(self.obter_meta_captacao(produto)))

        if produto.quantidade <= 0:
            return "em_estoque"

        if meta_captacao > 0 and produto.quantidade < meta_captacao:
            return "em_producao"

        return "concluido"

    def obter_cadastrado_em(self, produto):
        return produto.data_registro.isoformat()

    def obter_atualizado_em(self, produto):
        return produto.atualizado_em.isoformat()


class SerializadorMovimentacaoEstoque(serializers.ModelSerializer):
    id = serializers.SerializerMethodField(method_name="obter_identificador")
    itemId = serializers.SerializerMethodField(method_name="obter_identificador_produto")
    itemName = serializers.CharField(source="produto.nome_residuo")
    itemType = serializers.CharField(source="produto.tipo_produto")
    quantity = serializers.SerializerMethodField(method_name="obter_quantidade")
    unit = serializers.CharField(source="produto.unidade")
    note = serializers.CharField(source="observacao")
    createdAt = serializers.SerializerMethodField(method_name="obter_cadastrado_em")
    resultingQuantity = serializers.SerializerMethodField(method_name="obter_saldo_resultante")

    class Meta:
        model = MovimentacaoEstoque
        fields = (
            "id",
            "itemId",
            "itemName",
            "itemType",
            "type",
            "quantity",
            "unit",
            "note",
            "createdAt",
            "resultingQuantity",
        )

    type = serializers.CharField(source="tipo")

    def obter_identificador(self, movimento):
        return str(movimento.id_movimentacao)

    def obter_identificador_produto(self, movimento):
        return str(movimento.produto_id)

    def obter_quantidade(self, movimento):
        return float(movimento.quantidade)

    def obter_cadastrado_em(self, movimento):
        return movimento.criado_em.isoformat()

    def obter_saldo_resultante(self, movimento):
        return float(movimento.saldo_resultante)


class SerializadorReserva(serializers.ModelSerializer):
    status = serializers.CharField(source="situacao", read_only=True)
    id = serializers.SerializerMethodField(method_name="obter_identificador")
    itemId = serializers.SerializerMethodField(method_name="obter_identificador_produto")
    itemName = serializers.CharField(source="produto.nome_residuo")
    itemType = serializers.CharField(source="produto.tipo_produto")
    unit = serializers.CharField(source="produto.unidade")
    currentQuantity = serializers.SerializerMethodField(method_name="obter_saldo_atual")
    missingQuantity = serializers.SerializerMethodField(method_name="obter_quantidade_faltante")
    buyerCompanyId = serializers.IntegerField(source="empresa_compradora_id", allow_null=True, read_only=True)
    orderId = serializers.UUIDField(source="pedido_id", allow_null=True, read_only=True)
    modality = serializers.CharField(source="modalidade", read_only=True)
    buyerName = serializers.CharField(source="nome_comprador")
    buyerPhone = serializers.CharField(source="numero_comprador")
    quantity = serializers.SerializerMethodField(method_name="obter_quantidade")
    unitPrice = serializers.SerializerMethodField(method_name="obter_preco_unitario")
    totalPrice = serializers.SerializerMethodField(method_name="obter_preco_total")
    note = serializers.CharField(source="observacao")
    deadline = serializers.SerializerMethodField(method_name="obter_prazo")
    reservedAt = serializers.SerializerMethodField(method_name="obter_reservado_em")
    finalizedAt = serializers.SerializerMethodField(method_name="obter_finalizado_em")

    class Meta:
        model = Reserva
        fields = (
            "id",
            "itemId",
            "itemName",
            "itemType",
            "unit",
            "currentQuantity",
            "missingQuantity",
            "buyerName",
            "buyerPhone",
            "buyerCompanyId",
            "orderId",
            "modality",
            "quantity",
            "unitPrice",
            "totalPrice",
            "status",
            "note",
            "deadline",
            "reservedAt",
            "finalizedAt",
        )

    def obter_identificador(self, reserva):
        return str(reserva.id_reserva)

    def obter_identificador_produto(self, reserva):
        return str(reserva.produto_id)

    def obter_saldo_atual(self, reserva):
        return float(reserva.produto.quantidade)

    def obter_quantidade_faltante(self, reserva):
        faltante = reserva.quantidade_reservada - reserva.produto.quantidade
        return float(max(faltante, Decimal("0")))

    def obter_quantidade(self, reserva):
        return float(reserva.quantidade_reservada)

    def obter_preco_unitario(self, reserva):
        return float(reserva.preco_unitario)

    def obter_preco_total(self, reserva):
        return float(reserva.quantidade_reservada * reserva.preco_unitario)

    def obter_prazo(self, reserva):
        return reserva.prazo_reserva.isoformat() if reserva.prazo_reserva else ""

    def obter_reservado_em(self, reserva):
        return reserva.data_reserva.isoformat()

    def obter_finalizado_em(self, reserva):
        return reserva.data_finalizacao.isoformat() if reserva.data_finalizacao else ""
