"""Compatibilidade HTTP para o endpoint legado de anúncios.

A API atual permanece em ``marketplace.views``. Este módulo isola o contrato
legado para que a aplicação ``anuncios`` se concentre no domínio e persistência.
"""

from rest_framework import generics, serializers

from anuncios.models import Anuncio


class AnuncioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Anuncio
        fields = "__all__"

    def create(self, validated_data):
        anuncio = Anuncio(**validated_data)
        anuncio.publicar()
        return anuncio


class AnuncioCreateListView(generics.ListCreateAPIView):
    queryset = Anuncio.objects.all()
    serializer_class = AnuncioSerializer
