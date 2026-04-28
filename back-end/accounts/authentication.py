from django.utils import timezone
from rest_framework import authentication, exceptions

from accounts.models import SessionToken


class SessionTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization", "")
        prefix = f"{self.keyword} "

        if not auth_header.startswith(prefix):
            return None

        raw_token = auth_header.removeprefix(prefix).strip()
        if not raw_token:
            raise exceptions.AuthenticationFailed("Token ausente.")

        token = (
            SessionToken.objects.select_related("user", "user__empresa")
            .filter(token_hash=SessionToken.hash_token(raw_token))
            .first()
        )
        if not token:
            raise exceptions.AuthenticationFailed("Token invalido.")
        if token.is_expired:
            token.delete()
            raise exceptions.AuthenticationFailed("Sessao expirada. Faca login novamente.")

        token.last_used_at = timezone.now()
        token.save(update_fields=["last_used_at"])
        request.auth_token = token
        return token.user, token
