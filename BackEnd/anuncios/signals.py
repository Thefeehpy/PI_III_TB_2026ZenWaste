import os

from django.db.models.signals import pre_save
from django.dispatch import receiver
from dotenv import load_dotenv

from gemini_api.cliente import get_anounce_ai_description
from .models import Anuncio


load_dotenv()
api_key = os.getenv("API_KEY", "")


@receiver(pre_save, sender=Anuncio)
def anuncio_pre_save(sender, instance, **kwargs):
    if instance.descricao_especifica or not api_key:
        return

    description = get_anounce_ai_description(instance.produto.descricao_produto)
    if description:
        instance.descricao_especifica = description[:500]
