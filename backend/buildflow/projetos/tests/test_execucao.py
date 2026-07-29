import datetime
from decimal import Decimal

import pytest

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto
from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import calcular_carta_controle
from buildflow.projetos.services import calcular_execucao_percentual
from buildflow.projetos.services import calcular_quantidade_executada_total
from buildflow.projetos.services import listar_producoes_vinculadas
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario

pytestmark = pytest.mark.django_db


def _criar_projeto() -> Projeto:
    usuario = UsuarioFactory()
    return Projeto.objects.create(
        empresa=usuario.empresa,
        nome="Projeto Teste",
        criado_por=usuario,
    )


def _criar_unidade() -> Unidade:
    return Unidade.objects.create(sigla="m³", descricao="metro cúbico")


def test_servico_sem_quantidade_planejada_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
    )

    assert calcular_avanco_servico(servico) is None


def test_servico_com_quantidade_calcula_percentual():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("500.000"),
    )

    assert calcular_avanco_servico(servico) == Decimal("50.00")


def test_sem_disciplinas_retorna_none():
    projeto = _criar_projeto()

    assert calcular_execucao_percentual(projeto) is None


def test_disciplina_sem_peso_percentual_nao_conta_e_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto,
        nome="Terraplenagem",
        peso_percentual=None,
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("500.000"),
        peso_percentual=Decimal("100.00"),
    )

    assert calcular_execucao_percentual(projeto) is None


def test_servico_sem_peso_nao_conta_na_disciplina():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto,
        nome="Terraplenagem",
        peso_percentual=Decimal("100.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("500.000"),
        peso_percentual=None,
    )

    assert calcular_avanco_disciplina(disciplina) is None
    assert calcular_execucao_percentual(projeto) is None


def test_servico_com_peso_mas_sem_quantidade_planejada_nao_conta_na_disciplina():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto,
        nome="Terraplenagem",
        peso_percentual=Decimal("100.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        peso_percentual=Decimal("100.00"),
    )

    assert calcular_avanco_disciplina(disciplina) is None


def test_uma_disciplina_um_servico_com_peso_calcula_percentual_direto():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto,
        nome="Terraplenagem",
        peso_percentual=Decimal("100.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("500.000"),
        peso_percentual=Decimal("100.00"),
    )

    assert calcular_avanco_disciplina(disciplina) == Decimal("50.00")
    assert calcular_execucao_percentual(projeto) == Decimal("50.00")


def test_duas_disciplinas_pesos_diferentes_media_ponderada():
    projeto = _criar_projeto()
    unidade = _criar_unidade()

    disc_a = Disciplina.objects.create(
        projeto=projeto,
        nome="Terraplenagem",
        peso_percentual=Decimal("75.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disc_a,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("1000.000"),
        peso_percentual=Decimal("100.00"),
    )

    disc_b = Disciplina.objects.create(
        projeto=projeto,
        nome="Pavimentação",
        peso_percentual=Decimal("25.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disc_b,
        nome="Base",
        unidade=unidade,
        quantidade_planejada=Decimal("200.000"),
        quantidade_executada_manual=Decimal("100.000"),
        peso_percentual=Decimal("100.00"),
    )

    # (100% * 75 + 50% * 25) / (75 + 25) = 87.5%
    assert calcular_execucao_percentual(projeto) == Decimal("87.50")


def test_dois_servicos_pesos_diferentes_dentro_da_disciplina():
    projeto = _criar_projeto()
    unidade = _criar_unidade()
    disciplina = Disciplina.objects.create(
        projeto=projeto,
        nome="Terraplenagem",
        peso_percentual=Decimal("100.00"),
    )

    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("1000.000"),
        peso_percentual=Decimal("60.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
        quantidade_planejada=Decimal("500.000"),
        quantidade_executada_manual=Decimal("0.000"),
        peso_percentual=Decimal("40.00"),
    )

    # (100% * 60 + 0% * 40) / (60 + 40) = 60%
    assert calcular_avanco_disciplina(disciplina) == Decimal("60.00")
    assert calcular_execucao_percentual(projeto) == Decimal("60.00")


def test_quantidade_executada_total_soma_producoes_diarias_do_servico():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    registro_1 = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    registro_2 = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-02",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_1,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("100.000"),
        unidade=unidade,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_2,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("1.000"),
        km_final=Decimal("2.000"),
        quantidade=Decimal("150.000"),
        unidade=unidade,
    )

    assert calcular_quantidade_executada_total(servico) == Decimal("250.000")


def test_quantidade_executada_total_soma_ajuste_manual_e_producoes_diarias():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("300.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    registro = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("100.000"),
        unidade=unidade,
    )

    assert calcular_quantidade_executada_total(servico) == Decimal("400.000")


def test_quantidade_executada_total_sem_producoes_usa_so_ajuste_manual():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("500.000"),
    )

    assert calcular_quantidade_executada_total(servico) == Decimal("500.000")


