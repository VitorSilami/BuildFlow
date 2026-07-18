from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum

from buildflow.configuracoes.models import MetaMensal
from buildflow.registros_diarios.models import ProducaoDiaria

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
        se_peso = meta.peso_percentual
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

        soma_ponderada += avanco_disciplina * se_peso
        soma_pesos += se_peso

    if soma_pesos == 0:
        return None

    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))
