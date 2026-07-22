from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios.models import RegistroDiario

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
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=unidade)
    fiscal = UsuarioFactory(empresa=usuario.empresa)
    return {
        "usuario": usuario,
        "projeto": projeto,
        "equipe": equipe,
        "disciplina": disciplina,
        "servico": servico,
        "unidade": unidade,
        "fiscal": fiscal,
    }


def _payload(cenario_data):
    return {
        "data_referencia": "2026-07-17",
        "turno": "diurno",
        "clima": "sol",
        "equipe": str(cenario_data["equipe"].id),
        "fiscal": cenario_data["fiscal"].id,
        "producoes": [
            {
                "rodovia": "BR-365",
                "sentido": "crescente",
                "disciplina": str(cenario_data["disciplina"].id),
                "servico": str(cenario_data["servico"].id),
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


def _criar_rdo(cenario_data) -> str:
    url = f"/api/v1/projetos/{cenario_data['projeto'].id}/registros-diarios/"
    response = _authenticated_client(cenario_data["usuario"]).post(
        url,
        _payload(cenario_data),
        format="json",
    )
    assert response.status_code == HTTPStatus.CREATED, response.data
    return response.json()["id"]


def test_fiscal_aprova_rdo(cenario):
    registro_id = _criar_rdo(cenario)
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/aprovar/"
    )

    response = _authenticated_client(cenario["fiscal"]).post(url)

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["status"] == "aprovado"
    registro = RegistroDiario.objects.get(pk=registro_id)
    assert registro.aprovado_em is not None


def test_fiscal_rejeita_rdo_com_motivo(cenario):
    registro_id = _criar_rdo(cenario)
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/rejeitar/"
    )

    response = _authenticated_client(cenario["fiscal"]).post(
        url,
        {"motivo_rejeicao": "Faltam fotos do trecho."},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["status"] == "rejeitado"
    assert response.json()["motivo_rejeicao"] == "Faltam fotos do trecho."


def test_rejeitar_sem_motivo_retorna_400(cenario):
    registro_id = _criar_rdo(cenario)
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/rejeitar/"
    )

    response = _authenticated_client(cenario["fiscal"]).post(url, {}, format="json")

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_rdo_ja_decidido_nao_pode_ser_reanalisado(cenario):
    registro_id = _criar_rdo(cenario)
    url_aprovar = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/aprovar/"
    )
    client = _authenticated_client(cenario["fiscal"])
    client.post(url_aprovar)

    response = client.post(url_aprovar)

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_usuario_que_nao_e_fiscal_recebe_403(cenario):
    registro_id = _criar_rdo(cenario)
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/aprovar/"
    )

    response = _authenticated_client(cenario["usuario"]).post(url)

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_usuario_de_outra_empresa_recebe_404_ao_tentar_aprovar(cenario):
    registro_id = _criar_rdo(cenario)
    outro_usuario = UsuarioFactory()
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/aprovar/"
    )

    response = _authenticated_client(outro_usuario).post(url)

    assert response.status_code == HTTPStatus.NOT_FOUND