def test_avanco_servico_usa_soma_de_producoes_diarias():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    registro = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("400.000"),
        unidade=unidade,
    )

    assert calcular_avanco_servico(servico) == Decimal("40.00")


def test_listar_producoes_vinculadas_ordena_do_mais_recente_para_o_mais_antigo():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    registro_antigo = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    registro_recente = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-10",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_antigo,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("100.000"),
        unidade=unidade,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_recente,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("1.000"),
        km_final=Decimal("2.000"),
        quantidade=Decimal("150.000"),
        unidade=unidade,
    )

    resultado = listar_producoes_vinculadas(servico)

    assert [str(p.quantidade) for p in resultado] == ["150.000", "100.000"]


def test_quantidade_executada_total_exclui_producao_de_rdo_rejeitado():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    registro = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="rejeitado",
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("400.000"),
        unidade=unidade,
    )

    assert calcular_quantidade_executada_total(servico) == Decimal("0")
    assert calcular_avanco_servico(servico) == Decimal("0.00")


def test_quantidade_executada_total_exclui_producao_de_rdo_aguardando_aprovacao():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    registro = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("400.000"),
        unidade=unidade,
    )

    assert calcular_quantidade_executada_total(servico) == Decimal("0")
    assert calcular_avanco_servico(servico) == Decimal("0.00")


def _criar_producoes_diarias(
    servico: CatalogoServico,
    valores_por_dia: list[Decimal],
) -> None:
    """Cria um RegistroDiario aprovado + uma ProducaoDiaria por dia, um dia
    apos o outro a partir de 2026-07-01 — usado para popular a amostra da
    carta de controle nos testes."""
    disciplina = servico.disciplina
    projeto = disciplina.projeto
    unidade = servico.unidade
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    for indice, valor in enumerate(valores_por_dia):
        registro = RegistroDiario.objects.create(
            projeto=projeto,
            data_referencia=datetime.date(2026, 7, 1) + datetime.timedelta(days=indice),
            turno="diurno",
            clima="sol",
            equipe=equipe,
            fiscal=usuario,
            autor=usuario,
            status="aprovado",
        )
        ProducaoDiaria.objects.create(
            registro_diario=registro,
            rodovia="BR-365",
            sentido="crescente",
            disciplina=disciplina,
            servico=servico,
            km_inicial=Decimal("0.000"),
            km_final=Decimal("1.000"),
            quantidade=valor,
            unidade=unidade,
        )


def test_carta_controle_com_menos_de_5_dias_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("10000.000"),
    )
    _criar_producoes_diarias(servico, [Decimal("100.000")] * 4)

    assert calcular_carta_controle(servico) is None


