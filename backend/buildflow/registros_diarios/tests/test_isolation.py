from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory

from .factories import CatalogoServicoFactory
from .factories import DisciplinaFactory
from .factories import EquipeFactory
from .factories import ProjetoParaRdoFactory
from .factories import UnidadeFactory

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
    unidade = UnidadeFactory()
    servico_a = CatalogoServicoFactory(disciplina=disciplina_a, unidade=unidade)
    fiscal_a = UsuarioFactory(empresa=usuario_a.empresa)

    usuario_b = UsuarioFactory()

    return {
        "usuario_a": usuario_a,
        "usuario_b": usuario_b,
        "projeto_a": projeto_a,
        "equipe_a": equipe_a,
        "disciplina_a": disciplina_a,
        "servico_a": servico_a,
        "unidade": unidade,
        "fiscal_a": fiscal_a,
    }


def _payload(cenario_data):
    return {
        "data_referencia": "2026-07-17",
        "turno": "diurno",
        "clima": "sol",
        "equipe": str(cenario_data["equipe_a"].id),
        "fiscal": cenario_data["fiscal_a"].id,
        "producoes": [
            {
                "rodovia": "BR-365",
                "sentido": "crescente",
                "disciplina": str(cenario_data["disciplina_a"].id),
                "servico": str(cenario_data["servico_a"].id),
                "km_inicial": "10.000",
                "km_final": "10.500",
                "quantidade": "500.000",
                "unidade": cenario_data["unidade"].id,
            },
        ],
        "presencas": [],
        "maquinas": [],
        "ocorrencias": [],
    }


def test_usuario_empresa_b_nao_cria_rdo_no_projeto_da_empresa_a(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/registros-diarios/"

    response = _authenticated_client(cenario["usuario_b"]).post(
        url,
        _payload(cenario),
        format="json",
    )

    # 404: o projeto nem "existe" para o usuario da Empresa B (FR-013).
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_b_nao_lista_rdos_do_projeto_da_empresa_a(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/registros-diarios/"
    _authenticated_client(cenario["usuario_a"]).post(
        url,
        _payload(cenario),
        format="json",
    )

    response = _authenticated_client(cenario["usuario_b"]).get(url)

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_usuario_empresa_b_nao_acessa_rdo_da_empresa_a_por_id_direto(cenario):
    url = f"/api/v1/projetos/{cenario['projeto_a'].id}/registros-diarios/"
    create_response = _authenticated_client(cenario["usuario_a"]).post(
        url,
        _payload(cenario),
        format="json",
    )
    registro_id = create_response.json()["id"]

    response = _authenticated_client(cenario["usuario_b"]).get(
        f"/api/v1/registros-diarios/{registro_id}/",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
