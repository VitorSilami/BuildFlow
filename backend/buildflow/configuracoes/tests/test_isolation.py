from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.configuracoes.models import ValorCusto
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
    valor_a = ValorCusto.objects.create(
        projeto=projeto_a,
        tipo="mao_de_obra",
        descricao="Ajudante",
        valor="250.00",
    )
    usuario_b = UsuarioFactory()
    return {
        "usuario_a": usuario_a,
        "usuario_b": usuario_b,
        "projeto_a": projeto_a,
        "equipe_a": equipe_a,
        "disciplina_a": disciplina_a,
        "valor_a": valor_a,
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


def test_usuario_empresa_b_nao_lista_disciplinas_do_projeto_da_empresa_a(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/configuracao/disciplinas/"

    response = _authenticated_client(cenario["usuario_b"]).get(url)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["count"] == 0


def test_usuario_empresa_b_nao_lista_equipes_do_projeto_da_empresa_a(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/configuracao/equipes/"

    response = _authenticated_client(cenario["usuario_b"]).get(url)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["count"] == 0


def test_usuario_empresa_b_nao_lista_valores_de_custo_do_projeto_da_empresa_a(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/configuracao/valores/"

    response = _authenticated_client(cenario["usuario_b"]).get(url)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["count"] == 0


def test_usuario_empresa_a_lista_suas_proprias_disciplinas_equipes_e_valores(cenario):
    client = _authenticated_client(cenario["usuario_a"])
    base = f"/api/v1/projetos/{cenario['projeto_a'].id}/configuracao"

    assert client.get(f"{base}/disciplinas/").json()["count"] == 1
    assert client.get(f"{base}/equipes/").json()["count"] == 1
    assert client.get(f"{base}/valores/").json()["count"] == 1