def test_carta_controle_com_5_dias_calcula_media_desvio_e_limites():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("10000.000"),
    )
    _criar_producoes_diarias(
        servico,
        [
            Decimal("100.000"),
            Decimal("110.000"),
            Decimal("90.000"),
            Decimal("105.000"),
            Decimal("95.000"),
        ],
    )

    cc = calcular_carta_controle(servico)

    assert cc is not None
    assert cc.media == Decimal("100.000")
    assert cc.desvio_padrao == Decimal("7.906")
    assert cc.lsc == Decimal("123.718")
    assert cc.lic == Decimal("76.282")
    assert len(cc.pontos) == 5  # noqa: PLR2004
    assert [p.data_referencia for p in cc.pontos] == [
        datetime.date(2026, 7, 1),
        datetime.date(2026, 7, 2),
        datetime.date(2026, 7, 3),
        datetime.date(2026, 7, 4),
        datetime.date(2026, 7, 5),
    ]
    assert all(p.fora_de_controle is False for p in cc.pontos)


def test_carta_controle_soma_dois_lancamentos_do_mesmo_dia_antes_da_amostra():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("10000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    for indice in range(4):
        registro = RegistroDiario.objects.create(
            projeto=projeto,
            data_referencia=datetime.date(2026, 7, 1) + datetime.timedelta(days=indice),
            turno="diurno",
            clima="sol",
            equipe=equipe,
            fiscal=usuario,
            autor=usuario,
            status="aprovado",
        )
        ProducaoDiaria.objects.create(
            registro_diario=registro,
            rodovia="BR-365",
            sentido="crescente",
            disciplina=disciplina,
            servico=servico,
            km_inicial=Decimal("0.000"),
            km_final=Decimal("1.000"),
            quantidade=Decimal("100.000"),
            unidade=unidade,
        )
    # 5o dia: dois lancamentos no mesmo RDO, devem somar 100 antes de virar 1 ponto
    registro_5 = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=datetime.date(2026, 7, 5),
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_5,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("0.500"),
        quantidade=Decimal("70.000"),
        unidade=unidade,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_5,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.500"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("30.000"),
        unidade=unidade,
    )

    cc = calcular_carta_controle(servico)

    assert cc is not None
    assert len(cc.pontos) == 5  # noqa: PLR2004
    assert cc.pontos[4].quantidade == Decimal("100.000")
    assert cc.media == Decimal("100.000")
    assert cc.desvio_padrao == Decimal("0.000")


def test_carta_controle_marca_ponto_acima_do_lsc_como_fora_de_controle():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("10000.000"),
    )
    _criar_producoes_diarias(servico, [Decimal("100.000")] * 14 + [Decimal("400.000")])

    cc = calcular_carta_controle(servico)

    assert cc is not None
    assert cc.media == Decimal("120.000")
    assert cc.desvio_padrao == Decimal("77.460")
    assert cc.lsc == Decimal("352.380")
    assert cc.lic == Decimal("0.000")
    assert [p.fora_de_controle for p in cc.pontos] == [False] * 14 + [True]


def test_carta_controle_marca_ponto_abaixo_do_lic_como_fora_de_controle():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("10000.000"),
    )
    _criar_producoes_diarias(servico, [Decimal("100.000")] * 14 + [Decimal("1.000")])

    cc = calcular_carta_controle(servico)

    assert cc is not None
    assert cc.media == Decimal("93.400")
    assert cc.desvio_padrao == Decimal("25.562")
    assert cc.lsc == Decimal("170.086")
    assert cc.lic == Decimal("16.714")
    assert [p.fora_de_controle for p in cc.pontos] == [False] * 14 + [True]


from buildflow.projetos.services import StatusEapChoices
from buildflow.projetos.services import calcular_avanco_previsto_disciplina
from buildflow.projetos.services import calcular_avanco_previsto_servico
from buildflow.projetos.services import classificar_status_eap


def test_avanco_previsto_servico_sem_datas_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
    )

    assert calcular_avanco_previsto_servico(servico) is None


def test_avanco_previsto_servico_antes_do_inicio_retorna_zero():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        data_inicio_prevista=datetime.date(2026, 8, 1),
        data_fim_prevista=datetime.date(2026, 8, 31),
    )

    previsto = calcular_avanco_previsto_servico(servico, hoje=datetime.date(2026, 7, 15))

    assert previsto == Decimal("0")


