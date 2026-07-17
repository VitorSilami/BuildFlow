from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios.tests.factories import DisciplinaFactory
from buildflow.registros_diarios.tests.factories import EquipeFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory

pytestmark = pytest.mark.django_db


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def cenario():
    usuario_a = UsuarioFactory()
    projeto_a = ProjetoParaRdoFactory(criado_por=usuario_a)
    equipe_a = EquipeFactory(projeto=projeto_a)
    disciplina_a = DisciplinaFactory(projeto=projeto_a)
    usuario_b = UsuarioFactory()
    return {
        "usuario_a": usuario_a,
        "usuario_b": usuario_b,
        "projeto_a": projeto_a,
        "equipe_a": equipe_a,
        "disciplina_a": disciplina_a,
    }


def test_usuario_empresa_b_nao_cria_equipe_no_projeto_da_empresa_a(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/configuracao/equipes/"

    response = _authenticated_client(cenario["usuario_b"]).post(
        url,
        {"nome": "Invasora"},
        format="json",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_b_nao_lista_configuracao_do_projeto_da_empresa_a(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/configuracao/"

    response = _authenticated_client(cenario["usuario_b"]).get(url)

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_b_nao_edita_disciplina_da_empresa_a(cenario):
    url = f"/api/v1/configuracoes/disciplinas/{cenario['disciplina_a'].id}/"

    response = _authenticated_client(cenario["usuario_b"]).patch(
        url,
        {"nome": "Hackeada"},
        format="json",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_b_nao_adiciona_pessoa_na_equipe_da_empresa_a(cenario):
    url = f"/api/v1/configuracoes/equipes/{cenario['equipe_a'].id}/pessoas/"

    response = _authenticated_client(cenario["usuario_b"]).post(
        url,
        {"nome": "Invasor", "funcao": "Ajudante"},
        format="json",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_a_acessa_normalmente_sua_propria_configuracao(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/configuracao/"

    response = _authenticated_client(cenario["usuario_a"]).get(url)

    assert response.status_code == HTTPStatus.OK
