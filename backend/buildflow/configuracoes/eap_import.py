from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from decimal import Decimal
from decimal import InvalidOperation
from zipfile import BadZipFile

import openpyxl
from django.db import transaction
from django.utils.translation import gettext_lazy as _
from openpyxl.utils.exceptions import InvalidFileException

from .models import CatalogoServico
from .models import Disciplina
from .models import Unidade

LINHAS_MAX_BUSCA_CABECALHO = 20
MAX_EAP_IMPORT_BYTES = 5 * 1024 * 1024
NOME_MAX_LENGTH = 255
UNIDADE_MAX_LENGTH = 16
QUANTIDADE_MAXIMA = Decimal("999999999.999")
COLUNAS_OBRIGATORIAS = {
    "disciplina": {"DISCIPLINA"},
    "atividade": {"ATIVIDADE"},
    "unidade": {"UN", "UNIDADE"},
    "quantidade": {"TOTAL", "QUANTIDADE"},
}


class ArquivoInvalido(Exception):
    """Erro de pré-condição, formato ou cabeçalho — mensagem única."""

    def __init__(self, mensagem: str) -> None:
        self.mensagem = mensagem
        super().__init__(mensagem)


class LinhasInvalidas(Exception):
    """Erros de validação linha a linha — uma mensagem por linha."""

    def __init__(self, erros: list[str]) -> None:
        self.erros = erros
        super().__init__("; ".join(erros))


@dataclass
class ResultadoImportacaoEap:
    disciplinas_criadas: int
    servicos_criados: int


def importar_eap_de_arquivo(projeto, arquivo) -> ResultadoImportacaoEap:
    if arquivo.size > MAX_EAP_IMPORT_BYTES:
        msg = str(_("Arquivo excede o tamanho máximo permitido (5 MB)."))
        raise ArquivoInvalido(msg)

    if projeto.disciplinas.filter(pai__isnull=True).exists():
        msg = str(
            _(
                "Este projeto já possui uma EAP. Import só é permitido em "
                "projetos sem disciplinas cadastradas.",
            ),
        )
        raise ArquivoInvalido(msg)

    planilhas = _ler_planilhas_brutas(arquivo)
    linhas, indice_cabecalho, colunas = _localizar_cabecalho_em_planilhas(planilhas)
    linhas_validas, erros = _validar_linhas(linhas, indice_cabecalho, colunas)
    if erros:
        raise LinhasInvalidas(erros)

    return _criar_disciplinas_e_servicos(projeto, linhas_validas)


def _ler_planilhas_brutas(arquivo) -> list[list[list[str]]]:
    nome = (arquivo.name or "").lower()
    if nome.endswith(".xlsx"):
        return _ler_planilhas_xlsx(arquivo)
    if nome.endswith(".csv"):
        return [_ler_linhas_csv(arquivo)]
    msg = str(_("Formato não suportado. Envie um arquivo .csv ou .xlsx."))
    raise ArquivoInvalido(msg)


def _ler_planilhas_xlsx(arquivo) -> list[list[list[str]]]:
    try:
        workbook = openpyxl.load_workbook(
            io.BytesIO(arquivo.read()),
            data_only=True,
            read_only=True,
        )
    except (BadZipFile, InvalidFileException) as exc:
        msg = str(_("Não foi possível ler o arquivo .xlsx."))
        raise ArquivoInvalido(msg) from exc

    return [
        [
            ["" if valor is None else str(valor).strip() for valor in row]
            for row in planilha.iter_rows(values_only=True)
        ]
        for planilha in workbook.worksheets
    ]


def _ler_linhas_csv(arquivo) -> list[list[str]]:
    dados = arquivo.read()
    try:
        texto = dados.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = dados.decode("cp1252")

    leitor = csv.reader(io.StringIO(texto))
    return [[celula.strip() for celula in linha] for linha in leitor]


def _localizar_cabecalho_em_planilhas(
    planilhas: list[list[list[str]]],
) -> tuple[list[list[str]], int, dict[str, int]]:
    for linhas in planilhas:
        resultado = _tentar_localizar_cabecalho(linhas)
        if resultado is not None:
            indice, colunas = resultado
            return linhas, indice, colunas

    msg = str(
        _(
            "Cabeçalho não encontrado ou incompleto. Colunas obrigatórias: "
            "DISCIPLINA, ATIVIDADE, UN/UNIDADE, TOTAL/QUANTIDADE.",
        ),
    )
    raise ArquivoInvalido(msg)


def _tentar_localizar_cabecalho(linhas: list[list[str]]) -> tuple[int, dict[str, int]] | None:
    limite = min(len(linhas), LINHAS_MAX_BUSCA_CABECALHO)
    for indice in range(limite):
        celulas_normalizadas = [celula.strip().upper() for celula in linhas[indice]]
        if "DISCIPLINA" in celulas_normalizadas and "ATIVIDADE" in celulas_normalizadas:
            colunas = _resolver_colunas(celulas_normalizadas)
            if colunas is not None:
                return indice, colunas
            return None
    return None


