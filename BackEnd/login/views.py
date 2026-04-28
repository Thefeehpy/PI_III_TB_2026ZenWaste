from django.shortcuts import render
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from empresas.models import Empresa
from login.serializers import LoginSerializer

class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]

        try:
            empresa = Empresa.objects.get(email__iexact=email)
        except Empresa.DoesNotExist:
            return Response(
                {"message": "E-mail ou senha inválidos."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not empresa.validar_senha(password):
            return Response(
                {"message": "E-mail ou senha inválidos."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if empresa.senha == password:
            empresa.definir_senha(password)
            empresa.save(update_fields=["senha"])

        return Response(
            {
                "message": "Login realizado com sucesso.",
                "empresa": {
                    "id": str(empresa.id_empresa),
                    "razaoSocial": empresa.razao_social,
                    "cnpj": empresa.cnpj,
                    "segmento": empresa.descricao_segmento,
                    "email": empresa.email,
                    "telefone": empresa.telefone_whatsapp,
                },
            },
            status=status.HTTP_200_OK,
        )

