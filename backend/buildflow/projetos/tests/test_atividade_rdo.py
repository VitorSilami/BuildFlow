import datetime

import pytest

from buildflow.configuracoes.models import Equipe
from buildflow.core.tests.factories import EmpresaFactory
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto
from buildflow.projetos.services import obter_atividade_rdo_semana
from buildflow.registros_diarios.models import RegistroDiario

pytestmark = pytest.mark.django_db


def _criar_rdo(projeto, equipe, usuario, data):
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=data,
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )


def test_sete_dias_preenchidos_mesmo_sem_rdo():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    Projeto.objects.create(
        empresa=empresa,
        nome="Sem RDO",
        criado_por=usuario,
        status="ativo",
    )

    resultado = obter_atividade_rdo_semana(empresa)

    assert len(resultado) == 7  # noqa: PLR2004
    assert all(dia["quantidade"] == 0 for dia in resultado)


def test_ordenado_do_dia_mais_antigo_para_o_mais_recente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    Projeto.objects.create(
        empresa=empresa,
        nome="Sem RDO",
        criado_por=usuario,
        status="ativo",
    )

    resultado = obter_atividade_rdo_semana(empresa)

    datas = [dia["data"] for dia in resultado]
    assert datas == sorted(datas)
    assert datas[-1] == datetime.date.today().isoformat()  # noqa: DTZ011


def test_conta_rdos_do_dia_correto():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Ativo",
        criado_por=usuario,
        status="ativo",
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")

    hoje = datetime.date.today()  # noqa: DTZ011
    _criar_rdo(projeto, equipe, usuario, hoje)
    _criar_rdo(projeto, equipe, usuario, hoje)  # segundo turno, mesmo dia
    _criar_rdo(projeto, equipe, usuario, hoje - datetime.timedelta(days=2))

    resultado = obter_atividade_rdo_semana(empresa)
    por_data = {dia["data"]: dia["quantidade"] for dia in resultado}

    assert por_data[hoje.isoformat()] == 2  # noqa: PLR2004
    assert por_data[(hoje - datetime.timedelta(days=2)).isoformat()] == 1


def test_ignora_rdo_de_projeto_pausado():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Pausado",
        criado_por=usuario,
        status="pausado",
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    _criar_rdo(projeto, equipe, usuario, datetime.date.today())  # noqa: DTZ011

    resultado = obter_atividade_rdo_semana(empresa)

    assert all(dia["quantidade"] == 0 for dia in resultado)


def test_ignora_rdo_de_outra_empresa():
    empresa_a = EmpresaFactory()
    usuario_a = UsuarioFactory(empresa=empresa_a)
    Projeto.objects.create(
        empresa=empresa_a,
        nome="A",
        criado_por=usuario_a,
        status="ativo",
    )

    empresa_b = EmpresaFactory()
    usuario_b = UsuarioFactory(empresa=empresa_b)
    projeto_b = Projeto.objects.create(
        empresa=empresa_b,
        nome="B",
        criado_por=usuario_b,
        status="ativo",
    )
    equipe_b = Equipe.objects.create(projeto=projeto_b, nome="Equipe B")
    _criar_rdo(projeto_b, equipe_b, usuario_b, datetime.date.today())  # noqa: DTZ011

    resultado = obter_atividade_rdo_semana(empresa_a)

    assert all(dia["quantidade"] == 0 for dia in resultado)
