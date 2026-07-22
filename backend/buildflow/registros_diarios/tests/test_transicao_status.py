import pytest
from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios import services
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.registros_diarios.models import StatusRegistroChoices

from .factories import EquipeFactory
from .factories import ProjetoParaRdoFactory

pytestmark = pytest.mark.django_db


def _criar_rdo(*, fiscal, autor=None):
    projeto = ProjetoParaRdoFactory(criado_por=autor or fiscal)
    equipe = EquipeFactory(projeto=projeto)
    return RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-17",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=fiscal,
        autor=autor or fiscal,
    )


def test_novo_rdo_nasce_aguardando_aprovacao():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)

    assert registro.status == StatusRegistroChoices.AGUARDANDO_APROVACAO
    assert registro.aprovado_em is None


def test_aprovacao_define_status_e_aprovado_em():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)

    services.transicionar_status_registro(
        registro=registro,
        novo_status=StatusRegistroChoices.APROVADO,
        usuario=fiscal,
    )

    registro.refresh_from_db()
    assert registro.status == StatusRegistroChoices.APROVADO
    assert registro.aprovado_em is not None


def test_rejeicao_sem_motivo_levanta_erro():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)

    with pytest.raises(ValidationError):
        services.transicionar_status_registro(
            registro=registro,
            novo_status=StatusRegistroChoices.REJEITADO,
            usuario=fiscal,
            motivo_rejeicao="",
        )


def test_rejeicao_com_motivo_grava_motivo_e_status():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)

    services.transicionar_status_registro(
        registro=registro,
        novo_status=StatusRegistroChoices.REJEITADO,
        usuario=fiscal,
        motivo_rejeicao="Faltam fotos do trecho.",
    )

    registro.refresh_from_db()
    assert registro.status == StatusRegistroChoices.REJEITADO
    assert registro.motivo_rejeicao == "Faltam fotos do trecho."


def test_rdo_ja_analisado_nao_pode_ser_reanalisado():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)
    services.transicionar_status_registro(
        registro=registro,
        novo_status=StatusRegistroChoices.APROVADO,
        usuario=fiscal,
    )

    with pytest.raises(ValidationError):
        services.transicionar_status_registro(
            registro=registro,
            novo_status=StatusRegistroChoices.REJEITADO,
            usuario=fiscal,
            motivo_rejeicao="Tentando de novo",
        )


def test_usuario_que_nao_e_fiscal_nao_pode_decidir():
    fiscal = UsuarioFactory()
    outro_usuario = UsuarioFactory(empresa=fiscal.empresa)
    registro = _criar_rdo(fiscal=fiscal)

    with pytest.raises(PermissionDenied):
        services.transicionar_status_registro(
            registro=registro,
            novo_status=StatusRegistroChoices.APROVADO,
            usuario=outro_usuario,
        )
