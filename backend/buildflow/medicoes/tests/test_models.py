import pytest
from django.db import IntegrityError
from django.db import transaction

from buildflow.medicoes.models import StatusMedicaoChoices

from .factories import MedicaoFactory

pytestmark = pytest.mark.django_db


def test_medicao_nasce_aguardando_aprovacao():
    medicao = MedicaoFactory()

    assert medicao.status == StatusMedicaoChoices.AGUARDANDO_APROVACAO
    assert medicao.aprovado_em is None


def test_nao_permite_duas_medicoes_pendentes_no_mesmo_projeto():
    primeira = MedicaoFactory()

    with transaction.atomic(), pytest.raises(IntegrityError):
        MedicaoFactory(projeto=primeira.projeto)


def test_permite_segunda_medicao_pendente_apos_a_primeira_ser_aprovada():
    primeira = MedicaoFactory()
    primeira.status = StatusMedicaoChoices.APROVADO
    primeira.save(update_fields=["status"])

    segunda = MedicaoFactory(projeto=primeira.projeto)

    assert segunda.pk is not None
