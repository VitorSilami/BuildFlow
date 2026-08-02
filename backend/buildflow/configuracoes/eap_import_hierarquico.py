from __future__ import annotations

import datetime
from dataclasses import dataclass
from decimal import Decimal
from decimal import InvalidOperation

from django.db import transaction

from .eap_import_shared import LINHAS_MAX_BUSCA_CABECALHO
from .eap_import_shared import NOME_MAX_LENGTH
from .eap_import_shared import UNIDADE_MAX_LENGTH
from .eap_import_shared import LinhasInvalidas
from .eap_import_shared import ResultadoImportacaoEap
from .eap_import_shared import _celula
from .eap_import_shared import _obter_ou_criar_unidade
from .eap_import_shared import _parse_quantidade
from .models import CatalogoServico
from .models import Disciplina

COLUNAS_OBRIGATORIAS = {
    "codigo": "CÓDIGO",
    "nome": "TASK NAME",
    "unidade": "UNIDADE",
    "quantidade": "QUANTIDADE",
}
COLUNAS_OPCIONAIS = {
    "peso": "PESO PERCENTUAL",
    "data_inicio": "DATA INICIO PREVISTA",
    "data_fim": "DATA FIM PREVISTA",
}
PESO_MAXIMO = Decimal("999.99")
VALOR_MAXIMO = Decimal("9999999999.99")
ABA_CUSTOS_SICRO = "BASE_CUSTOS_SICRO"
COLUNA_CUSTOS_SICRO_VALOR = "PREÇO UNITÁRIO BASE (R$)"
ABA_RESUMO_VALORES = "RESUMO_VALORES"
COLUNA_RESUMO_VALORES_VALOR = "VALOR BASE (R$)"


@dataclass
class _NoHierarquico:
    codigo: str
    nome: str
    numero_linha: int
    peso: Decimal | None
    data_inicio: datetime.date | None
    data_fim: datetime.date | None
    unidade_bruta: str
    quantidade_bruta: str


def localizar_cabecalho(
    planilhas: list[tuple[str, list[list[str]]]],
) -> tuple[str, list[list[str]], int, dict[str, int]] | None:
    for nome_aba, linhas in planilhas:
        resultado = _tentar_localizar_cabecalho(linhas)
        if resultado is not None:
            indice, colunas = resultado
            return nome_aba, linhas, indice, colunas
    return None


def _tentar_localizar_cabecalho(linhas: list[list[str]]) -> tuple[int, dict[str, int]] | None:
    limite = min(len(linhas), LINHAS_MAX_BUSCA_CABECALHO)
    for indice in range(limite):
        celulas_normalizadas = [celula.strip().upper() for celula in linhas[indice]]
        if "CÓDIGO" in celulas_normalizadas and "TASK NAME" in celulas_normalizadas:
            colunas = _resolver_colunas(celulas_normalizadas)
            if colunas is not None:
                return indice, colunas
            return None
    return None


def _resolver_colunas(celulas_normalizadas: list[str]) -> dict[str, int] | None:
    colunas: dict[str, int] = {}
    for campo, nome_coluna in COLUNAS_OBRIGATORIAS.items():
        indice = _indice_coluna(celulas_normalizadas, nome_coluna)
        if indice is None:
            return None
        colunas[campo] = indice
    for campo, nome_coluna in COLUNAS_OPCIONAIS.items():
        indice = _indice_coluna(celulas_normalizadas, nome_coluna)
        if indice is not None:
            colunas[campo] = indice
    return colunas


def _indice_coluna(celulas_normalizadas: list[str], nome_coluna: str) -> int | None:
    return next(
        (i for i, celula in enumerate(celulas_normalizadas) if celula == nome_coluna),
        None,
    )


def _parse_peso(valor: str) -> Decimal | None:
    try:
        peso = Decimal(valor.replace(",", "."))
    except InvalidOperation:
        return None
    if not peso.is_finite() or peso < 0 or peso > PESO_MAXIMO:
        return None
    return peso


def _parse_data(valor: str) -> datetime.date | None:
    for formato in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(valor, formato).date()
        except ValueError:
            continue
    return None


