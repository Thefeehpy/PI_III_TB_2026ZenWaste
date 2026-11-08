from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, IsAdminUser
from empresas.models import Empresa
from empresas.serializers import SerializadorEmpresa
from empresas.servicos import desativar_empresa

class VisaoListagemCriacaoEmpresa(generics.ListCreateAPIView):
    permission_classes = (IsAuthenticated, IsAuthenticatedOrReadOnly)    
    queryset = Empresa.objects.all()
    serializer_class = SerializadorEmpresa


class VisaoDetalheEmpresa(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (IsAuthenticated, IsAdminUser)
    queryset = Empresa.objects.all()
    serializer_class = SerializadorEmpresa

    def perform_destroy(self, instancia):
        desativar_empresa(instancia)

