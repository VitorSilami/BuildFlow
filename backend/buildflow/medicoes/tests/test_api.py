from decimal import Decimal
from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.medicoes.models import StatusMedicaoChoices
from buildflow.registros_diarios.tests.factories import CatalogoServicoFactory
from buildflow.registros_diarios.tests.factories import DisciplinaFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory
from buildflow.registros_diarios.tests.factories import UnidadeFactory
from buildflow.usuarios.models import PerfilChoices

from .factories import MedicaoFactory

pytestmark = pytest.mark.django_db


def _autenticar(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(usuario)
    return client


def test_fluxo_completo_criar_listar_detalhar_aprovar():
    gerente = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(empresa=gerente.empresa, criado_por=gerente)
    unidade = UnidadeFactory()
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(
        disciplina=disciplina,
        unidade=unidade,
        preco_unitario=Decimal("10.00"),
        quantidade_executada_manual=Decimal("50.000"),
    )
    fiscal = UsuarioFactory(empresa=gerente.empresa)
    client = _autenticar(gerente)

    resposta_criar = client.post(
        f"/api/v1/projetos/{projeto.id}/medicoes/",
        {"data_corte": "2026-07-31", "fiscal": str(fiscal.id)},
        format="json",
    )
    assert resposta_criar.status_code == HTTPStatus.CREATED
    assert resposta_criar.data["status"] == StatusMedicaoChoices.AGUARDANDO_APROVACAO
    assert resposta_criar.data["valor_total"] == "500.00"
    medicao_id = resposta_criar.data["id"]

    resposta_listar = client.get(f"/api/v1/projetos/{projeto.id}/medicoes/")
    assert resposta_listar.status_code == HTTPStatus.OK
    assert len(resposta_listar.data) == 1

    url_detalhe = f"/api/v1/projetos/{projeto.id}/medicoes/{medicao_id}/"
    resposta_detalhe = client.get(url_detalhe)
    assert resposta_detalhe.status_code == HTTPStatus.OK
    assert len(resposta_detalhe.data["itens"]) == 1
    assert str(resposta_detalhe.data["itens"][0]["servico"]) == str(servico.id)

    client_fiscal = _autenticar(fiscal)
    resposta_aprovar = client_fiscal.post(
        f"/api/v1/projetos/{projeto.id}/medicoes/{medicao_id}/aprovar/",
    )
    assert resposta_aprovar.status_code == HTTPStatus.OK
    assert resposta_aprovar.data["status"] == StatusMedicaoChoices.APROVADO


def test_criacao_exige_perfil_gerente():
    auxiliar = UsuarioFactory(perfil=PerfilChoices.AUXILIAR_ADMINISTRATIVO)
    projeto = ProjetoParaRdoFactory(empresa=auxiliar.empresa, criado_por=auxiliar)
    fiscal = UsuarioFactory(empresa=auxiliar.empresa)
    client = _autenticar(auxiliar)

    resposta = client.post(
        f"/api/v1/projetos/{projeto.id}/medicoes/",
        {"data_corte": "2026-07-31", "fiscal": str(fiscal.id)},
        format="json",
    )

    assert resposta.status_code == HTTPStatus.FORBIDDEN


def test_criacao_com_pendencia_existente_retorna_400():
    medicao = MedicaoFactory()
    gerente = medicao.criado_por
    gerente.perfil = PerfilChoices.GERENTE
    gerente.save(update_fields=["perfil"])
    client = _autenticar(gerente)

    resposta = client.post(
        f"/api/v1/projetos/{medicao.projeto.id}/medicoes/",
        {"data_corte": "2026-08-01", "fiscal": str(medicao.fiscal.id)},
        format="json",
    )

    assert resposta.status_code == HTTPStatus.BAD_REQUEST
    assert "detail" in resposta.data


def test_aprovar_com_usuario_errado_retorna_403():
    medicao = MedicaoFactory()
    outro_usuario = UsuarioFactory(empresa=medicao.projeto.empresa)
    client = _autenticar(outro_usuario)

    resposta = client.post(
        f"/api/v1/projetos/{medicao.projeto.id}/medicoes/{medicao.id}/aprovar/",
    )

    assert resposta.status_code == HTTPStatus.FORBIDDEN


def test_cancelar_medicao_pendente_retorna_204():
    medicao = MedicaoFactory()
    client = _autenticar(medicao.criado_por)

    resposta = client.delete(
        f"/api/v1/projetos/{medicao.projeto.id}/medicoes/{medicao.id}/",
    )

    assert resposta.status_code == HTTPStatus.NO_CONTENT
