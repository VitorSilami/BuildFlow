from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.configuracoes.models import Pessoa
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


def _base_payload(cenario_data):
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
        "ocorrencias": [],
    }


def _post(cenario_data, payload):
    url = f"/api/v1/projetos/{cenario_data['projeto'].id}/registros-diarios/"
    return _authenticated_client(cenario_data["usuario"]).post(
        url,
        payload,
        format="json",
    )


def test_motivo_parada_obrigatorio_quando_ha_horas_paradas(cenario):
    payload = _base_payload(cenario)
    payload["presencas"] = [
        {"nome_avulso": "João", "funcao": "Ajudante", "status": "presente"},
    ]
    payload["maquinas"] = [
        {
            "identificacao_avulsa": "Escavadeira 01",
            "horas_produtivas": "4",
            "horas_paradas": "2",
        },
    ]

    response = _post(cenario, payload)

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert "maquinas" in response.json()


def test_motivo_parada_nao_obrigatorio_sem_horas_paradas(cenario):
    payload = _base_payload(cenario)
    payload["presencas"] = [
        {"nome_avulso": "João", "funcao": "Ajudante", "status": "presente"},
    ]
    payload["maquinas"] = [
        {
            "identificacao_avulsa": "Escavadeira 01",
            "horas_produtivas": "6",
            "horas_paradas": "0",
        },
    ]

    response = _post(cenario, payload)

    assert response.status_code == HTTPStatus.CREATED, response.data


@pytest.mark.parametrize(
    "maquina_extra",
    [
        {},  # nem maquina nem avulso
    ],
)
def test_apontamento_maquina_sem_vinculo_e_rejeitado(cenario, maquina_extra):
    payload = _base_payload(cenario)
    payload["presencas"] = [
        {"nome_avulso": "João", "funcao": "Ajudante", "status": "presente"},
    ]
    payload["maquinas"] = [
        {"horas_produtivas": "6", "horas_paradas": "0", **maquina_extra},
    ]

    response = _post(cenario, payload)

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_presenca_sem_pessoa_nem_avulso_e_rejeitada(cenario):
    payload = _base_payload(cenario)
    payload["presencas"] = [{"funcao": "Ajudante", "status": "presente"}]
    payload["maquinas"] = []

    response = _post(cenario, payload)

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert "presencas" in response.json()


def test_presenca_com_pessoa_e_avulso_ao_mesmo_tempo_e_rejeitada(cenario):
    pessoa = Pessoa.objects.create(
        equipe=cenario["equipe"],
        nome="Maria",
        funcao="Topografia",
    )
    payload = _base_payload(cenario)
    payload["presencas"] = [
        {
            "pessoa": str(pessoa.id),
            "nome_avulso": "Maria Duplicada",
            "funcao": "Topografia",
            "status": "presente",
        },
    ]
    payload["maquinas"] = []

    response = _post(cenario, payload)

    assert response.status_code == HTTPStatus.BAD_REQUEST
