from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import Sum

from buildflow.configuracoes.models import MetaMensal
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario

if TYPE_CHECKING:
    import datetime

    from .models import Projeto


def calcular_execucao_percentual(projeto: Projeto) -> Decimal | None:
    """Media ponderada (por MetaMensal.peso_percentual) do avanco de cada
    disciplina do projeto: soma(ProducaoDiaria.quantidade) na mesma unidade
    da meta, dividido pelo valor_alvo. Retorna None quando nao ha base real
    para calcular (sem metas, ou nenhuma meta com peso definido) — nunca
    inventa um numero.
    """
    metas = MetaMensal.objects.filter(
        projeto=projeto,
        peso_percentual__isnull=False,
    ).select_related("disciplina", "unidade")

    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")

    for meta in metas:
        peso = meta.peso_percentual
        producao_total = ProducaoDiaria.objects.filter(
            registro_diario__projeto=projeto,
            disciplina=meta.disciplina,
            unidade=meta.unidade,
        ).aggregate(total=Sum("quantidade"))["total"] or Decimal("0")

        avanco_disciplina = (
            (producao_total / meta.valor_alvo * Decimal("100"))
            if meta.valor_alvo
            else Decimal("0")
        )

        soma_ponderada += avanco_disciplina * peso
        soma_pesos += peso

    if soma_pesos == 0:
        return None

    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))


def decimal_para_str_ou_none(valor: Decimal | None) -> str | None:
    return str(valor) if valor is not None else None


def obter_ultima_data_rdo(projeto: Projeto) -> datetime.date | None:
    """Data do RegistroDiario mais recente do projeto, ou None se nunca houve
    nenhum — mesma regra de nunca inventar dado: ausencia de RDO e ausencia
    de valor, nao uma data arbitraria.
    """
    ultimo = (
        RegistroDiario.objects.filter(projeto=projeto)
        .order_by("-data_referencia")
        .first()
    )
    return ultimo.data_referencia if ultimo is not None else None
