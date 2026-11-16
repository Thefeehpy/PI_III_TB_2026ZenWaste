from rest_framework import serializers


class ContratoMTR(serializers.Serializer):
    def to_internal_value(self,data):
        if not isinstance(data,dict) or set(data)-set(self.fields):
            raise serializers.ValidationError({'message':'Há campos não permitidos neste contrato.'})
        return super().to_internal_value(data)


class CriacaoRascunhoMTR(ContratoMTR):
    frete_id=serializers.UUIDField(required=False)
    tipo=serializers.ChoiceField(choices=['HOMOLOGACAO_INDEPENDENTE'],required=False)
    cenario=serializers.ChoiceField(choices=['MTR05B_HOMOLOGACAO'],required=False)
    def validate(self,attrs):
        if ('frete_id' in attrs)==('tipo' in attrs):
            raise serializers.ValidationError('Selecione um frete existente ou o cenário independente de homologação.')
        if 'cenario' in attrs and attrs.get('tipo')!='HOMOLOGACAO_INDEPENDENTE':
            raise serializers.ValidationError('Cenário proposto disponível somente na preparação independente.')
        return attrs


class AlteracaoRascunhoMTR(ContratoMTR):
    versao=serializers.IntegerField(min_value=1)
    dados=serializers.JSONField()


class RevisaoRascunhoMTR(ContratoMTR):
    versao=serializers.IntegerField(min_value=1)
    confirmacoes=serializers.JSONField()


class PreparacaoMTR(ContratoMTR):
    versao=serializers.IntegerField(min_value=1)
    cenario=serializers.ChoiceField(choices=['sucesso','rejeicao','timeout'],default='sucesso')
    confirmar_mock=serializers.BooleanField()


class SessaoOperadorMTR(ContratoMTR):
    usuario=serializers.CharField(max_length=150,trim_whitespace=True)
    senha=serializers.CharField(max_length=1024,trim_whitespace=False,write_only=True)


class ComandoVazioMTR(ContratoMTR):
    pass


class AlteracaoOperacionalMTR(ContratoMTR):
    versao=serializers.IntegerField(min_value=1)
    dados=serializers.DictField(child=serializers.CharField(allow_blank=True,allow_null=True,max_length=1000))
    contexto=serializers.JSONField()


class PreparacaoOperacionalMTR(ContratoMTR):
    versao=serializers.IntegerField(min_value=1)
    modo=serializers.ChoiceField(choices=['SIMULACAO','HOMOLOGACAO'])
    confirmar_preparacao=serializers.BooleanField()
