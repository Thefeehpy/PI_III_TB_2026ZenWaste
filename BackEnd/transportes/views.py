from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from authentication.services import ZenWasteAPIView, require_empresa
from transportes.models import (
    Caminhao,
    Entrega,
    HistoricoFrete,
    Motorista,
    OportunidadeFrete,
    ProcessoFrete,
    PropostaFrete,
    Transportadora,
)
from transportes.serializers import (
    CaminhaoSerializer,
    ConfirmarEntregaSerializer,
    CriarDocumentoSerializer,
    CriarEntregaSerializer,
    CriarHistoricoSerializer,
    CriarPropostaSerializer,
    EntregaPublicaSerializer,
    EntregaSerializer,
    HistoricoFreteSerializer,
    MotoristaSerializer,
    OportunidadeFreteSerializer,
    ProcessoFreteSerializer,
    PropostaFreteSerializer,
    PublicarOportunidadeSerializer,
    TransportadoraSerializer,
    ValidarEntregaSerializer,
)
from transportes.services import (
    aprovar_proposta,
    confirmar_entrega,
    criar_entrega,
    publicar_oportunidade,
    registrar_documento,
)


def _empresa(request):
    return require_empresa(request)


def _domain_error(error):
    messages = getattr(error, "messages", None)
    message = messages[0] if messages else str(error)
    return Response({"message": message}, status=status.HTTP_400_BAD_REQUEST)


class TransportadoraListCreateView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = _empresa(request)
        if error:
            return error
        instance = Transportadora.objects.filter(empresa=empresa).first()
        return Response(TransportadoraSerializer([instance] if instance else [], many=True).data)

    def post(self, request):
        empresa, error = _empresa(request)
        if error:
            return error
        instance = Transportadora.objects.filter(empresa=empresa).first()
        serializer = TransportadoraSerializer(instance, data=request.data, partial=instance is not None)
        serializer.is_valid(raise_exception=True)
        serializer.save(empresa=empresa)
        return Response(serializer.data, status=status.HTTP_200_OK if instance else status.HTTP_201_CREATED)


