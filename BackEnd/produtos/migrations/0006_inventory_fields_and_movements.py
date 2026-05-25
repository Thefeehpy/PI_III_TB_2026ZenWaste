# Generated for ZenWaste inventory API.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('empresas', '0001_initial'),
        ('produtos', '0005_alter_produto_empresa'),
    ]

    operations = [
        migrations.AlterField(
            model_name='produto',
            name='tipo_produto',
            field=models.CharField(max_length=50),
        ),
        migrations.AlterField(
            model_name='produto',
            name='status',
            field=models.CharField(default='em_estoque', max_length=20),
        ),
        migrations.AlterField(
            model_name='produto',
            name='empresa',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='produtos', to='empresas.empresa'),
        ),
        migrations.AddField(
            model_name='produto',
            name='unidade',
            field=models.CharField(default='kg', max_length=12),
        ),
        migrations.AddField(
            model_name='produto',
            name='meta_quantidade',
            field=models.DecimalField(decimal_places=3, default=1, max_digits=10),
        ),
        migrations.AddField(
            model_name='produto',
            name='prazo_meta',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='produto',
            name='atualizado_em',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.CreateModel(
            name='MovimentacaoEstoque',
            fields=[
                ('id_movimentacao', models.AutoField(primary_key=True, serialize=False)),
                ('tipo', models.CharField(choices=[('entrada', 'Entrada'), ('saida', 'Saida')], max_length=8)),
                ('quantidade', models.DecimalField(decimal_places=3, max_digits=10)),
                ('observacao', models.CharField(blank=True, max_length=255)),
                ('saldo_resultante', models.DecimalField(decimal_places=3, max_digits=10)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='movimentacoes_estoque', to='empresas.empresa')),
                ('produto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='movimentacoes', to='produtos.produto')),
            ],
            options={
                'ordering': ['-criado_em'],
            },
        ),
    ]