def _parsear_linhas(
    linhas: list[list[str]],
    indice_cabecalho: int,
    colunas: dict[str, int],
) -> tuple[dict[str, _NoHierarquico], list[str]]:
    nos: dict[str, _NoHierarquico] = {}
    erros: list[str] = []

    for offset, linha in enumerate(linhas[indice_cabecalho + 1 :], start=1):
        numero_linha = indice_cabecalho + offset + 1
        # So considera CODIGO e TASK NAME pra decidir se a linha esta em
        # branco — planilhas reais tem linhas de nota/rodape com texto solto
        # numa coluna secundaria (ex.: PESO PERCENTUAL, uma data) e nada nas
        # duas colunas que identificam a linha, o que nao deveria contar
        # como uma linha de dados malformada.
        if not _celula(linha, colunas["codigo"]) and not _celula(linha, colunas["nome"]):
            continue

        codigo = _celula(linha, colunas["codigo"])
        nome = _celula(linha, colunas["nome"])

        if not codigo:
            erros.append(f"Linha {numero_linha}: CÓDIGO em branco.")
            continue
        if not nome:
            erros.append(f"Linha {numero_linha}: TASK NAME em branco.")
            continue
        if len(nome) > NOME_MAX_LENGTH:
            erros.append(
                f"Linha {numero_linha}: TASK NAME excede o tamanho máximo "
                f"({NOME_MAX_LENGTH} caracteres).",
            )
            continue
        if codigo in nos:
            erros.append(f"Linha {numero_linha}: código {codigo} duplicado.")
            continue

        peso = None
        if "peso" in colunas:
            peso_bruto = _celula(linha, colunas["peso"])
            if peso_bruto:
                peso = _parse_peso(peso_bruto)
                if peso is None:
                    erros.append(f"Linha {numero_linha}: PESO PERCENTUAL inválido.")
                    continue

        data_inicio = None
        if "data_inicio" in colunas:
            bruta = _celula(linha, colunas["data_inicio"])
            if bruta:
                data_inicio = _parse_data(bruta)
                if data_inicio is None:
                    erros.append(f"Linha {numero_linha}: DATA INICIO PREVISTA inválida.")
                    continue

        data_fim = None
        if "data_fim" in colunas:
            bruta = _celula(linha, colunas["data_fim"])
            if bruta:
                data_fim = _parse_data(bruta)
                if data_fim is None:
                    erros.append(f"Linha {numero_linha}: DATA FIM PREVISTA inválida.")
                    continue

        if data_inicio is not None and data_fim is not None and data_fim < data_inicio:
            erros.append(
                f"Linha {numero_linha}: data fim prevista anterior à data início prevista.",
            )
            continue

        nos[codigo] = _NoHierarquico(
            codigo=codigo,
            nome=nome,
            numero_linha=numero_linha,
            peso=peso,
            data_inicio=data_inicio,
            data_fim=data_fim,
            unidade_bruta=_celula(linha, colunas["unidade"]),
            quantidade_bruta=_celula(linha, colunas["quantidade"]),
        )

    return nos, erros


def _construir_arvore(
    nos: dict[str, _NoHierarquico],
) -> tuple[dict[str, str | None], set[str], list[str]]:
    erros: list[str] = []
    pais: dict[str, str | None] = {}

    for codigo in nos:
        if "." in codigo:
            codigo_pai = codigo.rsplit(".", 1)[0]
            if codigo_pai not in nos:
                erros.append(
                    f"Linha {nos[codigo].numero_linha}: código {codigo} não tem uma "
                    f"linha pai {codigo_pai} no arquivo.",
                )
                continue
            pais[codigo] = codigo_pai
        else:
            pais[codigo] = None

    codigos_com_filhos = {pai for pai in pais.values() if pai is not None}
    # Codigo de nivel raiz (sem ponto) sempre vira Disciplina, mesmo sem
    # filhos no arquivo — CatalogoServico exige uma disciplina-pai (FK
    # obrigatoria), entao uma folha de verdade so pode existir a partir do
    # nivel 2.
    folhas = {
        codigo for codigo in pais if codigo not in codigos_com_filhos and "." in codigo
    }

    return pais, folhas, erros


def _validar_folhas(
    nos: dict[str, _NoHierarquico],
    folhas: set[str],
) -> tuple[dict[str, Decimal], list[str]]:
    erros: list[str] = []
    quantidades: dict[str, Decimal] = {}

    for codigo in sorted(folhas, key=lambda c: nos[c].numero_linha):
        no = nos[codigo]
        if not no.unidade_bruta:
            erros.append(f"Linha {no.numero_linha}: UNIDADE em branco.")
            continue
        if len(no.unidade_bruta) > UNIDADE_MAX_LENGTH:
            erros.append(
                f"Linha {no.numero_linha}: UNIDADE excede o tamanho máximo "
                f"({UNIDADE_MAX_LENGTH} caracteres).",
            )
            continue
        quantidade = _parse_quantidade(no.quantidade_bruta)
        if quantidade is None:
            erros.append(f"Linha {no.numero_linha}: QUANTIDADE inválida.")
            continue
        quantidades[codigo] = quantidade

    return quantidades, erros


def _validar_nomes_disciplina_unicos(
    nos: dict[str, _NoHierarquico],
    folhas: set[str],
) -> list[str]:
    erros: list[str] = []
    nomes_vistos: dict[str, str] = {}
    for codigo, no in nos.items():
        if codigo in folhas:
            continue
        chave = no.nome.upper()
        if chave in nomes_vistos:
            erros.append(
                f"Linha {no.numero_linha}: nome de disciplina "
                f'"{no.nome}" duplicado (já usado no código {nomes_vistos[chave]}).',
            )
            continue
        nomes_vistos[chave] = codigo
    return erros


