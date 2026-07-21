import datetime
from decimal import Decimal
from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import MetaMensal
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import EmpresaFactory
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario

pytestmark = pytest.mark.django_db

DASHBOARD_URL = "/api/v1/dashboard/"


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def test_conta_projetos_por_status():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    Projeto.objects.create(
        empresa=empresa,
        nome="Ativo 1",
        criado_por=usuario,
        status="ativo",
    )
    Projeto.objects.create(
        empresa=empresa,
        nome="Ativo 2",
        criado_por=usuario,
        status="ativo",
    )
    Projeto.objects.create(
        empresa=empresa,
        nome="Pausado",
        criado_por=usuario,
        status="pausado",
    )
    Projeto.objects.create(
        empresa=empresa,
        nome="Concluido",
        criado_por=usuario,
        status="concluido",
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["projetos_ativos"] == 2  # noqa: PLR2004
    assert body["projetos_pausados"] == 1
    assert body["projetos_concluidos"] == 1


def test_isolamento_multitenant_no_dashboard():
    empresa_a = EmpresaFactory()
    usuario_a = UsuarioFactory(empresa=empresa_a)
    Projeto.objects.create(empresa=empresa_a, nome="Projeto A", criado_por=usuario_a)

    empresa_b = EmpresaFactory()
    usuario_b = UsuarioFactory(empresa=empresa_b)
    Projeto.objects.create(empresa=empresa_b, nome="Projeto B", criado_por=usuario_b)

    response = _authenticated_client(usuario_a).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["projetos_ativos"] == 1
    nomes = [p["nome"] for p in body["projetos"]]
    assert nomes == ["Projeto A"]


def test_execucao_media_null_quando_sem_metas():
    usuario = UsuarioFactory()
    Projeto.objects.create(empresa=usuario.empresa, nome="Sem Meta", criado_por=usuario)

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["execucao_media"] is None


def test_execucao_media_calculada_entre_projetos_ativos():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")

    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Com Meta",
        criado_por=usuario,
    )
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
    )
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disciplina,
        unidade=unidade,
        valor_alvo=Decimal("1000"),
        peso_percentual=Decimal("100"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    registro = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("400"),
        unidade=unidade,
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["execucao_media"] == "40.00"


def test_alerta_para_projeto_ativo_sem_rdo_recente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Atrasado",
        criado_por=usuario,
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=datetime.date.today() - datetime.timedelta(days=9),  # noqa: DTZ011
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    alertas = response.json()["alertas"]
    assert len(alertas) == 1
    assert alertas[0]["projeto_nome"] == "Atrasado"
    assert alertas[0]["dias_sem_rdo"] == 9  # noqa: PLR2004


def test_alerta_para_projeto_ativo_sem_nenhum_rdo():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    Projeto.objects.create(
        empresa=empresa,
        nome="Nunca Registrado",
        criado_por=usuario,
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    alertas = response.json()["alertas"]
    assert len(alertas) == 1
    assert alertas[0]["projeto_nome"] == "Nunca Registrado"
    assert alertas[0]["dias_sem_rdo"] is None


def test_sem_alerta_para_projeto_com_rdo_recente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(empresa=empresa, nome="Em Dia", criado_por=usuario)
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=datetime.date.today() - datetime.timedelta(days=1),  # noqa: DTZ011
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["alertas"] == []


def test_anonimo_nao_acessa_dashboard():
    response = APIClient().get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_atividade_rdo_aparece_no_dashboard():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Ativo",
        criado_por=usuario,
        status="ativo",
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=datetime.date.today(),  # noqa: DTZ011
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    atividade = response.json()["atividade_rdo"]
    assert len(atividade) == 7  # noqa: PLR2004
    assert atividade[-1]["quantidade"] == 1
