from rest_framework import status
from rest_framework.response import Response

from authentication.services import ZenWasteAPIView, make_token, require_empresa, user_payload
from empresas.models import Empresa
from empresas.serializers import EmpresaSerializer
from login.serializers import LoginSerializer, PasswordRecoverySerializer


class RegisterAPIView(ZenWasteAPIView):
    def post(self, request):
        serializer = EmpresaSerializer(data={
            "razao_social": request.data.get("razaoSocial"),
            "cnpj": request.data.get("cnpj"),
            "descricao_segmento": request.data.get("segmento", ""),
            "email": request.data.get("email"),
            "telefone_whatsapp": request.data.get("telefone"),
            "senha": request.data.get("password"),
        })
        serializer.is_valid(raise_exception=True)
        empresa = serializer.save()

        return Response({"user": user_payload(empresa)}, status=status.HTTP_201_CREATED)


class LoginAPIView(ZenWasteAPIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]

        try:
            empresa = Empresa.objects.get(email__iexact=email)
        except Empresa.DoesNotExist:
            return Response({"message": "E-mail ou senha invalidos."}, status=status.HTTP_401_UNAUTHORIZED)

        if not empresa.validar_senha(password):
            return Response({"message": "E-mail ou senha invalidos."}, status=status.HTTP_401_UNAUTHORIZED)

        if empresa.senha == password:
            empresa.definir_senha(password)
            empresa.save(update_fields=["senha"])

        return Response({"token": make_token(empresa), "user": user_payload(empresa)})


class MeAPIView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error

        return Response({"user": user_payload(empresa)})

    def patch(self, request):
        empresa, error = require_empresa(request)
        if error:
            return error

        field_map = {
            "razaoSocial": "razao_social",
            "cnpj": "cnpj",
            "segmento": "descricao_segmento",
            "email": "email",
            "telefone": "telefone_whatsapp",
            "password": "senha",
        }
        data = {
            model_field: request.data.get(request_field)
            for request_field, model_field in field_map.items()
            if request_field in request.data
        }

        serializer = EmpresaSerializer(empresa, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        empresa = serializer.save()

        return Response({"user": user_payload(empresa)})


class PasswordRecoveryAPIView(ZenWasteAPIView):
    def post(self, request):
        serializer = PasswordRecoverySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        Empresa.objects.filter(email__iexact=serializer.validated_data["email"]).exists()

        return Response({
            "message": "Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao.",
        })


class LogoutAPIView(ZenWasteAPIView):
    def post(self, request):
        return Response({"message": "Logout realizado com sucesso."})


class LoginView(ZenWasteAPIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]

        try:
            empresa = Empresa.objects.get(email__iexact=email)
        except Empresa.DoesNotExist:
            return Response({"message": "E-mail ou senha invalidos."}, status=status.HTTP_401_UNAUTHORIZED)

        if not empresa.validar_senha(password):
            return Response({"message": "E-mail ou senha invalidos."}, status=status.HTTP_401_UNAUTHORIZED)

        if empresa.senha == password:
            empresa.definir_senha(password)
            empresa.save(update_fields=["senha"])

        return Response(
            {
                "message": "Login realizado com sucesso.",
                "empresa": user_payload(empresa),
            },
            status=status.HTTP_200_OK,
        )
