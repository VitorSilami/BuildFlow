from decimal import Decimal

import pytest

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import MetaMensal
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto
from buildflow.projetos.services import calcular_execucao_percentual
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario

pytestmark = pytest.mark.django_db


def _criar_projeto() -> Projeto:
    usuario = UsuarioFactory()
    return Projeto.objects.create(
        empresa=usuario.empresa,
        nome="Projeto Teste",
        criado_por=usuario,
    )


def test_sem_metas_retorna_none():
    projeto = _criar_projeto()

    assert calcular_execucao_percentual(projeto) is None


def test_meta_sem_peso_percentual_nao_conta_e_retorna_none():
    projeto = _criar_projeto()
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disciplina,
        unidade=unidade,
        valor_alvo=Decimal("1000"),
        peso_percentual=None,
    )

    assert calcular_execucao_percentual(projeto) is None


def test_uma_disciplina_com_peso_calcula_percentual_direto():
    projeto = _criar_projeto()
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")
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
        fiscal=projeto.criado_por,
        autor=projeto.criado_por,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("500"),
        unidade=unidade,
    )

    # 500 / 1000 = 50%, unica disciplina com peso 100 -> media ponderada = 50%
    assert calcular_execucao_percentual(projeto) == Decimal("50.00")


def test_producao_em_unidade_diferente_da_meta_nao_conta():
    projeto = _criar_projeto()
    unidade_m3 = Unidade.objects.create(sigla="m³", descricao="metro cúbico")
    unidade_m2 = Unidade.objects.create(sigla="m²", descricao="metro quadrado")
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade_m2,
    )
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disciplina,
        unidade=unidade_m3,
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
        fiscal=projeto.criado_por,
        autor=projeto.criado_por,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("500"),
        unidade=unidade_m2,  # unidade da producao != unidade da meta (m3)
    )

    # producao em m2 nao conta para meta em m3 -> 0 produzido / 1000 = 0%
    assert calcular_execucao_percentual(projeto) == Decimal("0.00")


def test_duas_disciplinas_pesos_diferentes_media_ponderada():
    projeto = _criar_projeto()
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")

    disc_a = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    serv_a = CatalogoServico.objects.create(disciplina=disc_a, nome="Corte", unidade=unidade)
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disc_a,
        unidade=unidade,
        valor_alvo=Decimal("1000"),
        peso_percentual=Decimal("75"),
    )

    disc_b = Disciplina.objects.create(projeto=projeto, nome="Pavimentação")
    serv_b = CatalogoServico.objects.create(disciplina=disc_b, nome="Base", unidade=unidade)
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disc_b,
        unidade=unidade,
        valor_alvo=Decimal("200"),
        peso_percentual=Decimal("25"),
    )

    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    registro = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=projeto.criado_por,
        autor=projeto.criado_por,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disc_a,
        servico=serv_a,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("1000"),  # disc_a: 100% de 1000
        unidade=unidade,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disc_b,
        servico=serv_b,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("100"),  # disc_b: 50% de 200
        unidade=unidade,
    )

    # (100% * 75 + 50% * 25) / (75 + 25) = (75 + 12.5) / 100 = 87.5%
    assert calcular_execucao_percentual(projeto) == Decimal("87.50")
