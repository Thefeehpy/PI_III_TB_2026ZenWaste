from django.shortcuts import render
from anuncios.models import Anuncio
from anuncios.serializers import AnuncioSerializer
from rest_framework import generics
# Create your views here.
class AnuncioCreateListView(generics.ListCreateAPIView):
    queryset = Anuncio.objects.all()
    serializer_class = AnuncioSerializer