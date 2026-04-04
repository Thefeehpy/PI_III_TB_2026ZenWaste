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

        

"""id_empresa = models.CharField(primary_key=True)
    cnpj = BRCNPJField(unique = True, verbose_name="CNPJ")
    
    #Verificar se precisa adicionar help_text dentro do parênteses    
    #Caso tenha: help_text="Digite apenas números ou o formato 00.000.000/0000-00"help_text="Digite apenas números ou o formato 00.000.000/0000-00"

    razao_social = models.CharField(max_length=100, blank=False)    
    telefone_whatsapp = models.CharField(max_length=20, blank=False)
    data_cadastro = models.DateField(auto_now_add=True, blank=False)
    descricao_segmento = models.CharField(max_length=60, blank=True)
    email = models.CharField(unique=True, max_length=256, blank=False)
    senha = models.CharField(max_length=20, blank=False)"""
    