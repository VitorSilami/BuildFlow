import datetime
from decimal import Decimal

import pytest
from django.utils import timezone

from buildflow.configuracoes.models import CatalogoServico
from buildflow.medicoes import services
from buildflow.medicoes.models import ItemMedicao
from buildflow.medicoes.models import Medicao
from buildflow.medicoes.models import StatusMedicaoChoices
from buildflow.medicoes.services import MedicaoInvalida
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.registros_diarios.tests.factories import CatalogoServicoFactory
from buildflow.registros_diarios.tests.factories import DisciplinaFactory
from buildflow.registros_diarios.tests.factories import EquipeFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory
from buildflow.registros_diarios.tests.factories import UnidadeFactory
from buildflow.core.tests.factories import UsuarioFactory

from .factories import MedicaoFactory

pytestmark = pytest.mark.django_db


def _aprovar_producao(*, projeto, disciplina, servico, unidade, data_referencia, quantidade):
    equipe = EquipeFactory(projeto=projeto)
    registro = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=data_referencia,
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=projeto.criado_por,
        autor=projeto.criado_por,
        status="aprovado",
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=quantidade,
        unidade=unidade,
    )


def test_primeira_medicao_parte_de_base_zero():
    projeto = ProjetoParaRdoFactory()
    unidade = UnidadeFactory()
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(
        disciplina=disciplina,
        unidade=unidade,
        preco_unitario=Decimal("10.00"),
    )
    _aprovar_producao(
        projeto=projeto,
        disciplina=disciplina,
        servico=servico,
        unidade=unidade,
        data_referencia="2026-07-01",
        quantidade=Decimal("100.000"),
    )
    fiscal = UsuarioFactory(empresa=projeto.empresa)

    medicao = services.criar_medicao(
        projeto=projeto,
        data_corte=datetime.date(2026, 7, 31),
        fiscal=fiscal,
        criado_por=projeto.criado_por,
    )

    item = medicao.itens.get(servico=servico)
    assert item.quantidade_anterior == Decimal("0.000")
    assert item.quantidade_acumulada == Decimal("100.000")
    assert item.quantidade_periodo == Decimal("100.000")
    assert item.valor_periodo == Decimal("1000.00")


def test_segunda_medicao_usa_primeira_aprovada_como_base():
    projeto = ProjetoParaRdoFactory()
    unidade = UnidadeFactory()
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(
        disciplina=disciplina,
        unidade=unidade,
        preco_unitario=Decimal("10.00"),
    )
    _aprovar_producao(
        projeto=projeto,
        disciplina=disciplina,
        servico=servico,
        unidade=unidade,
        data_referencia="2026-07-01",
        quantidade=Decimal("100.000"),
    )
    fiscal = UsuarioFactory(empresa=projeto.empresa)
    primeira = services.criar_medicao(
        projeto=projeto,
        data_corte=datetime.date(2026, 7, 10),
        fiscal=fiscal,
        criado_por=projeto.criado_por,
    )
    primeira.status = StatusMedicaoChoices.APROVADO
    primeira.aprovado_em = timezone.now()
    primeira.save(update_fields=["status", "aprovado_em"])

    _aprovar_producao(
        projeto=projeto,
        disciplina=disciplina,
        servico=servico,
        unidade=unidade,
        data_referencia="2026-07-20",
        quantidade=Decimal("150.000"),
    )

    segunda = services.criar_medicao(
        projeto=projeto,
        data_corte=datetime.date(2026, 7, 31),
        fiscal=fiscal,
        criado_por=projeto.criado_por,
    )

    item = segunda.itens.get(servico=servico)
    assert item.quantidade_anterior == Decimal("100.000")
    assert item.quantidade_acumulada == Decimal("250.000")
    assert item.quantidade_periodo == Decimal("150.000")
    assert item.valor_periodo == Decimal("1500.00")


def test_bloqueia_criacao_com_medicao_pendente_existente():
    medicao_pendente = MedicaoFactory()

    with pytest.raises(MedicaoInvalida):
        services.criar_medicao(
            projeto=medicao_pendente.projeto,
            data_corte=datetime.date(2026, 8, 1),
            fiscal=medicao_pendente.fiscal,
            criado_por=medicao_pendente.criado_por,
        )


def test_bloqueia_data_de_corte_no_futuro():
    projeto = ProjetoParaRdoFactory()
    fiscal = UsuarioFactory(empresa=projeto.empresa)
    amanha = datetime.date.today() + datetime.timedelta(days=1)

    with pytest.raises(MedicaoInvalida):
        services.criar_medicao(
            projeto=projeto,
            data_corte=amanha,
            fiscal=fiscal,
            criado_por=projeto.criado_por,
        )


def test_bloqueia_data_de_corte_nao_posterior_a_ultima_aprovada():
    projeto = ProjetoParaRdoFactory()
    fiscal = UsuarioFactory(empresa=projeto.empresa)
    aprovada = MedicaoFactory(
        projeto=projeto,
        fiscal=fiscal,
        data_corte=datetime.date(2026, 7, 20),
        status=StatusMedicaoChoices.APROVADO,
    )

    with pytest.raises(MedicaoInvalida):
        services.criar_medicao(
            projeto=projeto,
            data_corte=aprovada.data_corte,
            fiscal=fiscal,
            criado_por=projeto.criado_por,
        )


def test_servico_sem_preco_entra_com_valor_nulo_e_nao_bloqueia():
    projeto = ProjetoParaRdoFactory()
    unidade = UnidadeFactory()
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=unidade, preco_unitario=None)
    _aprovar_producao(
        projeto=projeto,
        disciplina=disciplina,
        servico=servico,
        unidade=unidade,
        data_referencia="2026-07-01",
        quantidade=Decimal("50.000"),
    )
    fiscal = UsuarioFactory(empresa=projeto.empresa)

    medicao = services.criar_medicao(
        projeto=projeto,
        data_corte=datetime.date(2026, 7, 31),
        fiscal=fiscal,
        criado_por=projeto.criado_por,
    )

    item = medicao.itens.get(servico=servico)
    assert item.preco_unitario_snapshot is None
    assert item.valor_periodo is None


def test_servico_sem_producao_nao_gera_item():
    projeto = ProjetoParaRdoFactory()
    unidade = UnidadeFactory()
    disciplina = DisciplinaFactory(projeto=projeto)
    CatalogoServicoFactory(disciplina=disciplina, unidade=unidade)
    fiscal = UsuarioFactory(empresa=projeto.empresa)

    medicao = services.criar_medicao(
        projeto=projeto,
        data_corte=datetime.date(2026, 7, 31),
        fiscal=fiscal,
        criado_por=projeto.criado_por,
    )

    assert medicao.itens.count() == 0
