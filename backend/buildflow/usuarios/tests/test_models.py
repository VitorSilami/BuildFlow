import pytest
from django.core.exceptions import ValidationError

from buildflow.core.tests.factories import EmpresaFactory
from buildflow.usuarios.models import PerfilChoices
from buildflow.usuarios.models import User

pytestmark = pytest.mark.django_db


def test_usuario_comum_sem_empresa_falha_na_validacao():
    user = User(
        email="sememp@example.com",
        nome="Sem Empresa",
        perfil=PerfilChoices.GERENTE,
        is_superuser=False,
    )

    with pytest.raises(ValidationError):
        user.full_clean()


def test_usuario_comum_com_empresa_passa_na_validacao():
    empresa = EmpresaFactory()
    user = User(
        email="comemp@example.com",
        nome="Com Empresa",
        perfil=PerfilChoices.GERENTE,
        empresa=empresa,
        is_superuser=False,
    )

    user.full_clean(exclude=["password"])  # nao deve levantar


def test_superusuario_sem_empresa_passa_na_validacao():
    user = User(
        email="admin2@example.com",
        nome="Admin",
        is_superuser=True,
        is_staff=True,
    )

    user.full_clean(exclude=["password"])  # nao deve levantar


def test_perfil_fora_do_enum_e_rejeitado():
    empresa = EmpresaFactory()
    user = User(
        email="perfilinvalido@example.com",
        nome="Perfil Invalido",
        perfil="gerente_regional",  # nao existe em PerfilChoices
        empresa=empresa,
        is_superuser=False,
    )

    with pytest.raises(ValidationError):
        user.full_clean()
