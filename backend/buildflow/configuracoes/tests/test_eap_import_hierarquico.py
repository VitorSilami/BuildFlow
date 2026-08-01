import io
from datetime import date
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook

from buildflow.configuracoes.eap_import import _ler_planilhas_brutas
from buildflow.configuracoes.eap_import_hierarquico import importar
from buildflow.configuracoes.eap_import_hierarquico import localizar_cabecalho
from buildflow.configuracoes.eap_import_shared import LinhasInvalidas
from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory

pytestmark = pytest.mark.django_db

CABECALHO_PRINCIPAL = [
    "CÓDIGO", "Task Name", "Peso Percentual", "Outline Level",
    "data inicio prevista", "data fim prevista", "unidade", "quantidade",
]


def _workbook_upload(nome: str, abas: dict[str, list[list]]) -> SimpleUploadedFile:
    workbook = Workbook()
    workbook.remove(workbook.active)
    for titulo, linhas in abas.items():
        sheet = workbook.create_sheet(titulo)
        for linha in linhas:
            sheet.append(linha)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile(
        nome,
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def _importar(projeto, arquivo):
    planilhas = _ler_planilhas_brutas(arquivo)
    resultado_localizacao = localizar_cabecalho(planilhas)
    assert resultado_localizacao is not None
    _nome_aba, linhas, indice_cabecalho, colunas = resultado_localizacao
    return importar(projeto, planilhas, linhas, indice_cabecalho, colunas)


def test_arvore_2_e_3_niveis_com_peso_datas_e_valor_e_criada_corretamente():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 40, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "2026-09-01", "2026-09-10", "vb", 1],
        ["002", "Terraplenagem", 60, 1, "", "", "", ""],
        ["002.001", "Escavações", 55, 2, "", "", "", ""],
        ["002.001.001", "Escavação 1ª Categoria", 97, 3, "2026-09-15", "2026-10-01", "m³", 500],
        ["002.001.002", "Escavação 2ª Categoria", 3, 3, "", "", "m³", 20],
        ["002.002", "Aterros", 45, 2, "2026-10-05", "2026-10-20", "m³", 300],
    ]
    resumo_valores = [
        ["CÓDIGO", "DISCIPLINA", "VALOR BASE (R$)"],
        ["001", "Mobilização", 500000],
        ["002", "Terraplenagem", 2000000],
    ]
    custos_sicro = [
        ["CÓDIGO", "DISCIPLINA", "SERVIÇO", "UNIDADE", "PREÇO UNITÁRIO BASE (R$)"],
        ["001.001", "Mobilização", "Canteiro", "vb", 100000],
        ["002.001.001", "Terraplenagem", "Escavação 1ª Categoria", "m³", 18.5],
    ]
    arquivo = _workbook_upload(
        "import.xlsx",
        {
            "EXPORT_PROJECT": principal,
            "RESUMO_VALORES": resumo_valores,
            "BASE_CUSTOS_SICRO": custos_sicro,
        },
    )

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 3
    assert resultado.servicos_criados == 4

    mobilizacao = Disciplina.objects.get(projeto=projeto, nome="Mobilização")
    assert mobilizacao.pai is None
    assert mobilizacao.peso_percentual == Decimal("40.00")
    assert mobilizacao.valor_base == Decimal("500000.00")

    canteiro = CatalogoServico.objects.get(nome="Canteiro")
    assert canteiro.disciplina_id == mobilizacao.id
    assert canteiro.peso_percentual == Decimal("100.00")
    assert canteiro.data_inicio_prevista == date(2026, 9, 1)
    assert canteiro.data_fim_prevista == date(2026, 9, 10)
    assert canteiro.unidade.sigla == "vb"
    assert canteiro.quantidade_planejada == Decimal("1")
    assert canteiro.preco_unitario == Decimal("100000.00")

    terraplenagem = Disciplina.objects.get(projeto=projeto, nome="Terraplenagem")
    assert terraplenagem.pai is None
    assert terraplenagem.valor_base == Decimal("2000000.00")

    escavacoes = Disciplina.objects.get(projeto=projeto, nome="Escavações")
    assert escavacoes.pai_id == terraplenagem.id
    assert escavacoes.valor_base is None

    escavacao_1a = CatalogoServico.objects.get(nome="Escavação 1ª Categoria")
    assert escavacao_1a.disciplina_id == escavacoes.id
    assert escavacao_1a.preco_unitario == Decimal("18.50")

    escavacao_2a = CatalogoServico.objects.get(nome="Escavação 2ª Categoria")
    assert escavacao_2a.disciplina_id == escavacoes.id
    assert escavacao_2a.preco_unitario is None
    assert escavacao_2a.data_inicio_prevista is None

    aterros = CatalogoServico.objects.get(nome="Aterros")
    assert aterros.disciplina_id == terraplenagem.id
    assert aterros.preco_unitario is None
    assert aterros.quantidade_planejada == Decimal("300")


