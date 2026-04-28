from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from rest_framework import serializers

from accounts.models import Empresa, SessionToken
from accounts.validators import normalize_cnpj, validate_cnpj


User = get_user_model()


class EmpresaSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="user_id", read_only=True)
    razaoSocial = serializers.CharField(source="razao_social")
    segmento = serializers.CharField(source="descricao_segmento")
    telefone = serializers.CharField(source="telefone_whatsapp")
    email = serializers.EmailField(source="user.email")

    class Meta:
        model = Empresa
        fields = ["id", "razaoSocial", "cnpj", "segmento", "email", "telefone"]

    def to_representation(self, instance):
        return instance.to_frontend()


class ProfileUpdateSerializer(serializers.Serializer):
    razaoSocial = serializers.CharField(max_length=100, required=False)
    cnpj = serializers.CharField(max_length=18, required=False)
    segmento = serializers.CharField(max_length=60, required=False)
    email = serializers.EmailField(required=False)
    telefone = serializers.CharField(max_length=20, required=False)

    def validate(self, attrs):
        empresa = self.context["empresa"]

        if "email" in attrs:
            email = attrs["email"].strip().lower()
            email_exists = (
                User.objects.exclude(pk=empresa.user_id).filter(username__iexact=email).exists()
                or User.objects.exclude(pk=empresa.user_id).filter(email__iexact=email).exists()
            )
            if email_exists:
                raise serializers.ValidationError({"message": "Ja existe uma conta com este e-mail."})
            attrs["email"] = email

        if "cnpj" in attrs:
            cnpj = normalize_cnpj(attrs["cnpj"])
            if not validate_cnpj(cnpj):
                raise serializers.ValidationError({"message": "CNPJ invalido."})
            if Empresa.objects.exclude(pk=empresa.pk).filter(cnpj=cnpj).exists():
                raise serializers.ValidationError({"message": "Ja existe uma conta com este CNPJ."})
            attrs["cnpj"] = cnpj

        return attrs

    def save(self, **kwargs):
        empresa = self.context["empresa"]

        with transaction.atomic():
            if "email" in self.validated_data:
                empresa.user.username = self.validated_data["email"]
                empresa.user.email = self.validated_data["email"]
                empresa.user.save(update_fields=["username", "email"])
            if "razaoSocial" in self.validated_data:
                empresa.razao_social = self.validated_data["razaoSocial"].strip()
            if "cnpj" in self.validated_data:
                empresa.cnpj = self.validated_data["cnpj"]
            if "segmento" in self.validated_data:
                empresa.descricao_segmento = self.validated_data["segmento"].strip()
            if "telefone" in self.validated_data:
                empresa.telefone_whatsapp = self.validated_data["telefone"].strip()
            empresa.save()

        return empresa


class RegisterSerializer(serializers.Serializer):
    razaoSocial = serializers.CharField(max_length=100)
    cnpj = serializers.CharField(max_length=18)
    segmento = serializers.CharField(max_length=60)
    email = serializers.EmailField()
    telefone = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        cnpj = normalize_cnpj(attrs["cnpj"])

        if not validate_cnpj(cnpj):
            raise serializers.ValidationError({"message": "CNPJ invalido. Apenas empresas podem se cadastrar."})
        if User.objects.filter(username__iexact=email).exists() or User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"message": "Ja existe uma conta com este e-mail."})
        if Empresa.objects.filter(cnpj=cnpj).exists():
            raise serializers.ValidationError({"message": "Ja existe uma conta com este CNPJ."})

        attrs["email"] = email
        attrs["cnpj"] = cnpj
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            user = User.objects.create_user(
                username=validated_data["email"],
                email=validated_data["email"],
                password=validated_data["password"],
            )
            return Empresa.objects.create(
                user=user,
                razao_social=validated_data["razaoSocial"].strip(),
                cnpj=validated_data["cnpj"],
                descricao_segmento=validated_data["segmento"].strip(),
                telefone_whatsapp=validated_data["telefone"].strip(),
            )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs["email"].strip().lower(), password=attrs["password"])
        if user is None:
            raise serializers.ValidationError({"message": "E-mail ou senha invalidos."})
        if not hasattr(user, "empresa"):
            raise serializers.ValidationError({"message": "Perfil da empresa nao encontrado."})

        attrs["user"] = user
        return attrs

    def create_token_payload(self):
        user = self.validated_data["user"]
        raw_token, _token = SessionToken.create_for_user(user)
        return {"token": raw_token, "user": user.empresa.to_frontend()}
