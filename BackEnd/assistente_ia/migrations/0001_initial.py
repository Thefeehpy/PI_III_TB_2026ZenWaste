import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("empresas", "0002_funcionario"),
        ("produtos", "0007_remove_produto_meta"),
        ("anuncios", "0008_alter_anuncio_imagem_url"),
    ]
    operations = [
        migrations.CreateModel(
            name="AssistenteIA",
            fields=[
                ("id_assistente_ia", models.BigAutoField(primary_key=True, serialize=False)),
                ("sugestao_preco", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("sugestao_descricao", models.CharField(blank=True, max_length=500)),
                ("recomendacao_frete", models.TextField(blank=True)),
                ("status_ia", models.CharField(choices=[("pendente", "Pendente"), ("processando", "Processando"), ("concluida", "Concluída"), ("fallback", "Fallback local"), ("erro", "Erro")], default="pendente", max_length=20)),
                ("fonte", models.CharField(choices=[("ai", "Inteligência artificial"), ("fallback", "Regra local")], default="fallback", max_length=12)),
                ("contexto", models.JSONField(blank=True, default=dict)),
                ("mensagem", models.CharField(blank=True, max_length=500)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                ("anuncio", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="consultas_ia", to="anuncios.anuncio")),
                ("empresa", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="consultas_ia", to="empresas.empresa")),
                ("produto", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="consultas_ia", to="produtos.produto")),
            ],
            options={"ordering": ["-criado_em"], "verbose_name": "execução do assistente de IA", "verbose_name_plural": "execuções do assistente de IA"},
        ),
    ]
