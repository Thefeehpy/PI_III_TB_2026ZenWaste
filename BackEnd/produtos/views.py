from django.shortcuts import render
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly, IsAdminUser
from produtos.models import Produto
from produtos.serializers import ProdutoSerializer

class ProdutoCreateListView(generics.ListCreateAPIView):
    #permission_classes = (IsAuthenticatedOrReadOnly)
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer

class ProdutoRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    #permission_classes = (IsAuthenticated, IsAdminUser)
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer

class ProdutoCreate(generics.CreateAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer

class ProdutoUpdate(generics.UpdateAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer

class ProdutoDestroy(generics.DestroyAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer

class ProdutoRetrieve(generics.RetrieveAPIView):
    queryset = Produto.objects.all()
    serializer_class = ProdutoSerializer


    
