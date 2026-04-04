from django.shortcuts import render
from rest_framework import generics
from empresas.models import Empresa
from empresas.serializers import EmpresaSerializer

class EmpresaCreateListView(generics.ListCreateAPIView):
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer
