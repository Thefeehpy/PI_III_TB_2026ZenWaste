from rest_framework import status
from rest_framework.response import Response

from autenticacao.servicos import VisaoAPIZenWaste, gerar_token, exigir_empresa, dados_empresa
from empresas.models import Empresa
from empresas.serializers import SerializadorEmpresa
from empresas.servicos import autenticar_empresa
from acesso.serializers import SerializadorAcesso, SerializadorRecuperacaoSenha


class VisaoAPICadastroEmpresa(VisaoAPIZenWaste):
    def post(self, requisicao):
        serializador = SerializadorEmpresa(data={
            "razao_social": requisicao.data.get("razaoSocial"),
            "cnpj": requisicao.data.get("cnpj"),
            "descricao_segmento": requisicao.data.get("segmento", ""),
            "email": requisicao.data.get("email"),
            "telefone_whatsapp": requisicao.data.get("telefone"),
            "senha": requisicao.data.get("password"),
        })
        serializador.is_valid(raise_exception=True)
        empresa = serializador.save()

        return Response({"user": dados_empresa(empresa)}, status=status.HTTP_201_CREATED)


class VisaoAPIAcesso(VisaoAPIZenWaste):
    def post(self, requisicao):
        serializador = SerializadorAcesso(data=requisicao.data)
        serializador.is_valid(raise_exception=True)

        email = serializador.validated_data["email"].strip().lower()
        senha = serializador.validated_data["password"]

        empresa = autenticar_empresa(email, senha)
        if empresa is None:
            return Response({"message": "E-mail ou senha inválidos."}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({"token": gerar_token(empresa), "user": dados_empresa(empresa)})


class VisaoAPIPerfil(VisaoAPIZenWaste):
    def get(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        return Response({"user": dados_empresa(empresa)})

    def patch(self, requisicao):
        empresa, erro = exigir_empresa(requisicao)
        if erro:
            return erro

        mapa_campos = {
            "razaoSocial": "razao_social",
            "cnpj": "cnpj",
            "segmento": "descricao_segmento",
            "email": "email",
            "telefone": "telefone_whatsapp",
            "password": "senha",
        }
        dados = {
            campo_modelo: requisicao.data.get(campo_requisicao)
            for campo_requisicao, campo_modelo in mapa_campos.items()
            if campo_requisicao in requisicao.data
        }

        serializador = SerializadorEmpresa(empresa, data=dados, partial=True)
        serializador.is_valid(raise_exception=True)
        empresa = serializador.save()

        return Response({"user": dados_empresa(empresa)})


class VisaoAPIRecuperacaoSenha(VisaoAPIZenWaste):
    def post(self, requisicao):
        serializador = SerializadorRecuperacaoSenha(data=requisicao.data)
        serializador.is_valid(raise_exception=True)

        Empresa.objects.filter(email__iexact=serializador.validated_data["email"]).exists()

        return Response({
            "message": "Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.",
        })


class VisaoAPISaida(VisaoAPIZenWaste):
    def post(self, requisicao):
        return Response({"message": "Logout realizado com sucesso."})


class VisaoAcessoLegado(VisaoAPIZenWaste):
    def post(self, requisicao):
        serializador = SerializadorAcesso(data=requisicao.data)
        serializador.is_valid(raise_exception=True)

        email = serializador.validated_data["email"].strip().lower()
        senha = serializador.validated_data["password"]

        empresa = autenticar_empresa(email, senha)
        if empresa is None:
            return Response({"message": "E-mail ou senha inválidos."}, status=status.HTTP_401_UNAUTHORIZED)

        return Response(
            {
                "message": "Login realizado com sucesso.",
                "empresa": dados_empresa(empresa),
            },
            status=status.HTTP_200_OK,
        )
