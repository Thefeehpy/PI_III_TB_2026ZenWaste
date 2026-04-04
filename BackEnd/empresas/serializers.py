from rest_framework import serializers
from empresas.models import Empresa

class EmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = ['id_empresa', 'cnpj', 'razao_social', 'telefone_whatsapp', 'data_cadastro', 'descricao_segmento', 'email', 'senha']
        extra_kwargs = {
            'senha' : {'write_only': True}
        }

    def validate_senha(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Senha muito curta!")
        return value

        


    