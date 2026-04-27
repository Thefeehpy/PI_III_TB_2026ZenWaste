from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.validators import format_cnpj


class Empresa(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        db_column="id_empresa",
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="empresa",
    )
    cnpj = models.CharField(max_length=14, unique=True)
    razao_social = models.CharField(max_length=100)
    tipo_perfil = models.CharField(max_length=20, default="empresa")
    telefone_whatsapp = models.CharField(max_length=20)
    data_cadastro = models.DateField(auto_now_add=True)
    descricao_segmento = models.CharField(max_length=60)

    class Meta:
        db_table = "EMPRESA"
        ordering = ["razao_social"]

    def __str__(self):
        return self.razao_social

    def to_frontend(self) -> dict:
        return {
            "id": str(self.user_id),
            "razaoSocial": self.razao_social,
            "cnpj": format_cnpj(self.cnpj),
            "segmento": self.descricao_segmento,
            "email": self.user.email,
            "telefone": self.telefone_whatsapp,
        }


class SessionToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="api_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["token_hash"]),
            models.Index(fields=["expires_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Token for {self.user}"

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @classmethod
    def create_for_user(cls, user):
        raw_token = secrets.token_urlsafe(48)
        ttl_hours = getattr(settings, "TOKEN_TTL_HOURS", 168)
        token = cls.objects.create(
            user=user,
            token_hash=cls.hash_token(raw_token),
            expires_at=timezone.now() + timedelta(hours=ttl_hours),
        )
        return raw_token, token

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()
