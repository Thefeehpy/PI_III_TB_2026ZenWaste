from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from authentication.services import make_token
from empresas.models import Empresa
from transportes.models import Entrega, ProcessoFrete, Transportadora


def empresa(numero, nome):
    return Empresa.objects.create(
        cnpj=numero,
        razao_social=nome,
        telefone_whatsapp=f"1199999{numero[:4]}",
        email=f"{numero[:4]}@zenwaste.test",
        senha="hash",
    )


class TransportadoraDomainTests(TestCase):
    def setUp(self):
        self.empresa = empresa("44555666000190", "Rota Circular")
        self.transportadora = Transportadora.objects.create(
            empresa=self.empresa,
            codigo_unidade_sigor="SIGOR-123",
            custos_por_km={"vidro": "7.10"},
        )

    def test_validar_credenciais_sigor_updates_homologation(self):
        self.assertTrue(self.transportadora.validar_credenciais_sigor())
        self.transportadora.refresh_from_db()
        self.assertTrue(self.transportadora.is_homologada)
        self.assertEqual(self.transportadora.status_sigor, Transportadora.StatusSigor.VALIDADO)

    def test_registers_driver_and_truck_through_domain_methods(self):
        motorista = self.transportadora.cadastrar_motorista(
            nome_completo="Ana Pereira",
            cpf="123.456.789-01",
            cnh="CNH123456",
        )
        caminhao = self.transportadora.cadastrar_caminhao(
            placa="abc1d23",
            capacidade_carga_kg=Decimal("8000"),
        )

        self.assertEqual(motorista.transportadora, self.transportadora)
        self.assertEqual(caminhao.placa, "ABC1D23")
        self.assertEqual(self.transportadora.custo_por_km("Vidro industrial"), Decimal("7.10"))


class EntregaDomainTests(TestCase):
    def setUp(self):
        solicitante = empresa("77888999000180", "Indústria Verde")
        carrier_company = empresa("66777888000170", "Transportes Verdes")
        self.transportadora = Transportadora.objects.create(empresa=carrier_company)
        self.processo = ProcessoFrete.objects.create(
            empresa_solicitante=solicitante,
            numero_pedido="5842",
            cliente="Cliente A",
            material="Plástico",
            origem="São Paulo - SP",
            destino="Curitiba - PR",
            cubagem_m3=Decimal("24"),
            peso_ton=Decimal("6.5"),
        )
        self.entrega = Entrega.objects.create(
            processo=self.processo,
            transportadora=self.transportadora,
            endereco="Av. das Indústrias, 420",
            cidade="Curitiba - PR",
            nome_recebedor_autorizado="Maria Souza",
            cpf_recebedor_autorizado="123.456.789-01",
        )

    def test_qr_token_and_identity_guard_delivery_confirmation(self):
        self.assertTrue(self.entrega.validar_token(self.entrega.token_qr))
        self.assertTrue(self.entrega.validar_identidade(" maria  souza ", "12345678901"))
        self.assertFalse(self.entrega.validar_identidade("Outra Pessoa", "12345678901"))

        self.assertTrue(
            self.entrega.confirmar_recebimento(
                nome="Maria Souza",
                cpf="123.456.789-01",
                assinatura="data:image/png;base64,AAAA",
                tipo_recebimento=Entrega.TipoRecebimento.COMPLETO,
            )
        )
        self.processo.refresh_from_db()
        self.assertEqual(self.processo.status, ProcessoFrete.Status.ENTREGUE)

    def test_reservation_requires_note(self):
        with self.assertRaises(ValidationError):
            self.entrega.confirmar_recebimento(
                nome="Maria Souza",
                cpf="123.456.789-01",
                assinatura="assinatura",
                tipo_recebimento=Entrega.TipoRecebimento.COM_RESSALVA,
            )


class TransportesApiContractTests(TestCase):
    def test_marketplace_can_create_and_publish_freight_process(self):
        solicitante = empresa("99000111000165", "Marketplace Circular")
        authorization = f"Bearer {make_token(solicitante)}"

        response = self.client.post(
            "/api/transportes/fretes/",
            data={
                "orderNumber": "AD-101",
                "client": "Comprador a definir",
                "material": "Papel",
                "origin": "São Paulo - SP",
                "destination": "Campinas - SP",
                "cubicMeters": 10,
                "weightTon": 2.5,
                "source": "marketplace",
                "freightMode": "quote",
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=authorization,
        )

        self.assertEqual(response.status_code, 201, response.json())
        process_id = response.json()["id"]

        publish_response = self.client.post(
            f"/api/transportes/fretes/{process_id}/publicar/",
            data={
                "suggestedValue": 480,
                "pickupWindow": "Até dois dias",
                "vehicleType": "VUC",
                "distanceKm": 80,
            },
            content_type="application/json",
            HTTP_AUTHORIZATION=authorization,
        )

        self.assertEqual(publish_response.status_code, 201, publish_response.json())
        self.assertEqual(publish_response.json()["orderNumber"], "AD-101")
        self.assertEqual(publish_response.json()["suggestedValue"], 480.0)
