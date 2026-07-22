import datetime

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from buildflow.rnc import services
from buildflow.rnc.models import AcaoCorretiva
from buildflow.rnc.models import EficaciaChoices
from buildflow.rnc.models import StatusRncChoices
from buildflow.rnc.tests.factories import RncFactory

pytestmark = pytest.mark.django_db

EXPECTED_SEGUNDA_SEQUENCIA = 2


def test_gerar_numero_sequencial_comeca_em_1():
    rnc = RncFactory()

    numero = services.gerar_numero_sequencial(rnc.projeto)

    assert numero == EXPECTED_SEGUNDA_SEQUENCIA


def test_gerar_numero_sequencial_nao_cruza_projetos():
    RncFactory()
    outra_rnc = RncFactory()

    numero = services.gerar_numero_sequencial(outra_rnc.projeto)

    assert numero == EXPECTED_SEGUNDA_SEQUENCIA


def test_validar_item_da_categoria_aceita_item_valido():
    services.validar_item_da_categoria(categoria="terraplenagem", item="Cortes")


def test_validar_item_da_categoria_rejeita_item_de_outra_categoria():
    with pytest.raises(ValidationError):
        services.validar_item_da_categoria(categoria="terraplenagem", item="Base")


def test_concluir_rnc_exige_eficacia():
    rnc = RncFactory()

    with pytest.raises(ValidationError):
        services.concluir_rnc(rnc=rnc, eficacia="")


def test_concluir_rnc_com_sucesso():
    rnc = RncFactory()

    services.concluir_rnc(rnc=rnc, eficacia=EficaciaChoices.EFICAZ)

    rnc.refresh_from_db()
    assert rnc.status == StatusRncChoices.CONCLUIDA
    assert rnc.eficacia == EficaciaChoices.EFICAZ
    assert rnc.data_conclusao is not None


def test_concluir_rnc_ja_concluida_levanta_erro():
    rnc = RncFactory()
    services.concluir_rnc(rnc=rnc, eficacia=EficaciaChoices.EFICAZ)

    with pytest.raises(ValidationError):
        services.concluir_rnc(rnc=rnc, eficacia=EficaciaChoices.INEFICAZ)


def test_validar_rnc_editavel_aceita_pendente():
    rnc = RncFactory()
    services.validar_rnc_editavel(rnc)


def test_validar_rnc_editavel_rejeita_concluida():
    rnc = RncFactory()
    services.concluir_rnc(rnc=rnc, eficacia=EficaciaChoices.EFICAZ)

    with pytest.raises(ValidationError):
        services.validar_rnc_editavel(rnc)


def test_adicionar_acao_corretiva_cria_registro():
    rnc = RncFactory()

    acao = services.adicionar_acao_corretiva(
        rnc=rnc,
        descricao="Apresentar plano de ação corretivo",
        risco="Não cumprimento de prazo",
        data_limite=datetime.date(2026, 7, 10),
        responsavel="JM Engenharia",
    )

    assert AcaoCorretiva.objects.filter(rnc=rnc).count() == 1
    assert acao.descricao == "Apresentar plano de ação corretivo"


def test_adicionar_acao_corretiva_rejeita_rnc_concluida():
    rnc = RncFactory()
    services.concluir_rnc(rnc=rnc, eficacia=EficaciaChoices.EFICAZ)

    with pytest.raises(ValidationError):
        services.adicionar_acao_corretiva(
            rnc=rnc,
            descricao="Tentativa tardia",
            risco="",
            data_limite=datetime.date(2026, 7, 10),
            responsavel="JM Engenharia",
        )


def test_calcular_status_efetivo_pendente_sem_prazo():
    rnc = RncFactory(data_prazo=None)

    assert services.calcular_status_efetivo(rnc) == StatusRncChoices.PENDENTE


def test_calcular_status_efetivo_prazo_excedido():
    ontem = timezone.now().date() - datetime.timedelta(days=1)
    rnc = RncFactory(data_prazo=ontem)

    assert services.calcular_status_efetivo(rnc) == "prazo_excedido"


def test_calcular_status_efetivo_dentro_do_prazo():
    amanha = timezone.now().date() + datetime.timedelta(days=1)
    rnc = RncFactory(data_prazo=amanha)

    assert services.calcular_status_efetivo(rnc) == StatusRncChoices.PENDENTE


def test_calcular_status_efetivo_concluida_ignora_prazo():
    ontem = timezone.now().date() - datetime.timedelta(days=1)
    rnc = RncFactory(data_prazo=ontem)
    services.concluir_rnc(rnc=rnc, eficacia=EficaciaChoices.EFICAZ)

    assert services.calcular_status_efetivo(rnc) == StatusRncChoices.CONCLUIDA
