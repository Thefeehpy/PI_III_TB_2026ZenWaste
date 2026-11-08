from rest_framework import serializers


class SerializadorAcesso(serializers.Serializer):
    email = serializers.EmailField()
    # Campo mantido em ingles para preservar o contrato JSON de acesso.
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class SerializadorRecuperacaoSenha(serializers.Serializer):
    email = serializers.EmailField()
