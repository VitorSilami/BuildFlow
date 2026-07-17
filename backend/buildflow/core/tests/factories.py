import factory
from factory.django import DjangoModelFactory

from buildflow.empresas.models import Empresa
from buildflow.usuarios.models import PerfilChoices
from buildflow.usuarios.models import User


class EmpresaFactory(DjangoModelFactory):
    class Meta:
        model = Empresa
        django_get_or_create = ("slug",)

    nome = factory.Sequence(lambda n: f"Empresa {n}")
    slug = factory.Sequence(lambda n: f"empresa-{n}")
    is_active = True


class UsuarioFactory(DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ("email",)

    email = factory.Sequence(lambda n: f"usuario{n}@example.com")
    nome = factory.Faker("name")
    empresa = factory.SubFactory(EmpresaFactory)
    perfil = PerfilChoices.GERENTE
    is_active = True