class TransportadoraDetailView(ZenWasteAPIView):
    def _get(self, empresa, pk):
        return get_object_or_404(Transportadora, pk=pk, empresa=empresa)

    def get(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        return Response(TransportadoraSerializer(self._get(empresa, pk)).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        empresa, error = _empresa(request)
        if error:
            return error
        serializer = TransportadoraSerializer(self._get(empresa, pk), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        self._get(empresa, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ValidarSigorView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        transportadora = get_object_or_404(Transportadora, pk=pk, empresa=empresa)
        valido = transportadora.validar_credenciais_sigor()
        return Response({"valid": valido, "carrier": TransportadoraSerializer(transportadora).data})


class _CadastroBaseView(ZenWasteAPIView):
    model = None
    serializer_class = None

    def _transportadora(self, empresa):
        return get_object_or_404(Transportadora, empresa=empresa)

    def get(self, request):
        empresa, error = _empresa(request)
        if error:
            return error
        queryset = self.model.objects.filter(transportadora=self._transportadora(empresa))
        return Response(self.serializer_class(queryset, many=True).data)

    def post(self, request):
        empresa, error = _empresa(request)
        if error:
            return error
        transportadora = self._transportadora(empresa)
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(transportadora=transportadora)
        return Response(self.serializer_class(instance).data, status=status.HTTP_201_CREATED)


class _CadastroDetailBaseView(_CadastroBaseView):
    def _object(self, empresa, pk):
        return get_object_or_404(self.model, pk=pk, transportadora=self._transportadora(empresa))

    def get(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        return Response(self.serializer_class(self._object(empresa, pk)).data)

    def put(self, request, pk):
        return self._update(request, pk, False)

    def patch(self, request, pk):
        return self._update(request, pk, True)

    def _update(self, request, pk, partial):
        empresa, error = _empresa(request)
        if error:
            return error
        serializer = self.serializer_class(self._object(empresa, pk), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        self._object(empresa, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CaminhaoListCreateView(_CadastroBaseView):
    model = Caminhao
    serializer_class = CaminhaoSerializer


class CaminhaoDetailView(_CadastroDetailBaseView):
    model = Caminhao
    serializer_class = CaminhaoSerializer


class MotoristaListCreateView(_CadastroBaseView):
    model = Motorista
    serializer_class = MotoristaSerializer


class MotoristaDetailView(_CadastroDetailBaseView):
    model = Motorista
    serializer_class = MotoristaSerializer


class ProcessoFreteListCreateView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = _empresa(request)
        if error:
            return error
        queryset = ProcessoFrete.objects.filter(empresa_solicitante=empresa).prefetch_related("historico")
        return Response({"items": ProcessoFreteSerializer(queryset, many=True).data})

    def post(self, request):
        empresa, error = _empresa(request)
        if error:
            return error
        serializer = ProcessoFreteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        anuncio = serializer.validated_data.get("anuncio")
        if anuncio and anuncio.produto.empresa_id != empresa.id_empresa:
            return Response({"message": "O anúncio informado não pertence a esta empresa."}, status=403)
        processo = serializer.save(empresa_solicitante=empresa)
        HistoricoFrete.objects.create(
            processo=processo,
            autor=empresa.razao_social,
            evento="processo_criado",
            observacao="Processo de frete criado.",
        )
        return Response(ProcessoFreteSerializer(processo).data, status=status.HTTP_201_CREATED)


class ProcessoFreteDetailView(ZenWasteAPIView):
    def _get(self, empresa, pk):
        return get_object_or_404(ProcessoFrete, pk=pk, empresa_solicitante=empresa)

    def get(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        return Response(ProcessoFreteSerializer(self._get(empresa, pk)).data)

    def patch(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        processo = self._get(empresa, pk)
        serializer = ProcessoFreteSerializer(processo, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        anuncio = serializer.validated_data.get("anuncio")
        if anuncio and anuncio.produto.empresa_id != empresa.id_empresa:
            return Response({"message": "O anúncio informado não pertence a esta empresa."}, status=403)
        serializer.save()
        return Response(serializer.data)


class PublicarOportunidadeView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        processo = get_object_or_404(ProcessoFrete, pk=pk, empresa_solicitante=empresa)
        serializer = PublicarOportunidadeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            oportunidade = publicar_oportunidade(processo, serializer.validated_data)
        except DjangoValidationError as domain_error:
            return _domain_error(domain_error)
        return Response(OportunidadeFreteSerializer(oportunidade).data, status=status.HTTP_201_CREATED)


class OportunidadeListView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = _empresa(request)
        if error:
            return error
        queryset = OportunidadeFrete.objects.filter(
            status__in=[OportunidadeFrete.Status.ABERTA, OportunidadeFrete.Status.COM_PROPOSTAS, OportunidadeFrete.Status.RECOMENDADA]
        ).select_related("processo", "processo__empresa_solicitante")
        return Response({"items": OportunidadeFreteSerializer(queryset, many=True).data})


class PropostaListCreateView(ZenWasteAPIView):
    def get(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        oportunidade = get_object_or_404(OportunidadeFrete, pk=pk)
        if oportunidade.processo.empresa_solicitante_id == empresa.id_empresa:
            propostas = oportunidade.propostas.all()
        else:
            transportadora = Transportadora.objects.filter(empresa=empresa).first()
            if transportadora is None:
                return Response({"message": "Acesso negado."}, status=status.HTTP_403_FORBIDDEN)
            propostas = oportunidade.propostas.filter(transportadora=transportadora)
        return Response({"items": PropostaFreteSerializer(propostas, many=True).data})

    def post(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        transportadora = Transportadora.objects.filter(empresa=empresa).first()
        if transportadora is None:
            return Response({"message": "Cadastre o perfil da transportadora antes de enviar propostas."}, status=403)
        oportunidade = get_object_or_404(OportunidadeFrete, pk=pk, status__in=["open", "sent", "recommended"])
        serializer = CriarPropostaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if PropostaFrete.objects.filter(oportunidade=oportunidade, transportadora=transportadora).exists():
            return Response({"message": "A transportadora já enviou proposta para esta oportunidade."}, status=409)
        proposta = PropostaFrete.objects.create(
            oportunidade=oportunidade,
            transportadora=transportadora,
            valor=serializer.validated_data["value"],
            prazo_entrega_dias=serializer.validated_data["deliveryDays"],
            observacao=serializer.validated_data.get("note", ""),
        )
        if oportunidade.status == OportunidadeFrete.Status.ABERTA:
            oportunidade.status = OportunidadeFrete.Status.COM_PROPOSTAS
            oportunidade.save(update_fields=["status"])
        return Response(PropostaFreteSerializer(proposta).data, status=status.HTTP_201_CREATED)


class AprovarPropostaView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        proposta = get_object_or_404(PropostaFrete.objects.select_related("oportunidade__processo"), pk=pk)
        try:
            aprovar_proposta(proposta, empresa)
        except DjangoValidationError as domain_error:
            return _domain_error(domain_error)
        return Response(PropostaFreteSerializer(proposta).data)


class DocumentoFreteView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        processo = get_object_or_404(ProcessoFrete, pk=pk, empresa_solicitante=empresa)
        serializer = CriarDocumentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            documento = registrar_documento(processo, serializer.validated_data, empresa)
        except DjangoValidationError as domain_error:
            return _domain_error(domain_error)
        from transportes.serializers import DocumentoFreteSerializer
        return Response(DocumentoFreteSerializer(documento).data)


class HistoricoFreteView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        processo = get_object_or_404(ProcessoFrete, pk=pk, empresa_solicitante=empresa)
        serializer = CriarHistoricoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        historico = HistoricoFrete.objects.create(
            processo=processo,
            autor=empresa.razao_social,
            evento=serializer.validated_data["event"],
            observacao=serializer.validated_data["note"],
        )
        return Response(HistoricoFreteSerializer(historico).data, status=status.HTTP_201_CREATED)


class EntregaListCreateView(ZenWasteAPIView):
    def get(self, request):
        empresa, error = _empresa(request)
        if error:
            return error
        queryset = Entrega.objects.filter(processo__empresa_solicitante=empresa)
        if hasattr(empresa, "dados_transportadora"):
            queryset = Entrega.objects.filter(transportadora=empresa.dados_transportadora)
        return Response({"items": EntregaSerializer(queryset.select_related("processo", "transportadora__empresa"), many=True).data})

    def post(self, request):
        empresa, error = _empresa(request)
        if error:
            return error
        processo_id = request.data.get("processId")
        processo = get_object_or_404(ProcessoFrete, pk=processo_id, empresa_solicitante=empresa)
        serializer = CriarEntregaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            entrega = criar_entrega(processo, serializer.validated_data, empresa)
        except DjangoValidationError as domain_error:
            return _domain_error(domain_error)
        return Response(EntregaSerializer(entrega).data, status=status.HTTP_201_CREATED)


class IniciarEntregaView(ZenWasteAPIView):
    def post(self, request, pk):
        empresa, error = _empresa(request)
        if error:
            return error
        transportadora = get_object_or_404(Transportadora, empresa=empresa)
        entrega = get_object_or_404(Entrega, pk=pk, transportadora=transportadora)
        if not entrega.iniciar_rota():
            return Response({"message": "A entrega não está aguardando saída."}, status=409)
        return Response(EntregaSerializer(entrega).data)


class EntregaPublicaView(ZenWasteAPIView):
    def get(self, request, order_number):
        entrega = get_object_or_404(Entrega.objects.select_related("processo", "transportadora__empresa"), processo__numero_pedido=order_number)
        if not entrega.validar_token(request.query_params.get("token")):
            return Response({"message": "Token do QR Code inválido."}, status=status.HTTP_403_FORBIDDEN)
        return Response(EntregaPublicaSerializer(entrega).data)


class ValidarIdentidadeEntregaView(ZenWasteAPIView):
    def post(self, request, order_number):
        entrega = get_object_or_404(Entrega, processo__numero_pedido=order_number)
        serializer = ValidarEntregaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        valido = entrega.validar_token(data["token"]) and entrega.validar_identidade(data["receiverName"], data["receiverCpf"])
        return Response({"valid": valido}, status=status.HTTP_200_OK if valido else status.HTTP_403_FORBIDDEN)


class ConfirmarEntregaView(ZenWasteAPIView):
    def post(self, request, order_number):
        entrega = get_object_or_404(Entrega, processo__numero_pedido=order_number)
        serializer = ConfirmarEntregaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            confirmar_entrega(entrega, serializer.validated_data)
        except DjangoValidationError as domain_error:
            return _domain_error(domain_error)
        return Response(EntregaPublicaSerializer(entrega).data)
