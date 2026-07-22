from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory
from buildflow.usuarios.models import PerfilChoices

pytestmark = pytest.mark.django_db


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def test_gerente_acessa_custos_ociosidade_do_proprio_projeto():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/custos-ociosidade/?mes=2026-07",
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()["mes"] == "2026-07"


def test_auxiliar_administrativo_recebe_403():
    usuario = UsuarioFactory(perfil=PerfilChoices.AUXILIAR_ADMINISTRATIVO)
    projeto = ProjetoParaRdoFactory(criado_por=UsuarioFactory(empresa=usuario.empresa))

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/custos-ociosidade/?mes=2026-07",
    )

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_projeto_de_outra_empresa_retorna_404():
    usuario_a = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto_a = ProjetoParaRdoFactory(criado_por=usuario_a)
    usuario_b = UsuarioFactory(perfil=PerfilChoices.GERENTE)

    response = _authenticated_client(usuario_b).get(
        f"/api/v1/projetos/{projeto_a.id}/custos-ociosidade/?mes=2026-07",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_mes_ausente_retorna_400():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/custos-ociosidade/",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_mes_mal_formatado_retorna_400():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/custos-ociosidade/?mes=julho-2026",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