def _localizar_aba_por_nome(
    planilhas: list[tuple[str, list[list[str]]]],
    nome_aba: str,
) -> list[list[str]] | None:
    for nome, linhas in planilhas:
        if nome.strip().upper() == nome_aba.upper():
            return linhas
    return None


def _parse_valor(valor: str) -> Decimal | None:
    try:
        numero = Decimal(valor.replace(",", "."))
    except InvalidOperation:
        return None
    if not numero.is_finite() or numero < 0 or numero > VALOR_MAXIMO:
        return None
    return numero


def _tentar_localizar_cabecalho_lookup(
    linhas: list[list[str]],
    nome_coluna_valor: str,
) -> tuple[int, int, int] | None:
    limite = min(len(linhas), LINHAS_MAX_BUSCA_CABECALHO)
    for indice in range(limite):
        celulas_normalizadas = [celula.strip().upper() for celula in linhas[indice]]
        indice_codigo = _indice_coluna(celulas_normalizadas, "CÓDIGO")
        if indice_codigo is None:
            continue
        indice_valor = _indice_coluna(celulas_normalizadas, nome_coluna_valor)
        if indice_valor is None:
            continue
        return indice, indice_codigo, indice_valor
    return None


def _ler_lookup_por_codigo(
    linhas: list[list[str]],
    nome_coluna_valor: str,
) -> dict[str, Decimal]:
    resultado = _tentar_localizar_cabecalho_lookup(linhas, nome_coluna_valor)
    if resultado is None:
        return {}
    indice_cabecalho, indice_codigo, indice_valor = resultado

    lookup: dict[str, Decimal] = {}
    for linha in linhas[indice_cabecalho + 1 :]:
        codigo = _celula(linha, indice_codigo)
        valor_bruto = _celula(linha, indice_valor)
        if not codigo or not valor_bruto:
            continue
        valor = _parse_valor(valor_bruto)
        if valor is not None:
            lookup[codigo] = valor
    return lookup


def _ler_lookup_valor(
    planilhas: list[tuple[str, list[list[str]]]],
    nome_aba: str,
    nome_coluna_valor: str,
) -> dict[str, Decimal]:
    linhas = _localizar_aba_por_nome(planilhas, nome_aba)
    if linhas is None:
        return {}
    return _ler_lookup_por_codigo(linhas, nome_coluna_valor)


def importar(
    projeto,
    planilhas: list[tuple[str, list[list[str]]]],
    linhas: list[list[str]],
    indice_cabecalho: int,
    colunas: dict[str, int],
) -> ResultadoImportacaoEap:
    nos, erros_parse = _parsear_linhas(linhas, indice_cabecalho, colunas)
    pais, folhas, erros_arvore = _construir_arvore(nos)
    quantidades, erros_folhas = _validar_folhas(nos, folhas)
    erros_nomes = _validar_nomes_disciplina_unicos(nos, folhas)

    erros = erros_parse + erros_arvore + erros_folhas + erros_nomes
    if erros:
        raise LinhasInvalidas(erros)

    precos = _ler_lookup_valor(planilhas, ABA_CUSTOS_SICRO, COLUNA_CUSTOS_SICRO_VALOR)
    valores_base = _ler_lookup_valor(planilhas, ABA_RESUMO_VALORES, COLUNA_RESUMO_VALORES_VALOR)

    return _criar_arvore(projeto, nos, pais, folhas, quantidades, precos, valores_base)


def _criar_arvore(
    projeto,
    nos: dict[str, _NoHierarquico],
    pais: dict[str, str | None],
    folhas: set[str],
    quantidades: dict[str, Decimal],
    precos: dict[str, Decimal],
    valores_base: dict[str, Decimal],
) -> ResultadoImportacaoEap:
    objetos: dict[str, Disciplina] = {}
    disciplinas_criadas = 0
    servicos_criados = 0

    codigos_ordenados = sorted(nos, key=lambda codigo: codigo.count("."))

    with transaction.atomic():
        for codigo in codigos_ordenados:
            no = nos[codigo]
            codigo_pai = pais[codigo]
            disciplina_pai = objetos[codigo_pai] if codigo_pai is not None else None

            if codigo in folhas:
                unidade = _obter_ou_criar_unidade(no.unidade_bruta)
                CatalogoServico.objects.create(
                    disciplina=disciplina_pai,
                    nome=no.nome,
                    unidade=unidade,
                    quantidade_planejada=quantidades[codigo],
                    peso_percentual=no.peso,
                    data_inicio_prevista=no.data_inicio,
                    data_fim_prevista=no.data_fim,
                    preco_unitario=precos.get(codigo),
                )
                servicos_criados += 1
            else:
                disciplina = Disciplina.objects.create(
                    projeto=projeto,
                    nome=no.nome,
                    pai=disciplina_pai,
                    peso_percentual=no.peso,
                    valor_base=valores_base.get(codigo) if codigo_pai is None else None,
                )
                objetos[codigo] = disciplina
                disciplinas_criadas += 1

    return ResultadoImportacaoEap(
        disciplinas_criadas=disciplinas_criadas,
        servicos_criados=servicos_criados,
    )
