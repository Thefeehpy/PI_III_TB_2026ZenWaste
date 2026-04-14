from .models import Empresa


def serialize_user(profile: Empresa) -> dict:
    return profile.to_dict()
