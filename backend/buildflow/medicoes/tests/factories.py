import factory
from factory.django import DjangoModelFactory

from buildflow.medicoes.models import ItemMedicao
from buildflow.medicoes.models import Medicao
from buildflow.registros_diarios.tests.factories import CatalogoServicoFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory
from buildflow.core.tests.factories import UsuarioFactory


class MedicaoFactory(DjangoModelFactory):
    class Meta:
        model = Medicao

    projeto = factory.SubFactory(ProjetoParaRdoFactory)
    data_corte = "2026-07-31"
    fiscal = factory.SubFactory(UsuarioFactory)
    criado_por = factory.SubFactory(UsuarioFactory)


class ItemMedicaoFactory(DjangoModelFactory):
    class Meta:
        model = ItemMedicao

    medicao = factory.SubFactory(MedicaoFactory)
    servico = factory.SubFactory(CatalogoServicoFactory)
    quantidade_anterior = "0.000"
    quantidade_acumulada = "100.000"
    quantidade_periodo = "100.000"
    preco_unitario_snapshot = "10.00"
    valor_periodo = "1000.00"
