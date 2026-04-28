from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.views import endpoint_index
from accounts.models import Empresa
from accounts.serializers import EmpresaSerializer, LoginSerializer, ProfileUpdateSerializer, RegisterSerializer


class AuthIndexView(APIView):
    def get(self, request):
        return endpoint_index(
            "ZenWaste Auth API",
            [
                {"method": "POST", "path": "/api/auth/register/", "description": "Cadastro de empresa com CNPJ valido."},
                {"method": "POST", "path": "/api/auth/login/", "description": "Login; retorna token Bearer."},
                {"method": "GET", "path": "/api/auth/me/", "description": "Perfil da empresa autenticada."},
                {"method": "PATCH", "path": "/api/auth/me/", "description": "Atualiza perfil da empresa autenticada."},
                {"method": "POST", "path": "/api/auth/logout/", "description": "Encerra o token atual."},
            ],
        )(request)


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(_serializer_error(serializer), status=status.HTTP_400_BAD_REQUEST)

        empresa = serializer.save()
        return Response({"user": EmpresaSerializer(empresa).data}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(_serializer_error(serializer), status=status.HTTP_401_UNAUTHORIZED)

        return Response(serializer.create_token_payload())


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": EmpresaSerializer(request.user.empresa).data})

    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data, context={"empresa": request.user.empresa}, partial=True)
        if not serializer.is_valid():
            return Response(_serializer_error(serializer), status=status.HTTP_400_BAD_REQUEST)
        empresa = serializer.save()
        return Response({"user": EmpresaSerializer(empresa).data})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.auth.delete()
        return Response({"message": "Logout realizado."})


class CompanyListView(generics.ListAPIView):
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]
    queryset = Empresa.objects.select_related("user").all()

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"companies": serializer.data})


class CompanyDetailView(generics.RetrieveAPIView):
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]
    queryset = Empresa.objects.select_related("user").all()
    lookup_field = "pk"

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return Response({"company": serializer.data})


def _serializer_error(serializer):
    errors = serializer.errors
    if isinstance(errors, dict) and "message" in errors:
        message = errors["message"]
        if isinstance(message, list):
            message = message[0]
        return {"message": str(message)}
    return {"message": "Nao foi possivel concluir a operacao.", "errors": errors}
