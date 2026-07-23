from decimal import Decimal

import pytest

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto
from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import calcular_execucao_percentual

pytestmark = pytest.mark.django_db


def _criar_projeto() -> Projeto:
    usuario = UsuarioFactory()
    return Projeto.objects.create(
        empresa=usuario.empresa,
        nome="Projeto Teste",
        criado_por=usuario,
    )


def _criar_unidade() -> Unidade:
    return Unidade.objects.create(sigla="m³", descricao="metro cúbico")


def test_servico_sem_quantidade_planejada_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina, nome="Corte", unidade=_criar_unidade(),
    )

    assert calcular_avanco_servico(servico) is None


def test_servico_com_quantidade_calcula_percentual():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("500.000"),
    )

    assert calcular_avanco_servico(servico) == Decimal("50.00")


def test_sem_disciplinas_retorna_none():
    projeto = _criar_projeto()

    assert calcular_execucao_percentual(projeto) is None


def test_disciplina_sem_peso_percentual_nao_conta_e_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=None,
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("500.000"),
        peso_percentual=Decimal("100.00"),
    )

    assert calcular_execucao_percentual(projeto) is None


def test_servico_sem_peso_nao_conta_na_disciplina():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("500.000"),
        peso_percentual=None,
    )

    assert calcular_avanco_disciplina(disciplina) is None
    assert calcular_execucao_percentual(projeto) is None


def test_uma_disciplina_um_servico_com_peso_calcula_percentual_direto():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("500.000"),
        peso_percentual=Decimal("100.00"),
    )

    assert calcular_avanco_disciplina(disciplina) == Decimal("50.00")
    assert calcular_execucao_percentual(projeto) == Decimal("50.00")


def test_duas_disciplinas_pesos_diferentes_media_ponderada():
    projeto = _criar_projeto()
    unidade = _criar_unidade()

    disc_a = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("75.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disc_a,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("1000.000"),
        peso_percentual=Decimal("100.00"),
    )

    disc_b = Disciplina.objects.create(
        projeto=projeto, nome="Pavimentação", peso_percentual=Decimal("25.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disc_b,
        nome="Base",
        unidade=unidade,
        quantidade_planejada=Decimal("200.000"),
        quantidade_executada=Decimal("100.000"),
        peso_percentual=Decimal("100.00"),
    )

    # (100% * 75 + 50% * 25) / (75 + 25) = 87.5%
    assert calcular_execucao_percentual(projeto) == Decimal("87.50")


def test_dois_servicos_pesos_diferentes_dentro_da_disciplina():
    projeto = _criar_projeto()
    unidade = _criar_unidade()
    disciplina = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"),
    )

    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("1000.000"),
        peso_percentual=Decimal("60.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
        quantidade_planejada=Decimal("500.000"),
        quantidade_executada=Decimal("0.000"),
        peso_percentual=Decimal("40.00"),
    )

    # (100% * 60 + 0% * 40) / (60 + 40) = 60%
    assert calcular_avanco_disciplina(disciplina) == Decimal("60.00")
    assert calcular_execucao_percentual(projeto) == Decimal("60.00")
