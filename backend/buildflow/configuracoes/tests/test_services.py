from decimal import Decimal

import pytest

from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.services import soma_pesos_disciplinas
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto

pytestmark = pytest.mark.django_db


def _criar_projeto() -> Projeto:
    usuario = UsuarioFactory()
    return Projeto.objects.create(
        empresa=usuario.empresa, nome="Projeto Teste", criado_por=usuario,
    )


def test_soma_pesos_disciplinas_ignora_subdisciplinas():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"),
    )
    Disciplina.objects.create(
        projeto=projeto,
        nome="Movimento de Terra",
        pai=pai,
        peso_percentual=Decimal("60.00"),
    )

    assert soma_pesos_disciplinas(projeto) == Decimal("100.00")


def test_soma_pesos_disciplinas_soma_so_raizes():
    projeto = _criar_projeto()
    Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("60.00"),
    )
    Disciplina.objects.create(
        projeto=projeto, nome="Drenagem", peso_percentual=Decimal("40.00"),
    )

    assert soma_pesos_disciplinas(projeto) == Decimal("100.00")