def _resolver_colunas(celulas_normalizadas: list[str]) -> dict[str, int] | None:
    colunas: dict[str, int] = {}
    for campo, nomes_aceitos in COLUNAS_OBRIGATORIAS.items():
        indice = next(
            (i for i, celula in enumerate(celulas_normalizadas) if celula in nomes_aceitos),
            None,
        )
        if indice is None:
            return None
        colunas[campo] = indice
    return colunas


def _celula(linha: list[str], indice: int) -> str:
    return linha[indice].strip() if indice < len(linha) else ""


def _parse_quantidade(valor: str) -> Decimal | None:
    if not valor:
        return None
    try:
        quantidade = Decimal(valor.replace(",", "."))
    except InvalidOperation:
        return None
    if not quantidade.is_finite() or quantidade < 0 or quantidade > QUANTIDADE_MAXIMA:
        return None
    return quantidade


def _validar_linhas(
    linhas: list[list[str]],
    indice_cabecalho: int,
    colunas: dict[str, int],
) -> tuple[list[dict], list[str]]:
    linhas_validas: list[dict] = []
    erros: list[str] = []
    combinacoes_vistas: set[tuple[str, str]] = set()

    for offset, linha in enumerate(linhas[indice_cabecalho + 1 :], start=1):
        numero_linha = indice_cabecalho + offset + 1
        # So considera as colunas obrigatorias pra decidir se a linha esta em
        # branco — planilhas reais tem linhas de nota/rodape com texto solto
        # numa coluna ignorada (ex.: CHAVE) e nada nas colunas que importam,
        # o que nao deveria contar como uma linha de dados malformada.
        if not any(_celula(linha, indice) for indice in colunas.values()):
            continue

        disciplina = _celula(linha, colunas["disciplina"])
        atividade = _celula(linha, colunas["atividade"])
        unidade = _celula(linha, colunas["unidade"])
        quantidade_bruta = _celula(linha, colunas["quantidade"])

        if not disciplina:
            erros.append(f"Linha {numero_linha}: DISCIPLINA em branco.")
            continue
        if len(disciplina) > NOME_MAX_LENGTH:
            erros.append(
                f"Linha {numero_linha}: DISCIPLINA excede o tamanho máximo "
                f"({NOME_MAX_LENGTH} caracteres).",
            )
            continue
        if not atividade:
            erros.append(f"Linha {numero_linha}: ATIVIDADE em branco.")
            continue
        if len(atividade) > NOME_MAX_LENGTH:
            erros.append(
                f"Linha {numero_linha}: ATIVIDADE excede o tamanho máximo "
                f"({NOME_MAX_LENGTH} caracteres).",
            )
            continue
        if not unidade:
            erros.append(f"Linha {numero_linha}: UNIDADE em branco.")
            continue
        if len(unidade) > UNIDADE_MAX_LENGTH:
            erros.append(
                f"Linha {numero_linha}: UNIDADE excede o tamanho máximo "
                f"({UNIDADE_MAX_LENGTH} caracteres).",
            )
            continue

        quantidade = _parse_quantidade(quantidade_bruta)
        if quantidade is None:
            erros.append(f"Linha {numero_linha}: TOTAL/QUANTIDADE inválido.")
            continue

        chave = (disciplina.upper(), atividade.upper())
        if chave in combinacoes_vistas:
            erros.append(f"Linha {numero_linha}: ATIVIDADE duplicada para esta DISCIPLINA.")
            continue
        combinacoes_vistas.add(chave)

        linhas_validas.append(
            {
                "disciplina": disciplina,
                "atividade": atividade,
                "unidade": unidade,
                "quantidade": quantidade,
            },
        )

    return linhas_validas, erros


def _obter_ou_criar_unidade(sigla: str) -> Unidade:
    unidade = Unidade.objects.filter(sigla__iexact=sigla).first()
    if unidade is not None:
        return unidade
    return Unidade.objects.create(sigla=sigla)


def _criar_disciplinas_e_servicos(projeto, linhas_validas: list[dict]) -> ResultadoImportacaoEap:
    grupos: dict[str, list[dict]] = {}
    nomes_disciplina: dict[str, str] = {}
    for linha in linhas_validas:
        chave = linha["disciplina"].upper()
        grupos.setdefault(chave, []).append(linha)
        nomes_disciplina.setdefault(chave, linha["disciplina"])

    servicos_criados = 0
    with transaction.atomic():
        for chave, linhas_do_grupo in grupos.items():
            disciplina = Disciplina.objects.create(
                projeto=projeto,
                nome=nomes_disciplina[chave],
                pai=None,
            )
            for linha in linhas_do_grupo:
                unidade = _obter_ou_criar_unidade(linha["unidade"])
                CatalogoServico.objects.create(
                    disciplina=disciplina,
                    nome=linha["atividade"],
                    unidade=unidade,
                    quantidade_planejada=linha["quantidade"],
                )
                servicos_criados += 1

    return ResultadoImportacaoEap(
        disciplinas_criadas=len(grupos),
        servicos_criados=servicos_criados,
    )
