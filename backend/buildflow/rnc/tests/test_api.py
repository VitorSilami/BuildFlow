from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory
from buildflow.rnc.models import RNC
from buildflow.usuarios.models import PerfilChoices

from .factories import RncFactory

pytestmark = pytest.mark.django_db


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def _payload(**overrides):
    payload = {
        "data_emissao": "2026-07-17",
        "contratada": "JM Engenharia e Locação Ltda",
        "categoria": "terraplenagem",
        "origem": "servico",
        "gravidade": "alta",
        "tipo": "ac",
        "item": "Cortes",
        "descricao": "Variação de produtividade acima do aceitável.",
        "acoes_corretivas": [],
    }
    payload.update(overrides)
    return payload


def test_gerente_cria_rnc():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    url = f"/api/v1/projetos/{projeto.id}/rncs/"

    response = _authenticated_client(usuario).post(url, _payload(), format="json")

    assert response.status_code == HTTPStatus.CREATED, response.data
    rnc = RNC.objects.get()
    assert rnc.numero_sequencial == 1
    assert rnc.criado_por_id == usuario.id


def test_criar_rnc_com_item_invalido_retorna_400():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    url = f"/api/v1/projetos/{projeto.id}/rncs/"

    response = _authenticated_client(usuario).post(
        url,
        _payload(item="Item que não existe"),
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_criar_rnc_com_acoes_corretivas_aninhadas():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    url = f"/api/v1/projetos/{projeto.id}/rncs/"

    response = _authenticated_client(usuario).post(
        url,
        _payload(
            acoes_corretivas=[
                {
                    "descricao": "Apresentar plano de ação",
                    "risco": "Atraso",
                    "data_limite": "2026-07-30",
                    "responsavel": "JM Engenharia",
                },
            ],
        ),
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert len(response.json()["acoes_corretivas"]) == 1


def test_segunda_rnc_do_mesmo_projeto_recebe_numero_2():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    url = f"/api/v1/projetos/{projeto.id}/rncs/"
    client = _authenticated_client(usuario)
    client.post(url, _payload(), format="json")

    response = client.post(url, _payload(), format="json")

    expected_numero = 2
    assert response.json()["numero_sequencial"] == expected_numero


def test_listar_rncs_filtra_por_status():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    rnc_pendente = RncFactory(projeto=projeto, criado_por=usuario)
    rnc_concluida = RncFactory(projeto=projeto, criado_por=usuario)
    rnc_concluida.status = "concluida"
    rnc_concluida.save(update_fields=["status"])

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/rncs/",
        {"status": "pendente"},
    )

    assert response.status_code == HTTPStatus.OK
    corpo = response.json()
    assert isinstance(corpo, list)
    assert len(corpo) == 1
    assert corpo[0]["id"] == str(rnc_pendente.id)


def test_listar_rncs_filtra_por_intervalo_de_data_emissao():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    dentro_do_intervalo = RncFactory(
        projeto=projeto,
        criado_por=usuario,
        data_emissao="2026-07-15",
    )
    RncFactory(projeto=projeto, criado_por=usuario, data_emissao="2026-06-01")

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/rncs/",
        {"data_inicio": "2026-07-01", "data_fim": "2026-07-31"},
    )

    assert response.status_code == HTTPStatus.OK
    corpo = response.json()
    assert len(corpo) == 1
    assert corpo[0]["id"] == str(dentro_do_intervalo.id)


def test_listar_rncs_intervalo_formato_invalido_retorna_400():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/rncs/",
        {"data_inicio": "invalido", "data_fim": "2026-07-31"},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_detalhe_rnc_via_rota_plana():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    rnc = RncFactory(criado_por=usuario, projeto__criado_por=usuario)

    response = _authenticated_client(usuario).get(f"/api/v1/rncs/{rnc.id}/")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["status_efetivo"] == "pendente"


def test_patch_rnc_pendente_atualiza_causa_raiz():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    rnc = RncFactory(criado_por=usuario, projeto__criado_por=usuario)

    response = _authenticated_client(usuario).patch(
        f"/api/v1/rncs/{rnc.id}/",
        {"causa_metodo": True, "causa_metodo_detalhe": "Processo inadequado"},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    rnc.refresh_from_db()
    assert rnc.causa_metodo is True
    assert rnc.causa_metodo_detalhe == "Processo inadequado"


def test_patch_rnc_concluida_retorna_400():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    rnc = RncFactory(criado_por=usuario, projeto__criado_por=usuario)
    _authenticated_client(usuario).post(
        f"/api/v1/rncs/{rnc.id}/concluir/",
        {"eficacia": "eficaz"},
        format="json",
    )

    response = _authenticated_client(usuario).patch(
        f"/api/v1/rncs/{rnc.id}/",
        {"descricao": "Tentando editar depois de concluída"},
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_concluir_rnc_com_sucesso():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    rnc = RncFactory(criado_por=usuario, projeto__criado_por=usuario)

    response = _authenticated_client(usuario).post(
        f"/api/v1/rncs/{rnc.id}/concluir/",
        {"eficacia": "eficaz"},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["status"] == "concluida"


def test_concluir_rnc_sem_eficacia_retorna_400():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    rnc = RncFactory(criado_por=usuario, projeto__criado_por=usuario)

    response = _authenticated_client(usuario).post(
        f"/api/v1/rncs/{rnc.id}/concluir/",
        {},
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_adicionar_acao_corretiva_via_subendpoint():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    rnc = RncFactory(criado_por=usuario, projeto__criado_por=usuario)

    response = _authenticated_client(usuario).post(
        f"/api/v1/rncs/{rnc.id}/acoes-corretivas/",
        {
            "descricao": "Nova ação",
            "risco": "Risco X",
            "data_limite": "2026-08-01",
            "responsavel": "JM Engenharia",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert rnc.acoes_corretivas.count() == 1


def test_auxiliar_administrativo_recebe_403_em_todas_as_rotas():
    usuario = UsuarioFactory(perfil=PerfilChoices.AUXILIAR_ADMINISTRATIVO)
    projeto = ProjetoParaRdoFactory(criado_por=UsuarioFactory(empresa=usuario.empresa))
    rnc = RncFactory(projeto=projeto, criado_por=projeto.criado_por)
    client = _authenticated_client(usuario)

    assert (
        client.get(f"/api/v1/projetos/{projeto.id}/rncs/").status_code
        == HTTPStatus.FORBIDDEN
    )
    assert client.get(f"/api/v1/rncs/{rnc.id}/").status_code == HTTPStatus.FORBIDDEN
    assert (
        client.post(
            f"/api/v1/rncs/{rnc.id}/concluir/",
            {"eficacia": "eficaz"},
            format="json",
        ).status_code
        == HTTPStatus.FORBIDDEN
    )


def test_usuario_de_outra_empresa_recebe_404():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    rnc = RncFactory()

    response = _authenticated_client(usuario).get(f"/api/v1/rncs/{rnc.id}/")

    assert response.status_code == HTTPStatus.NOT_FOUND
