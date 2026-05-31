from django.db.models.signals import pre_save
from django.dispatch import receiver
from dotenv import load_dotenv

from gemini_api.cliente import get_anounce_ai_description, is_ai_available
from .models import Anuncio


load_dotenv()


def build_anuncio_ai_context(anuncio):
    produto = anuncio.produto
    parts = [
        f"Nome: {produto.descricao_produto}",
        f"Tipo: {produto.tipo_produto}",
        f"Quantidade: {anuncio.nr_qtd} {produto.unidade}",
        f"Localizacao: {anuncio.localizacao}" if anuncio.localizacao else "",
    ]
    return "; ".join(part for part in parts if part)


@receiver(pre_save, sender=Anuncio)
def anuncio_pre_save(sender, instance, **kwargs):
    if instance.descricao_especifica or not is_ai_available():
        return

    description = get_anounce_ai_description(build_anuncio_ai_context(instance))
    if description:
        instance.descricao_especifica = description[:500]
