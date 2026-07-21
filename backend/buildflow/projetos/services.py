from __future__ import annotations

import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import Count
from django.db.models import Sum
from django.utils import timezone

from buildflow.configuracoes.models import MetaMensal
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario

from .models import Projeto

if TYPE_CHECKING:
    from buildflow.empresas.models import Empresa

DIAS_JANELA_ATIVIDADE = 7


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


def obter_atividade_rdo_semana(empresa: Empresa) -> list[dict[str, str | int]]:
    """Contagem de RegistroDiario por dia, ultimos 7 dias (hoje inclusive), dos
    projetos ativos da empresa. Dias sem nenhum RDO aparecem com quantidade 0
    explicito — o grafico de barras do frontend nao pode "pular" um dia sem
    dado, senao a leitura do eixo X fica errada.
    """
    hoje = timezone.now().date()
    inicio = hoje - datetime.timedelta(days=DIAS_JANELA_ATIVIDADE - 1)

    linhas = (
        RegistroDiario.objects.filter(
            projeto__empresa=empresa,
            projeto__status=Projeto.StatusChoices.ATIVO,
            data_referencia__gte=inicio,
            data_referencia__lte=hoje,
        )
        .values("data_referencia")
        .annotate(quantidade=Count("id"))
    )
    contagem_por_dia = {
        linha["data_referencia"]: linha["quantidade"] for linha in linhas
    }

    return [
        {
            "data": (inicio + datetime.timedelta(days=offset)).isoformat(),
            "quantidade": contagem_por_dia.get(
                inicio + datetime.timedelta(days=offset),
                0,
            ),
        }
        for offset in range(DIAS_JANELA_ATIVIDADE)
    ]
