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


def _payload(cenario_data, **overrides):
    payload = {
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
        "presencas": [
            {
                "nome_avulso": "João Ajudante",
                "funcao": "Ajudante",
                "status": "presente",
            },
        ],
        "maquinas": [
            {
                "identificacao_avulsa": "Escavadeira 01",
                "horas_produtivas": "6.5",
                "horas_paradas": "0",
            },
        ],
        "ocorrencias": [],
    }
    payload.update(overrides)
    return payload


def test_criar_rdo_completo_com_sub_recursos(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"

    response = _authenticated_client(cenario["usuario"]).post(
        url,
        _payload(cenario),
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    registro = RegistroDiario.objects.get()
    assert registro.projeto_id == cenario["projeto"].id
    assert registro.autor_id == cenario["usuario"].id
    assert registro.producoes.count() == 1
    assert registro.presencas.count() == 1
    assert registro.maquinas.count() == 1


def test_listar_rdos_do_projeto(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
    client = _authenticated_client(cenario["usuario"])
    client.post(url, _payload(cenario), format="json")

    response = client.get(url)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["count"] == 1


def test_detalhe_rdo_via_rota_plana(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
    client = _authenticated_client(cenario["usuario"])
    create_response = client.post(url, _payload(cenario), format="json")
    registro_id = create_response.json()["id"]

    response = client.get(f"/api/v1/registros-diarios/{registro_id}/")

    assert response.status_code == HTTPStatus.OK
    assert len(response.json()["producoes"]) == 1


def test_filtro_mes_retorna_apenas_rdos_do_mes(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
    client = _authenticated_client(cenario["usuario"])
    client.post(url, _payload(cenario, data_referencia="2026-07-17"), format="json")
    client.post(url, _payload(cenario, data_referencia="2026-08-01"), format="json")

    response = client.get(url, {"mes": "2026-07"})

    assert response.status_code == HTTPStatus.OK
    corpo = response.json()
    assert isinstance(corpo, list)
    assert len(corpo) == 1
    assert corpo[0]["data_referencia"] == "2026-07-17"


def test_filtro_mes_sem_resultado_retorna_lista_vazia(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"

    response = _authenticated_client(cenario["usuario"]).get(url, {"mes": "2026-01"})

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


def test_filtro_mes_formato_invalido_retorna_400(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"

    response = _authenticated_client(cenario["usuario"]).get(url, {"mes": "invalido"})

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_filtro_intervalo_retorna_apenas_rdos_do_periodo(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
    client = _authenticated_client(cenario["usuario"])
    client.post(url, _payload(cenario, data_referencia="2026-07-05"), format="json")
    client.post(url, _payload(cenario, data_referencia="2026-07-17"), format="json")
    client.post(url, _payload(cenario, data_referencia="2026-08-01"), format="json")

    response = client.get(url, {"data_inicio": "2026-07-01", "data_fim": "2026-07-31"})

    assert response.status_code == HTTPStatus.OK
    corpo = response.json()
    assert isinstance(corpo, list)
    assert {item["data_referencia"] for item in corpo} == {"2026-07-05", "2026-07-17"}


def test_filtro_intervalo_so_data_inicio_retorna_400(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"

    response = _authenticated_client(cenario["usuario"]).get(url, {"data_inicio": "2026-07-01"})

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_filtro_intervalo_fim_antes_do_inicio_retorna_400(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"

    response = _authenticated_client(cenario["usuario"]).get(
        url,
        {"data_inicio": "2026-07-31", "data_fim": "2026-07-01"},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_filtro_intervalo_formato_invalido_retorna_400(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"

    response = _authenticated_client(cenario["usuario"]).get(
        url,
        {"data_inicio": "invalido", "data_fim": "2026-07-31"},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_sem_filtro_mes_mantem_paginacao(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
    client = _authenticated_client(cenario["usuario"])
    client.post(url, _payload(cenario), format="json")

    response = client.get(url)

    assert response.status_code == HTTPStatus.OK
    corpo = response.json()
    assert "results" in corpo
    assert corpo["count"] == 1
