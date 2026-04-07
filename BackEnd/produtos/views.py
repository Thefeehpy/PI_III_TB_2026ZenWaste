from django.shortcuts import render
from rest_framework import generics
from produtos.models import Produto
from produtos.serializers import ProdutoSerializer

class ProdutoCreateListView(generics.ListCreateAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer

class ProdutoRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer
# Create your views here.
