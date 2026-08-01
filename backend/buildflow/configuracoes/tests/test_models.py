from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto

pytestmark = pytest.mark.django_db


def _criar_projeto() -> Projeto:
    usuario = UsuarioFactory()
    return Projeto.objects.create(
        empresa=usuario.empresa, nome="Projeto Teste", criado_por=usuario,
    )


def test_disciplina_aceita_peso_percentual_opcional():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto,
        nome="Terraplenagem",
        peso_percentual=Decimal("40.00"),
    )

    assert disciplina.peso_percentual == Decimal("40.00")


def test_disciplina_sem_peso_percentual_fica_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")

    assert disciplina.peso_percentual is None


def test_catalogo_servico_quantidade_executada_default_zero():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")

    servico = CatalogoServico.objects.create(
        disciplina=disciplina, nome="Corte", unidade=unidade,
    )

    assert servico.quantidade_executada_manual == Decimal("0")
    assert servico.quantidade_planejada is None
    assert servico.peso_percentual is None


def test_catalogo_servico_aceita_peso_e_quantidades():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")

    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        peso_percentual=Decimal("60.00"),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("250.000"),
    )

    assert servico.peso_percentual == Decimal("60.00")
    assert servico.quantidade_planejada == Decimal("1000.000")
    assert servico.quantidade_executada_manual == Decimal("250.000")


def test_disciplina_e_raiz_por_padrao():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")

    assert disciplina.pai is None


def test_disciplina_pode_ter_subdisciplina():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    filha = Disciplina.objects.create(
        projeto=projeto, nome="Movimento de Terra", pai=pai,
    )

    assert filha.pai_id == pai.id
    assert list(pai.subdisciplinas.all()) == [filha]


def test_deletar_disciplina_pai_remove_subdisciplinas_em_cascata():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    filha = Disciplina.objects.create(
        projeto=projeto, nome="Movimento de Terra", pai=pai,
    )

    pai.delete()

    assert not Disciplina.objects.filter(id=filha.id).exists()


def test_disciplina_clean_rejeita_ciclo_de_ancestralidade():
    projeto = _criar_projeto()
    a = Disciplina.objects.create(projeto=projeto, nome="A")
    b = Disciplina.objects.create(projeto=projeto, nome="B", pai=a)

    a.pai = b

    with pytest.raises(ValidationError):
        a.full_clean()
