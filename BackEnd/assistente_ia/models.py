from django.db import models


class AssistenteIA(models.Model):
    """Registra uma execução auditável do assistente da ZenWaste."""

    class Status(models.TextChoices):
        PENDENTE = "pendente", "Pendente"
        PROCESSANDO = "processando", "Processando"
        CONCLUIDA = "concluida", "Concluída"
        FALLBACK = "fallback", "Fallback local"
        ERRO = "erro", "Erro"

    class Fonte(models.TextChoices):
        IA = "ai", "Inteligência artificial"
        FALLBACK = "fallback", "Regra local"

    id_assistente_ia = models.BigAutoField(primary_key=True)
    empresa = models.ForeignKey(
        "empresas.Empresa",
        on_delete=models.CASCADE,
        related_name="consultas_ia",
        null=True,
        blank=True,
    )
    produto = models.ForeignKey(
        "produtos.Produto",
        on_delete=models.SET_NULL,
        related_name="consultas_ia",
        null=True,
        blank=True,
    )
    anuncio = models.ForeignKey(
        "anuncios.Anuncio",
        on_delete=models.SET_NULL,
        related_name="consultas_ia",
        null=True,
        blank=True,
    )
    sugestao_preco = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    sugestao_descricao = models.CharField(max_length=500, blank=True)
    recomendacao_frete = models.TextField(blank=True)
    status_ia = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDENTE)
    fonte = models.CharField(max_length=12, choices=Fonte.choices, default=Fonte.FALLBACK)
    contexto = models.JSONField(default=dict, blank=True)
    mensagem = models.CharField(max_length=500, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "execução do assistente de IA"
        verbose_name_plural = "execuções do assistente de IA"

    def __str__(self):
        return f"Assistente IA #{self.pk} - {self.status_ia}"

    def analisar_mercado(self, dados=None):
        from assistente_ia.engine import analyze_market

        return analyze_market(dados or self.contexto)

    def sugerir_preco(self, dados=None):
        from assistente_ia.engine import suggest_ad_price

        resultado = suggest_ad_price(dados or self.contexto)
        self.sugestao_preco = resultado["suggestedPrice"]
        self._aplicar_resultado(resultado)
        return self.sugestao_preco

    def sugerir_descricao(self, dados=None):
        from assistente_ia.engine import suggest_ad_description

        resultado = suggest_ad_description(dados or self.contexto)
        self.sugestao_descricao = resultado["description"]
        self._aplicar_resultado(resultado)
        return self.sugestao_descricao

    def recomendar_frete(self, dados=None):
        from assistente_ia.engine import recommend_freight

        resultado = recommend_freight(dados or self.contexto)
        self.recomendacao_frete = resultado["recommendation"]
        self._aplicar_resultado(resultado)
        return self.recomendacao_frete

    def _aplicar_resultado(self, resultado):
        self.fonte = resultado.get("source", self.Fonte.FALLBACK)
        self.status_ia = self.Status.CONCLUIDA if self.fonte == self.Fonte.IA else self.Status.FALLBACK
        self.mensagem = resultado.get("message", "")[:500]
        if self.pk:
            self.save()
