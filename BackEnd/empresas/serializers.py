from rest_framework import serializers

from empresas.models import Empresa


class EmpresaSerializer(serializers.ModelSerializer):
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
        ]
        extra_kwargs = {
            "senha": {"write_only": True},
        }

    def validate_senha(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Senha muito curta!")
        return value

    def create(self, validated_data):
        senha = validated_data.pop("senha")
        empresa = Empresa(**validated_data)
        empresa.definir_senha(senha)
        empresa.save()
        return empresa

    def update(self, instance, validated_data):
        senha = validated_data.pop("senha", None)

        for atributo, valor in validated_data.items():
            setattr(instance, atributo, valor)

        if senha:
            instance.definir_senha(senha)

        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
