from django.http import Http404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from transportes.models import Caminhao, Motorista, Transportadora
from transportes.serializers import CaminhaoSerializer, MotoristaSerializer, TransportadoraSerializer


class TransportadoraListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        transportadoras = Transportadora.objects.all()
        serializer = TransportadoraSerializer(transportadoras, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TransportadoraSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TransportadoraDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Transportadora.objects.get(pk=pk)
        except Transportadora.DoesNotExist:
            raise Http404

    def get(self, request, pk):
        transportadora = self.get_object(pk)
        serializer = TransportadoraSerializer(transportadora)
        return Response(serializer.data)

    def put(self, request, pk):
        transportadora = self.get_object(pk)
        serializer = TransportadoraSerializer(transportadora, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        transportadora = self.get_object(pk)
        transportadora.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CaminhaoListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Exemplo de controle manual: filtrar por transportadora passada na URL (?transportadora_id=1)
        transportadora_id = request.query_params.get('transportadora_id')
        if transportadora_id:
            caminhoes = Caminhao.objects.filter(transportadora_id=transportadora_id)
        else:
            caminhoes = Caminhao.objects.all()
            
        serializer = CaminhaoSerializer(caminhoes, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CaminhaoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CaminhaoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Caminhao.objects.get(pk=pk)
        except Caminhao.DoesNotExist:
            raise Http404

    def put(self, request, pk):
        caminhao = self.get_object(pk)
        serializer = CaminhaoSerializer(caminhao, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        caminhao = self.get_object(pk)
        caminhao.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MotoristaListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        transportadora_id = request.query_params.get('transportadora_id')
        if transportadora_id:
            motoristas = Motorista.objects.filter(transportadora_id=transportadora_id)
        else:
            motoristas = Motorista.objects.all()
            
        serializer = MotoristaSerializer(motoristas, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = MotoristaSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MotoristaDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Motorista.objects.get(pk=pk)
        except Motorista.DoesNotExist:
            raise Http404

    def put(self, request, pk):
        motorista = self.get_object(pk)
        serializer = MotoristaSerializer(motorista, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)