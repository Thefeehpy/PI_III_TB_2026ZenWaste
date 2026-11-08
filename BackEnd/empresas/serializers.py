from rest_framework import serializers

from app.excecoes import ErroRegraNegocio
from empresas.models import Empresa
from empresas.servicos import cadastrar_empresa, atualizar_empresa, validar_email_empresa


class SerializadorEmpresa(serializers.ModelSerializer):
    class Meta:
        model = Empresa
        fields = [
            "id_empresa",
            "cnpj",
            "razao_social",
            "telefone_whatsapp",
            "data_cadastro",
            "descricao_segmento",
            "email",
            "senha",
            "ativo",
        ]
        read_only_fields = ["ativo"]
        extra_kwargs = {
            "senha": {"write_only": True},
        }

    def validate_senha(self, valor):
        if len(valor) < 6:
            raise serializers.ValidationError("Senha muito curta!")
        return valor

    def validate_email(self, valor):
        try:
            return validar_email_empresa(valor, empresa_atual=self.instance)
        except ErroRegraNegocio as erro:
            raise serializers.ValidationError(erro.detalhes["email"]) from erro

    def create(self, dados_validados):
        return cadastrar_empresa(dados_validados)

    def update(self, instancia, dados_validados):
        return atualizar_empresa(instancia, dados_validados)

