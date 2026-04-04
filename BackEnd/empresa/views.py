from django.shortcuts import render
from rest_framework import generics
from empresa.models import Empresa
from empresa.serializers import EmpresaSerializer

class EmpresaCreateListView(generics.ListCreateAPIView):
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer



