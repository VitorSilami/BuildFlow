import factory
from factory.django import DjangoModelFactory

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto


class ProjetoParaRdoFactory(DjangoModelFactory):
    class Meta:
        model = Projeto

    empresa = factory.SelfAttribute("criado_por.empresa")
    nome = factory.Sequence(lambda n: f"Projeto {n}")
    criado_por = factory.SubFactory(UsuarioFactory)


class EquipeFactory(DjangoModelFactory):
    class Meta:
        model = Equipe

    projeto = factory.SubFactory(ProjetoParaRdoFactory)
    nome = factory.Sequence(lambda n: f"Equipe {n}")


class DisciplinaFactory(DjangoModelFactory):
    class Meta:
        model = Disciplina

    projeto = factory.SubFactory(ProjetoParaRdoFactory)
    nome = factory.Sequence(lambda n: f"Disciplina {n}")


class UnidadeFactory(DjangoModelFactory):
    class Meta:
        model = Unidade
        django_get_or_create = ("sigla",)

    sigla = "m"
    descricao = "metro"


class CatalogoServicoFactory(DjangoModelFactory):
    class Meta:
        model = CatalogoServico

    disciplina = factory.SubFactory(DisciplinaFactory)
    nome = factory.Sequence(lambda n: f"Serviço {n}")
    unidade = factory.SubFactory(UnidadeFactory)
