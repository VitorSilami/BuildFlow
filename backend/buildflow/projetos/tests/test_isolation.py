from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import EmpresaFactory
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto

pytestmark = pytest.mark.django_db


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def duas_empresas():
    empresa_a = EmpresaFactory()
    empresa_b = EmpresaFactory()
    usuario_a = UsuarioFactory(empresa=empresa_a)
    usuario_b = UsuarioFactory(empresa=empresa_b)
    projeto_a = Projeto.objects.create(
        empresa=empresa_a,
        nome="Projeto Empresa A",
        criado_por=usuario_a,
    )
    return {
        "empresa_a": empresa_a,
        "empresa_b": empresa_b,
        "usuario_a": usuario_a,
        "usuario_b": usuario_b,
        "projeto_a": projeto_a,
    }


def test_usuario_empresa_b_nao_ve_projeto_da_empresa_a_na_listagem(duas_empresas):
    response = _authenticated_client(duas_empresas["usuario_b"]).get(
        "/api/v1/projetos/",
    )

    ids = [item["id"] for item in response.json()["results"]]
    assert str(duas_empresas["projeto_a"].id) not in ids


def test_usuario_empresa_b_nao_acessa_projeto_da_empresa_a_por_id_direto(duas_empresas):
    projeto_a = duas_empresas["projeto_a"]

    response = _authenticated_client(duas_empresas["usuario_b"]).get(
        f"/api/v1/projetos/{projeto_a.id}/",
    )

    # 404, nunca 403: nao revela que o projeto existe em outra empresa (FR-013).
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_a_acessa_normalmente_seu_proprio_projeto(duas_empresas):
    projeto_a = duas_empresas["projeto_a"]

    response = _authenticated_client(duas_empresas["usuario_a"]).get(
        f"/api/v1/projetos/{projeto_a.id}/",
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()["nome"] == "Projeto Empresa A"
