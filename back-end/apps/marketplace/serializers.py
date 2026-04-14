from urllib.parse import quote

from apps.inventory.serializers import decimal_to_number

from .models import Anuncio


DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=400&h=300&fit=crop"


def digits_only(value: str) -> str:
    return "".join(character for character in value if character.isdigit())


def build_whatsapp_url(ad: Anuncio) -> str:
    message = quote(f'Ola! Vi o anuncio "{ad.produto.nome_residuo}" na ZenWaste e tenho interesse. Podemos negociar?')
    phone = digits_only(ad.produto.empresa.telefone_whatsapp)
    if phone:
        if not phone.startswith("55"):
            phone = "55" + phone
        return f"https://wa.me/{phone}?text={message}"
    return f"https://wa.me/?text={message}"


def serialize_ad(ad: Anuncio) -> dict:
    cover = ad.produto.imagens.filter(eh_capa=True).first() or ad.produto.imagens.first()

    return {
        "id": str(ad.id_anuncio),
        "name": ad.produto.nome_residuo,
        "type": ad.produto.categoria_residuo.nome_material,
        "description": ad.descricao_especifico,
        "quantity": decimal_to_number(ad.nr_qntd),
        "unit": ad.produto.unidade.sigla_unidade,
        "price": decimal_to_number(ad.preco_final),
        "location": "Nao informado",
        "company": ad.produto.empresa.razao_social,
        "imageUrl": cover.url_arquivo if cover else DEFAULT_IMAGE_URL,
        "createdAt": ad.data_publicacao.isoformat(),
        "contactPhone": ad.produto.empresa.telefone_whatsapp,
        "whatsappUrl": build_whatsapp_url(ad),
    }
