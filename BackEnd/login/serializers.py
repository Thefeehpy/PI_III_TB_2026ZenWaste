from rest_framework import serializers
from django.contrib.auth import authenticate

class LoginSerializer(serializers.Serializer):
    class Meta:
        email = serializers.EmailField()
        senha = serializers.CharField(write_only=True, trim_whitespace=False)

        def validate(self, data):
            user = authenticate(email=data.get('email'), password=data.get('senha'))

            if user and user.is_active:
                return user
            raise serializer.ValidationError("Credenciais inválidas.")