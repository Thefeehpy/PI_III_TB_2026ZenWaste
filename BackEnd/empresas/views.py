from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, IsAdminUser
from empresas.models import Empresa
from empresas.serializers import EmpresaSerializer

class EmpresaCreateListView(generics.ListCreateAPIView):
    #permission_classes = (IsAuthenticated, IsAuthenticatedOrReadOnly)    
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer


class EmpresaRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    #permission_classes = (IsAuthenticated, IsAdminUser)
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer

