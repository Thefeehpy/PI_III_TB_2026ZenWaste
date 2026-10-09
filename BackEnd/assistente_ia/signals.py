from django.db.models.signals import pre_save
from django.dispatch import receiver

from anuncios.models import Anuncio
from assistente_ia.engine import build_ad_context
from assistente_ia.providers import IAServiceManager


@receiver(pre_save, sender=Anuncio)
def preencher_descricao_do_anuncio(sender, instance, **kwargs):
    manager = IAServiceManager()
    if instance.descricao_especifica or not manager.is_ai_available():
        return
    data = {
        "name": instance.produto.descricao_produto,
        "type": instance.produto.tipo_produto,
        "quantity": instance.nr_qtd,
        "unit": instance.produto.unidade,
        "location": instance.localizacao,
    }
    description = manager.get_anounce_ai_description(build_ad_context(data))
    if description:
        instance.descricao_especifica = description[:500]