def test_avanco_previsto_servico_depois_do_fim_retorna_cem():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 1, 31),
    )

    previsto = calcular_avanco_previsto_servico(servico, hoje=datetime.date(2026, 3, 1))

    assert previsto == Decimal("100")


def test_avanco_previsto_servico_no_meio_interpola_linearmente():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 1, 11),
    )

    # 3 de 10 dias decorridos = 30%
    previsto = calcular_avanco_previsto_servico(servico, hoje=datetime.date(2026, 1, 4))

    assert previsto == Decimal("30.00")


def test_avanco_previsto_disciplina_ignora_servico_sem_data():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        peso_percentual=Decimal("60.00"),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 2, 1),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
        peso_percentual=Decimal("40.00"),
    )

    # Aterro nao tem data, entao nao entra na conta — sobra so o Corte (100% previsto)
    previsto = calcular_avanco_previsto_disciplina(disciplina, hoje=datetime.date(2026, 6, 1))

    assert previsto == Decimal("100.00")


def test_avanco_previsto_disciplina_pondera_por_peso():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        peso_percentual=Decimal("60.00"),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 2, 1),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
        peso_percentual=Decimal("40.00"),
        data_inicio_prevista=datetime.date(2026, 12, 1),
        data_fim_prevista=datetime.date(2027, 1, 1),
    )

    # Corte: hoje depois do fim => 100% previsto. Aterro: hoje antes do inicio => 0% previsto.
    # (100*60 + 0*40) / 100 = 60.00
    previsto = calcular_avanco_previsto_disciplina(disciplina, hoje=datetime.date(2026, 6, 1))

    assert previsto == Decimal("60.00")


def test_status_eap_concluido_quando_real_maior_ou_igual_ao_limiar():
    assert classificar_status_eap(Decimal("99.95"), Decimal("10.00")) == StatusEapChoices.CONCLUIDO
    assert classificar_status_eap(Decimal("100.00"), None) == StatusEapChoices.CONCLUIDO


def test_status_eap_sem_previsto_retorna_planejado():
    assert classificar_status_eap(Decimal("40.00"), None) == StatusEapChoices.PLANEJADO


def test_status_eap_nao_iniciado_quando_real_e_previsto_proximos_de_zero():
    assert classificar_status_eap(Decimal("0.00"), Decimal("0.01")) == StatusEapChoices.NAO_INICIADO
    assert classificar_status_eap(Decimal("0.01"), Decimal("0.00")) == StatusEapChoices.NAO_INICIADO


def test_status_eap_critico_no_limiar_exato_de_desvio():
    # desvio = 10 - 18 = -8.00 (limiar exato, inclusivo)
    assert classificar_status_eap(Decimal("10.00"), Decimal("18.00")) == StatusEapChoices.CRITICO


def test_status_eap_atencao_entre_os_dois_limiares():
    # desvio = 10 - 17.99 = -7.99 (nao chega no critico)
    assert classificar_status_eap(Decimal("10.00"), Decimal("17.99")) == StatusEapChoices.ATENCAO
    # desvio = 10 - 13 = -3.00 (limiar exato do atencao, inclusivo)
    assert classificar_status_eap(Decimal("10.00"), Decimal("13.00")) == StatusEapChoices.ATENCAO


def test_status_eap_no_prazo_quando_desvio_acima_do_limiar_de_atencao():
    # desvio = 10 - 12.99 = -2.99 (nao chega no atencao)
    assert classificar_status_eap(Decimal("10.00"), Decimal("12.99")) == StatusEapChoices.NO_PRAZO
    # real acima do previsto tambem e No prazo
    assert classificar_status_eap(Decimal("50.00"), Decimal("40.00")) == StatusEapChoices.NO_PRAZO


def test_status_eap_sem_avanco_real_retorna_none():
    assert classificar_status_eap(None, Decimal("50.00")) is None
