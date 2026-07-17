from __future__ import annotations

import typing

from allauth.account.adapter import DefaultAccountAdapter
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.headless.adapter import DefaultHeadlessAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.contrib.auth import get_user_model
from django.http import JsonResponse

from .models import PerfilChoices

if typing.TYPE_CHECKING:
    from allauth.socialaccount.models import SocialLogin
    from django.contrib.auth.base_user import AbstractBaseUser
    from django.http import HttpRequest


def _unauthorized() -> ImmediateHttpResponse:
    # FR-008: mensagem generica, sem detalhar o motivo exato (evita enumeracao
    # de contas).
    return ImmediateHttpResponse(
        JsonResponse({"detail": "Acesso não autorizado."}, status=401),
    )


class AccountAdapter(DefaultAccountAdapter):
    """Sem cadastro publico (Principio II da constituicao): nunca abre para signup."""

    def is_open_for_signup(self, request: HttpRequest) -> bool:
        return False


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    """Unico ponto de decisao de login (Principio III): so autentica usuarios ja
    provisionados pelo Django Admin, ativos, com empresa e perfil validos.

    Nunca cria conta nova a partir do login social (FR-006/FR-008): o usuario
    precisa ja existir com o mesmo e-mail retornado pelo Google.
    """

    def is_open_for_signup(
        self,
        request: HttpRequest,
        sociallogin: SocialLogin,
    ) -> bool:
        return False

    def pre_social_login(self, request: HttpRequest, sociallogin: SocialLogin) -> None:
        email = sociallogin.user.email
        if not email:
            raise _unauthorized()

        user_model = get_user_model()
        try:
            existing_user = user_model.objects.get(email__iexact=email)
        except user_model.DoesNotExist:
            # FR-008: e-mail autenticado nao corresponde a usuario cadastrado.
            raise _unauthorized() from None

        if not existing_user.is_active:
            # FR-005 / FR-008: usuario inativo.
            raise _unauthorized()

        if existing_user.empresa_id is None:
            # FR-008: usuario sem empresa vinculada.
            raise _unauthorized()

        if existing_user.perfil not in PerfilChoices.values:
            # FR-004/FR-008: perfil invalido.
            raise _unauthorized()

        if not sociallogin.is_existing:
            sociallogin.connect(request, existing_user)


class HeadlessAdapter(DefaultHeadlessAdapter):
    """Inclui os campos de dominio do BuildFlow na resposta de sessao/login do
    allauth headless (nome, perfil, empresa) — FR-014 do contrato de API.
    """

    def serialize_user(self, user: AbstractBaseUser) -> dict[str, typing.Any]:
        data = super().serialize_user(user)
        data.update(
            {
                "nome": user.nome,
                "perfil": user.perfil,
                "empresa": str(user.empresa_id) if user.empresa_id else None,
                "empresa_nome": user.empresa.nome if user.empresa_id else None,
            },
        )
        return data
