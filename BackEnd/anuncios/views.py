from rest_framework import generics
from rest_framework.exceptions import NotAuthenticated

from anuncios.models import Anuncio
from anuncios.serializers import SerializadorAnuncioLegado
from autenticacao.servicos import obter_empresa_da_requisicao


class VisaoCriacaoListagemAnuncioLegado(generics.ListCreateAPIView):
    """Rota legada com o mesmo isolamento por empresa e servicos da API."""
    authentication_classes = []
    permission_classes = []
    serializer_class = SerializadorAnuncioLegado

    def obter_empresa(self):
        empresa = obter_empresa_da_requisicao(self.request)
        if empresa is None:
            raise NotAuthenticated("Autenticacao obrigatoria.")
        return empresa

    def get_queryset(self):
        return Anuncio.objects.filter(produto__empresa=self.obter_empresa()).select_related(
            "produto", "produto__categoria", "produto__unidade_medida",
        ).prefetch_related("imagens")

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "empresa": self.obter_empresa()}
