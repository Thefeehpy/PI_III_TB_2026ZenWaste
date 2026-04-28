from rest_framework import generics
from empresas.models import Empresa
from empresas.serializers import EmpresaSerializer


class EmpresaCreateListView(generics.ListCreateAPIView):
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer


class EmpresaRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer

