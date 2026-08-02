import pytest
from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError

from buildflow.medicoes import services
from buildflow.medicoes.models import Medicao
from buildflow.medicoes.models import StatusMedicaoChoices
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.usuarios.models import PerfilChoices

from .factories import MedicaoFactory

pytestmark = pytest.mark.django_db


def test_aprovacao_define_status_e_aprovado_em():
    medicao = MedicaoFactory()

    services.transicionar_status_medicao(
        medicao=medicao,
        novo_status=StatusMedicaoChoices.APROVADO,
        usuario=medicao.fiscal,
    )

    medicao.refresh_from_db()
    assert medicao.status == StatusMedicaoChoices.APROVADO
    assert medicao.aprovado_em is not None


def test_rejeicao_sem_motivo_levanta_erro():
    medicao = MedicaoFactory()

    with pytest.raises(ValidationError):
        services.transicionar_status_medicao(
            medicao=medicao,
            novo_status=StatusMedicaoChoices.REJEITADO,
            usuario=medicao.fiscal,
            motivo_rejeicao="",
        )


def test_rejeicao_com_motivo_grava_motivo_e_status():
    medicao = MedicaoFactory()

    services.transicionar_status_medicao(
        medicao=medicao,
        novo_status=StatusMedicaoChoices.REJEITADO,
        usuario=medicao.fiscal,
        motivo_rejeicao="Quantidade divergente do RDO.",
    )

    medicao.refresh_from_db()
    assert medicao.status == StatusMedicaoChoices.REJEITADO
    assert medicao.motivo_rejeicao == "Quantidade divergente do RDO."


def test_usuario_que_nao_e_fiscal_nao_pode_decidir():
    medicao = MedicaoFactory()
    outro_usuario = UsuarioFactory(empresa=medicao.projeto.empresa)

    with pytest.raises(PermissionDenied):
        services.transicionar_status_medicao(
            medicao=medicao,
            novo_status=StatusMedicaoChoices.APROVADO,
            usuario=outro_usuario,
        )


def test_medicao_ja_analisada_nao_pode_ser_reanalisada():
    medicao = MedicaoFactory()
    services.transicionar_status_medicao(
        medicao=medicao,
        novo_status=StatusMedicaoChoices.APROVADO,
        usuario=medicao.fiscal,
    )

    with pytest.raises(ValidationError):
        services.transicionar_status_medicao(
            medicao=medicao,
            novo_status=StatusMedicaoChoices.REJEITADO,
            usuario=medicao.fiscal,
            motivo_rejeicao="Tentando de novo",
        )


def test_cancelamento_pelo_criador_remove_a_medicao():
    medicao = MedicaoFactory()
    medicao_id = medicao.id

    services.cancelar_medicao(medicao=medicao, usuario=medicao.criado_por)

    assert not Medicao.objects.filter(id=medicao_id).exists()


def test_cancelamento_por_gerente_que_nao_criou_e_permitido():
    medicao = MedicaoFactory()
    gerente = UsuarioFactory(empresa=medicao.projeto.empresa)

    services.cancelar_medicao(medicao=medicao, usuario=gerente)

    assert not Medicao.objects.filter(id=medicao.id).exists()


def test_cancelamento_por_usuario_sem_permissao_levanta_erro():
    medicao = MedicaoFactory()
    outro_usuario = UsuarioFactory(
        empresa=medicao.projeto.empresa,
        perfil=PerfilChoices.AUXILIAR_ADMINISTRATIVO,
    )

    with pytest.raises(PermissionDenied):
        services.cancelar_medicao(medicao=medicao, usuario=outro_usuario)


def test_nao_e_possivel_cancelar_medicao_ja_aprovada():
    medicao = MedicaoFactory()
    services.transicionar_status_medicao(
        medicao=medicao,
        novo_status=StatusMedicaoChoices.APROVADO,
        usuario=medicao.fiscal,
    )

    with pytest.raises(ValidationError):
        services.cancelar_medicao(medicao=medicao, usuario=medicao.criado_por)
