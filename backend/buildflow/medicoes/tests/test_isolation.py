from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory

from .factories import MedicaoFactory

pytestmark = pytest.mark.django_db


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def cenario():
    medicao_a = MedicaoFactory()
    usuario_b = UsuarioFactory()

    return {
        "medicao_a": medicao_a,
        "projeto_a": medicao_a.projeto,
        "usuario_b": usuario_b,
    }


def test_usuario_empresa_b_nao_lista_medicoes_do_projeto_da_empresa_a(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/medicoes/"

    response = _authenticated_client(cenario["usuario_b"]).get(url)

    # 404: o projeto nem "existe" para o usuario da Empresa B (FR-013).
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_b_nao_acessa_medicao_da_empresa_a_por_id_direto(cenario):
    url = (
        f"/api/v1/projetos/{cenario['projeto_a'].id}/medicoes/"
        f"{cenario['medicao_a'].id}/"
    )

    response = _authenticated_client(cenario["usuario_b"]).get(url)

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_b_nao_aprova_medicao_da_empresa_a(cenario):
    url = (
        f"/api/v1/projetos/{cenario['projeto_a'].id}/medicoes/"
        f"{cenario['medicao_a'].id}/aprovar/"
    )

    response = _authenticated_client(cenario["usuario_b"]).post(url)

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_b_nao_rejeita_medicao_da_empresa_a(cenario):
    url = (
        f"/api/v1/projetos/{cenario['projeto_a'].id}/medicoes/"
        f"{cenario['medicao_a'].id}/rejeitar/"
    )

    response = _authenticated_client(cenario["usuario_b"]).post(
        url,
        {"motivo_rejeicao": "qualquer"},
        format="json",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_b_nao_cancela_medicao_da_empresa_a(cenario):
    url = (
        f"/api/v1/projetos/{cenario['projeto_a'].id}/medicoes/"
        f"{cenario['medicao_a'].id}/"
    )

    response = _authenticated_client(cenario["usuario_b"]).delete(url)

    assert response.status_code == HTTPStatus.NOT_FOUND
