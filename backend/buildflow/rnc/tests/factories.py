import datetime

import factory
from factory.django import DjangoModelFactory

from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory
from buildflow.rnc.models import RNC
from buildflow.rnc.models import CategoriaChoices
from buildflow.rnc.models import GravidadeChoices
from buildflow.rnc.models import OrigemChoices
from buildflow.rnc.models import TipoRncChoices


class RncFactory(DjangoModelFactory):
    class Meta:
        model = RNC

    projeto = factory.SubFactory(ProjetoParaRdoFactory)
    numero_sequencial = factory.Sequence(lambda n: n + 1)
    data_emissao = datetime.date(2026, 7, 1)
    contratada = "JM Engenharia e Locação Ltda"
    categoria = CategoriaChoices.TERRAPLENAGEM
    origem = OrigemChoices.SERVICO
    gravidade = GravidadeChoices.ALTA
    tipo = TipoRncChoices.AC
    item = "Cortes"
    descricao = "Variação de produtividade acima do aceitável."
    criado_por = factory.SelfAttribute("projeto.criado_por")
