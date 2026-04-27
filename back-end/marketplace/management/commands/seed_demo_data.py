from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import Empresa
from inventory.models import CategoriaResiduo, Produto, Reserva, UnidadeMedida
from market.pricing import suggest_price
from marketplace.models import Anuncio, ImagemAnuncio


class Command(BaseCommand):
    help = "Cria empresas, produtos e anuncios demonstrativos para o marketplace ZenWaste."

    demo_ads = [
        {
            "razao_social": "IndPack Ltda.",
            "cnpj": "11222333000181",
            "segmento": "Embalagens",
            "telefone": "11999990001",
            "name": "Aparas de Polietileno PEAD",
            "waste_type": "Plastico Industrial",
            "description": "Aparas limpas de polietileno de alta densidade, prensadas e prontas para reciclagem.",
            "quantity": Decimal("5000.00"),
            "unit": "kg",
            "price": Decimal("2.80"),
            "location": "Sao Paulo - SP",
            "image_url": "https://images.unsplash.com/photo-1572204292164-b35ba943fca7?w=400&h=300&fit=crop",
        },
        {
            "razao_social": "MetalForge S.A.",
            "cnpj": "22333444000181",
            "segmento": "Metalurgia",
            "telefone": "19999990002",
            "name": "Sucata de Aco Inox 304",
            "waste_type": "Sucata Metalica",
            "description": "Retalhos e aparas de aco inoxidavel 304 provenientes de estamparia, sem contaminacao.",
            "quantity": Decimal("2000.00"),
            "unit": "kg",
            "price": Decimal("8.50"),
            "location": "Campinas - SP",
            "image_url": "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
        },
        {
            "razao_social": "LogBox Embalagens",
            "cnpj": "33444555000181",
            "segmento": "Papel e Celulose",
            "telefone": "41999990003",
            "name": "Papelao Ondulado OCC",
            "waste_type": "Papel e Papelao",
            "description": "Fardos de papelao ondulado pos-consumo industrial, prensados e limpos.",
            "quantity": Decimal("10000.00"),
            "unit": "kg",
            "price": Decimal("0.45"),
            "location": "Curitiba - PR",
            "image_url": "https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=400&h=300&fit=crop",
        },
    ]

    def handle(self, *args, **options):
        User = get_user_model()
        created_ads = 0

        with transaction.atomic():
            for ad_data in self.demo_ads:
                email = f"demo+{ad_data['cnpj']}@zenwaste.local"
                user, _created = User.objects.get_or_create(username=email, defaults={"email": email})
                if not user.check_password("zenwaste123"):
                    user.set_password("zenwaste123")
                    user.save(update_fields=["password"])

                company, _created = Empresa.objects.get_or_create(
                    cnpj=ad_data["cnpj"],
                    defaults={
                        "user": user,
                        "razao_social": ad_data["razao_social"],
                        "descricao_segmento": ad_data["segmento"],
                        "telefone_whatsapp": ad_data["telefone"],
                    },
                )
                category, _created = CategoriaResiduo.objects.get_or_create(nome_material=ad_data["waste_type"])
                unit, _created = UnidadeMedida.objects.get_or_create(
                    sigla_unidade=ad_data["unit"],
                    defaults={"descricao_unidade": ad_data["unit"]},
                )
                reserve, _created = Reserva.objects.get_or_create(
                    status_meta="em_aberto",
                    qntd_reserva=ad_data["quantity"],
                    venda=None,
                )
                product, _created = Produto.objects.get_or_create(
                    empresa=company,
                    nome_residuo=ad_data["name"],
                    defaults={
                        "categoria_residuo": category,
                        "unidade": unit,
                        "quantidade_total": ad_data["quantity"],
                        "reserva": reserve,
                    },
                )

                ad, created = Anuncio.objects.get_or_create(
                    produto=product,
                    defaults={
                        "preco_sugerido_ia": Decimal(str(suggest_price(ad_data["waste_type"]))).quantize(Decimal("0.01")),
                        "preco_final": ad_data["price"],
                        "descricao_especifico": ad_data["description"],
                        "nr_qntd": ad_data["quantity"],
                        "localizacao": ad_data["location"],
                    },
                )
                ImagemAnuncio.objects.get_or_create(
                    produto=product,
                    eh_capa=True,
                    defaults={"url_arquivo": ad_data["image_url"]},
                )
                if ad.status_anuncio != Anuncio.STATUS_ATIVO:
                    ad.status_anuncio = Anuncio.STATUS_ATIVO
                    ad.save(update_fields=["status_anuncio"])
                if created:
                    created_ads += 1

        self.stdout.write(self.style.SUCCESS(f"Seed concluido. Anuncios criados: {created_ads}"))
