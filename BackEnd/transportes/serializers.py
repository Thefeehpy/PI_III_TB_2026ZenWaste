from rest_framework import serializers
from transportes.models import Caminhao, Motorista, Transportadora


class TransportadoraSerializer(serializers.ModelSerializer):
    # Campos de leitura extras para facilitar a exibição no frontend
    razao_social = serializers.CharField(source='empresa.razao_social', read_only=True)
    cnpj = serializers.CharField(source='empresa.cnpj', read_only=True)

    class Meta:
        model = Transportadora
        fields = [
            'id_transportadora', 
            'empresa', 
            'razao_social', 
            'cnpj', 
            'codigo_unidade_sigor', 
            'is_homologada'
        ]
        # is_homologada geralmente é alterado via integração/backend, não pelo usuário
        read_only_fields = ['is_homologada'] 


class CaminhaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Caminhao
        fields = [
            'id_caminhao', 
            'transportadora', 
            'placa', 
            'capacidade_carga_kg', 
            'is_ativo'
        ]

    def validate_placa(self, value):
        placa_limpa = value.upper().replace("-", "").strip()
        
        if len(placa_limpa) != 7 or not placa_limpa.isalnum():
            raise serializers.ValidationError(
                "A placa deve conter exatamente 7 caracteres alfanuméricos, sem hífen."
            )
            
        return placa_limpa


class MotoristaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Motorista
        fields = [
            'id_motorista', 
            'transportadora', 
            'funcionario', 
            'nome_completo', 
            'cpf', 
            'cnh', 
            'is_ativo'
        ]

    def validate_nome_completo(self, value):
        if len(value.strip().split()) < 2:
            raise serializers.ValidationError(
                "O nome do motorista deve ser completo (nome e sobrenome)."
            )
        return value