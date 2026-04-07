from django.shortcuts import render
from rest_framework import generics
from estoque.models import Estoque
from estoque.serializers import EstoqueSerializer

class EstoqueCreateListView(generics.ListCreateAPIView):
    queryset = Estoque.objects.all()
    serializer_class = EstoqueSerializer


