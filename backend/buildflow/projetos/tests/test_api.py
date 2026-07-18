from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import EmpresaFactory
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto

pytestmark = pytest.mark.django_db

PROJETOS_URL = "/api/v1/projetos/"


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def test_lista_apenas_projetos_da_propria_empresa():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    Projeto.objects.create(empresa=empresa, nome="Projeto A", criado_por=usuario)

    outra_empresa = EmpresaFactory()
    outro_usuario = UsuarioFactory(empresa=outra_empresa)
    Projeto.objects.create(
        empresa=outra_empresa,
        nome="Projeto B",
        criado_por=outro_usuario,
    )

    response = _authenticated_client(usuario).get(PROJETOS_URL)

    assert response.status_code == HTTPStatus.OK
    nomes = [item["nome"] for item in response.json()["results"]]
    assert nomes == ["Projeto A"]


def test_criar_projeto_atribui_empresa_e_criado_por_automaticamente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {"nome": "Duplicação BR-365", "descricao": "Lote 2"},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED
    projeto = Projeto.objects.get(nome="Duplicação BR-365")
    assert projeto.empresa_id == empresa.id
    assert projeto.criado_por_id == usuario.id


def test_criar_projeto_ignora_empresa_enviada_no_payload():
    empresa = EmpresaFactory()
    outra_empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {"nome": "Projeto Teste", "empresa": str(outra_empresa.id)},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED
    projeto = Projeto.objects.get(nome="Projeto Teste")
    assert projeto.empresa_id == empresa.id  # nunca a empresa enviada no payload


@pytest.mark.parametrize("nome", ["", "   "])
def test_criar_projeto_com_nome_vazio_ou_so_espacos_e_rejeitado(nome):
    usuario = UsuarioFactory()

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {"nome": nome},
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_anonimo_nao_acessa_projetos():
    response = APIClient().get(PROJETOS_URL)

    # DRF usa 403 (nao 401) quando o unico authenticator configurado
    # (SessionAuthentication) nao oferece challenge WWW-Authenticate.
    assert response.status_code == HTTPStatus.FORBIDDEN


def test_criar_projeto_aceita_campos_opcionais_novos():
    usuario = UsuarioFactory()

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {
            "nome": "Duplicação BR-365",
            "numero_contrato": "CTR-2026-01",
            "trecho": "BR-365 · km 10-25",
            "engenheiro_responsavel": "Eng. Carlos Mendes",
            "status": "pausado",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED
    projeto = Projeto.objects.get(nome="Duplicação BR-365")
    assert projeto.numero_contrato == "CTR-2026-01"
    assert projeto.trecho == "BR-365 · km 10-25"
    assert projeto.engenheiro_responsavel == "Eng. Carlos Mendes"
    assert projeto.status == "pausado"


def test_criar_projeto_sem_campos_novos_usa_status_ativo_por_padrao():
    usuario = UsuarioFactory()

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {"nome": "Projeto Simples"},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED
    projeto = Projeto.objects.get(nome="Projeto Simples")
    assert projeto.numero_contrato == ""
    assert projeto.trecho == ""
    assert projeto.engenheiro_responsavel == ""
    assert projeto.status == "ativo"
