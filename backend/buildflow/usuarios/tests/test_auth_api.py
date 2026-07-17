from http import HTTPStatus

import pytest
from allauth.socialaccount.providers.google.provider import GoogleProvider

from buildflow.core.tests.factories import EmpresaFactory
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.usuarios.models import PerfilChoices

pytestmark = pytest.mark.django_db

PROVIDER_TOKEN_PATH = "/_allauth/browser/v1/auth/provider/token"  # noqa: S105 (URL, nao credencial)
SESSION_PATH = "/_allauth/browser/v1/auth/session"
TEST_CLIENT_ID = "test-google-client-id"


def _fake_verify_token(self, request, token):
    """Substitui a verificacao real do Google (rede/JWKS) nos testes: usa o
    proprio valor de `id_token` enviado como se fosse o e-mail verificado.
    """
    email = token.get("id_token")
    identity_data = {"sub": email, "email": email, "email_verified": True}
    return self.sociallogin_from_response(request, identity_data)


@pytest.fixture(autouse=True)
def _fake_google_provider(monkeypatch, settings):
    settings.SOCIALACCOUNT_PROVIDERS = {
        "google": {
            "APPS": [
                {"client_id": TEST_CLIENT_ID, "secret": "test-secret", "key": ""},
            ],
            "SCOPE": ["profile", "email"],
            "OAUTH_PKCE_ENABLED": True,
        },
    }
    monkeypatch.setattr(GoogleProvider, "verify_token", _fake_verify_token)


def _login_payload(email: str) -> dict:
    return {
        "provider": "google",
        "process": "login",
        "token": {"id_token": email, "client_id": TEST_CLIENT_ID},
    }


def test_login_aceito_para_usuario_ativo_vinculado_a_empresa(client):
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(
        empresa=empresa,
        perfil=PerfilChoices.GERENTE,
        is_active=True,
    )

    response = client.post(
        PROVIDER_TOKEN_PATH,
        data=_login_payload(usuario.email),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["data"]["user"]["email"] == usuario.email
    assert body["data"]["user"]["empresa_nome"] == empresa.nome

    # Sessao realmente criada: /session confirma o usuario autenticado.
    session_response = client.get(SESSION_PATH)
    assert session_response.json()["data"]["user"]["email"] == usuario.email


def test_login_recusado_email_nao_cadastrado(client):
    response = client.post(
        PROVIDER_TOKEN_PATH,
        data=_login_payload("ninguem@example.com"),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert response.json()["detail"] == "Acesso não autorizado."


def test_login_recusado_usuario_inativo(client):
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa, is_active=False)

    response = client.post(
        PROVIDER_TOKEN_PATH,
        data=_login_payload(usuario.email),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_login_recusado_usuario_sem_empresa(client):
    usuario = UsuarioFactory(
        empresa=None,
        is_active=True,
        is_superuser=True,
        is_staff=True,
    )

    response = client.post(
        PROVIDER_TOKEN_PATH,
        data=_login_payload(usuario.email),
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_session_anonima_retorna_401(client):
    response = client.get(SESSION_PATH)

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_logout_encerra_sessao(client):
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa, is_active=True)
    client.post(
        PROVIDER_TOKEN_PATH,
        data=_login_payload(usuario.email),
        content_type="application/json",
    )

    logout_response = client.delete(SESSION_PATH)
    # sem usuario apos logout
    assert logout_response.status_code == HTTPStatus.UNAUTHORIZED

    session_after_logout = client.get(SESSION_PATH)
    assert session_after_logout.status_code == HTTPStatus.UNAUTHORIZED