def test_codigo_orfao_e_rejeitado():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["003.001", "Escavações", 100, 2, "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == [
        "Linha 2: código 003.001 não tem uma linha pai 003 no arquivo.",
    ]


def test_codigo_duplicado_e_rejeitado():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001", "Mobilização duplicada", 100, 1, "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == ["Linha 3: código 001 duplicado."]


def test_unidade_em_branco_na_folha_gera_erro_mas_na_intermediaria_nao():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "", "", "", 1],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == ["Linha 3: UNIDADE em branco."]


def test_peso_invalido_gera_erro():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", "abc", 1, "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == ["Linha 2: PESO PERCENTUAL inválido."]


def test_data_fim_antes_do_inicio_gera_erro():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "2026-09-10", "2026-09-01", "vb", 1],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == [
        "Linha 3: data fim prevista anterior à data início prevista.",
    ]


def test_colunas_opcionais_ausentes_do_cabecalho_nao_geram_erro():
    projeto = ProjetoParaRdoFactory()
    principal = [
        ["CÓDIGO", "Task Name", "unidade", "quantidade"],
        ["001", "Mobilização", "", ""],
        ["001.001", "Canteiro", "vb", 1],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 1
    canteiro = CatalogoServico.objects.get(nome="Canteiro")
    assert canteiro.peso_percentual is None
    assert canteiro.data_inicio_prevista is None
    assert canteiro.data_fim_prevista is None


def test_abas_de_referencia_ausentes_deixam_preco_e_valor_nulos():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "", "", "vb", 1],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    mobilizacao = Disciplina.objects.get(projeto=projeto, nome="Mobilização")
    assert mobilizacao.valor_base is None
    canteiro = CatalogoServico.objects.get(nome="Canteiro")
    assert canteiro.preco_unitario is None


def test_codigo_raiz_sem_filhos_vira_disciplina_vazia_nao_servico():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 0
    mobilizacao = Disciplina.objects.get(projeto=projeto, nome="Mobilização")
    assert mobilizacao.servicos.count() == 0


def test_linha_totalmente_em_branco_e_ignorada():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "", "", "vb", 1],
        ["", "", "", "", "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 1


def test_nome_de_disciplina_duplicado_entre_ramos_diferentes_e_rejeitado():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Terraplenagem", 50, 1, "", "", "", ""],
        ["001.001", "Escavações", 100, 2, "", "", "", ""],
        ["001.001.001", "Escavação manual", 100, 3, "", "", "m³", 100],
        ["002", "Drenagem", 50, 1, "", "", "", ""],
        ["002.001", "Escavações", 100, 2, "", "", "", ""],
        ["002.001.001", "Escavação manual", 100, 3, "", "", "m³", 200],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == [
        'Linha 6: nome de disciplina "Escavações" duplicado (já usado no código 001.001).',
    ]


def test_erros_de_folha_saem_em_ordem_de_linha_do_arquivo():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001.001", "Canteiro A", 50, 2, "", "", "", 1],
        ["001.002", "Canteiro B", 50, 2, "", "", "", 1],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == [
        "Linha 3: UNIDADE em branco.",
        "Linha 4: UNIDADE em branco.",
    ]
