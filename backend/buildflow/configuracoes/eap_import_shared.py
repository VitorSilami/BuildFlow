from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from decimal import InvalidOperation

from .models import Unidade

LINHAS_MAX_BUSCA_CABECALHO = 20
NOME_MAX_LENGTH = 255
UNIDADE_MAX_LENGTH = 16
QUANTIDADE_MAXIMA = Decimal("999999999.999")


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


def _obter_ou_criar_unidade(sigla: str) -> Unidade:
    unidade = Unidade.objects.filter(sigla__iexact=sigla).first()
    if unidade is not None:
        return unidade
    return Unidade.objects.create(sigla=sigla)
