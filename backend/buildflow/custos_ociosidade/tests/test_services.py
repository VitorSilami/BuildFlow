from decimal import Decimal

import pytest

from buildflow.configuracoes.models import Maquina
from buildflow.configuracoes.models import MotivoParada
from buildflow.configuracoes.models import Pessoa
from buildflow.configuracoes.models import ValorCusto
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.custos_ociosidade.services import calcular_custos_ociosidade
from buildflow.registros_diarios.models import ApontamentoMaquina
from buildflow.registros_diarios.models import Presenca
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.registros_diarios.tests.factories import EquipeFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory

pytestmark = pytest.mark.django_db

ANO = 2026
MES = 7


def _criar_rdo(projeto, equipe, autor, dia):
    return RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=f"{ANO}-{MES:02d}-{dia:02d}",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=autor,
        autor=autor,
    )


def test_custo_e_deficit_de_mao_de_obra_com_valor_cadastrado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    ValorCusto.objects.create(
        projeto=projeto,
        tipo="mao_de_obra",
        descricao="Ajudante",
        funcao="Ajudante",
        valor=Decimal("250.00"),
    )

    rdo1 = _criar_rdo(projeto, equipe, usuario, dia=1)
    Presenca.objects.create(
        registro_diario=rdo1,
        nome_avulso="Trabalhador 1",
        funcao="Ajudante",
        status="presente",
        origem="avulso",
    )
    rdo2 = _criar_rdo(projeto, equipe, usuario, dia=2)
    Presenca.objects.create(
        registro_diario=rdo2,
        nome_avulso="Trabalhador 1",
        funcao="Ajudante",
        status="falta",
        origem="avulso",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert resultado["custo_mao_de_obra"] == "250.00"
    assert resultado["deficit_mao_de_obra"] == "250.00"
    funcao = resultado["mao_de_obra_por_funcao"][0]
    assert funcao["funcao"] == "Ajudante"
    assert funcao["dias_trabalhados"] == 1
    assert funcao["faltas"] == 1
    assert funcao["tem_valor_cadastrado"] is True


def test_atestado_nao_gera_deficit():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    ValorCusto.objects.create(
        projeto=projeto,
        tipo="mao_de_obra",
        descricao="Ajudante",
        funcao="Ajudante",
        valor=Decimal("250.00"),
    )
    rdo = _criar_rdo(projeto, equipe, usuario, dia=1)
    Presenca.objects.create(
        registro_diario=rdo,
        nome_avulso="Trabalhador 1",
        funcao="Ajudante",
        status="atestado",
        origem="avulso",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert resultado["deficit_mao_de_obra"] == "0.00"
    funcao = resultado["mao_de_obra_por_funcao"][0]
    assert funcao["atestados"] == 1
    assert funcao["faltas"] == 0


def test_funcao_sem_valor_cadastrado_entra_na_contagem_mas_custo_zero():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    rdo = _criar_rdo(projeto, equipe, usuario, dia=1)
    Presenca.objects.create(
        registro_diario=rdo,
        nome_avulso="Trabalhador 1",
        funcao="Motorista",
        status="presente",
        origem="avulso",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    funcao = resultado["mao_de_obra_por_funcao"][0]
    assert funcao["tem_valor_cadastrado"] is False
    assert funcao["custo"] == "0"


def test_custo_e_ocioso_de_maquina_com_valor_cadastrado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    maquina = Maquina.objects.create(equipe=equipe, codigo="ESC-01", nome="Escavadeira")
    ValorCusto.objects.create(
        projeto=projeto,
        tipo="equipamento",
        descricao="Escavadeira",
        maquina=maquina,
        valor=Decimal("100.00"),
    )
    motivo = MotivoParada.objects.create(descricao="Chuva")
    rdo = _criar_rdo(projeto, equipe, usuario, dia=1)
    ApontamentoMaquina.objects.create(
        registro_diario=rdo,
        maquina=maquina,
        horas_produtivas="6.00",
        horas_paradas="2.00",
        motivo_parada=motivo,
        origem="composicao",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert resultado["custo_produtivo_maquinas"] == "600.00"
    assert resultado["custo_ocioso_maquinas"] == "200.00"
    assert resultado["horas_ociosas_total"] == "2.00"
    item = resultado["maquinas_por_equipamento"][0]
    assert item["eficiencia_percentual"] == 75  # noqa: PLR2004
    assert resultado["horas_ociosas_por_causa"] == [
        {"motivo": "Chuva", "horas": "2.00"},
    ]


def test_eficiencia_gerencial_e_none_sem_nenhuma_hora_registrada():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert resultado["eficiencia_gerencial_percentual"] is None
    assert resultado["mao_de_obra_por_funcao"] == []
    assert resultado["maquinas_por_equipamento"] == []


def test_reincidencia_de_faltas_por_pessoa():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    pessoa = Pessoa.objects.create(equipe=equipe, nome="João", funcao="Ajudante")
    for dia in (1, 2, 3):
        rdo = _criar_rdo(projeto, equipe, usuario, dia=dia)
        Presenca.objects.create(
            registro_diario=rdo,
            pessoa=pessoa,
            funcao="Ajudante",
            status="falta",
            origem="composicao",
        )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    falta = resultado["faltas_por_pessoa"][0]
    assert falta["faltas"] == 3  # noqa: PLR2004
    assert falta["reincidente"] is True


def test_pessoa_avulsa_com_falta_aparece_em_faltas_por_pessoa():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    rdo = _criar_rdo(projeto, equipe, usuario, dia=1)
    Presenca.objects.create(
        registro_diario=rdo,
        nome_avulso="Trabalhador Avulso",
        funcao="Ajudante",
        status="falta",
        origem="avulso",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    falta = resultado["faltas_por_pessoa"][0]
    assert falta["pessoa_id"] is None
    assert falta["nome"] == "Trabalhador Avulso"
    assert falta["faltas"] == 1


def test_pessoas_avulsas_com_mesmo_nome_em_dias_diferentes_agrupam_faltas():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    for dia in (1, 2, 3):
        rdo = _criar_rdo(projeto, equipe, usuario, dia=dia)
        Presenca.objects.create(
            registro_diario=rdo,
            nome_avulso="Trabalhador Avulso",
            funcao="Ajudante",
            status="falta",
            origem="avulso",
        )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert len(resultado["faltas_por_pessoa"]) == 1
    falta = resultado["faltas_por_pessoa"][0]
    assert falta["faltas"] == 3  # noqa: PLR2004
    assert falta["reincidente"] is True
