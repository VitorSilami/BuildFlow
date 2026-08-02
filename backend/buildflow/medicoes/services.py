from __future__ import annotations

import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from buildflow.configuracoes.models import CatalogoServico
from buildflow.projetos.services import calcular_quantidade_executada_total

from .models import ItemMedicao
from .models import Medicao
from .models import StatusMedicaoChoices


class MedicaoInvalida(Exception):
    """Erro de pre-condicao ao criar uma medicao (pendencia existente, data invalida)."""


def criar_medicao(
    *,
    projeto,
    data_corte: datetime.date,
    fiscal,
    criado_por,
) -> Medicao:
    if Medicao.objects.filter(
        projeto=projeto,
        status=StatusMedicaoChoices.AGUARDANDO_APROVACAO,
    ).exists():
        msg = str(
            _(
                "Este projeto já possui uma medição aguardando aprovação. "
                "Aprove ou rejeite antes de criar outra.",
            ),
        )
        raise MedicaoInvalida(msg)

    if data_corte > timezone.now().date():
        msg = str(_("A data de corte não pode ser no futuro."))
        raise MedicaoInvalida(msg)

    ultima_aprovada = (
        Medicao.objects.filter(projeto=projeto, status=StatusMedicaoChoices.APROVADO)
        .order_by("-data_corte")
        .first()
    )
    if ultima_aprovada is not None and data_corte <= ultima_aprovada.data_corte:
        msg = str(
            _("A data de corte deve ser posterior à da última medição aprovada (%(data)s).")
            % {"data": ultima_aprovada.data_corte.strftime("%d/%m/%Y")},
        )
        raise MedicaoInvalida(msg)

    quantidades_anteriores: dict = {}
    if ultima_aprovada is not None:
        quantidades_anteriores = {
            item.servico_id: item.quantidade_acumulada for item in ultima_aprovada.itens.all()
        }

    with transaction.atomic():
        medicao = Medicao.objects.create(
            projeto=projeto,
            data_corte=data_corte,
            fiscal=fiscal,
            criado_por=criado_por,
        )
        servicos = CatalogoServico.objects.filter(disciplina__projeto=projeto)
        for servico in servicos:
            quantidade_anterior = quantidades_anteriores.get(servico.id, Decimal("0"))
            quantidade_acumulada = calcular_quantidade_executada_total(servico, ate=data_corte)
            if quantidade_acumulada == 0 and quantidade_anterior == 0:
                continue

            quantidade_periodo = quantidade_acumulada - quantidade_anterior
            preco_unitario_snapshot = servico.preco_unitario
            valor_periodo = (
                quantidade_periodo * preco_unitario_snapshot
                if preco_unitario_snapshot is not None
                else None
            )
            ItemMedicao.objects.create(
                medicao=medicao,
                servico=servico,
                quantidade_anterior=quantidade_anterior,
                quantidade_acumulada=quantidade_acumulada,
                quantidade_periodo=quantidade_periodo,
                preco_unitario_snapshot=preco_unitario_snapshot,
                valor_periodo=valor_periodo,
            )

    return medicao
