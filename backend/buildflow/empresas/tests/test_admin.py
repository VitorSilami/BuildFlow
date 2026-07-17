import pytest
from django.contrib.admin.sites import AdminSite

from buildflow.empresas.admin import EmpresaAdmin
from buildflow.empresas.models import Empresa

pytestmark = pytest.mark.django_db


def test_criar_empresa_e_buscar_por_nome():
    Empresa.objects.create(nome="Construtora Alfa", slug="construtora-alfa")

    admin = EmpresaAdmin(Empresa, AdminSite())
    changelist_queryset = admin.get_queryset(None)
    resultado, _use_distinct = admin.get_search_results(
        request=None,
        queryset=changelist_queryset,
        search_term="Alfa",
    )

    assert resultado.count() == 1
    assert resultado.first().nome == "Construtora Alfa"


def test_busca_por_nome_nao_encontra_empresa_inexistente():
    Empresa.objects.create(nome="Construtora Alfa", slug="construtora-alfa")

    admin = EmpresaAdmin(Empresa, AdminSite())
    resultado, _use_distinct = admin.get_search_results(
        request=None,
        queryset=admin.get_queryset(None),
        search_term="Beta",
    )

    assert resultado.count() == 0
