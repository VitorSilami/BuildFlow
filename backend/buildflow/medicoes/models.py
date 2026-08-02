from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from buildflow.configuracoes.models import CatalogoServico
from buildflow.core.querysets import TenantScopedManager
from buildflow.projetos.models import Projeto


class StatusMedicaoChoices(models.TextChoices):
    AGUARDANDO_APROVACAO = "aguardando_aprovacao", _("Aguardando Aprovação")
    APROVADO = "aprovado", _("Aprovado")
    REJEITADO = "rejeitado", _("Rejeitado")


class Medicao(models.Model):
    """Boletim de medição acumulada de um projeto.

    Congela a quantidade executada de cada serviço até uma data de corte; o
    valor faturável de cada item é o delta em relação à última medição
    aprovada (nunca período fechado por datas) — ver services.criar_medicao.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        verbose_name=_("projeto"),
        on_delete=models.CASCADE,
        related_name="medicoes",
    )
    data_corte = models.DateField(_("data de corte"))
    fiscal = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("fiscal"),
        on_delete=models.PROTECT,
        related_name="medicoes_como_fiscal",
    )
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("criado por"),
        on_delete=models.PROTECT,
        related_name="medicoes_criadas",
    )
    status = models.CharField(
        _("status"),
        max_length=24,
        choices=StatusMedicaoChoices.choices,
        default=StatusMedicaoChoices.AGUARDANDO_APROVACAO,
    )
    motivo_rejeicao = models.TextField(_("motivo da rejeição"), blank=True)
    aprovado_em = models.DateTimeField(_("aprovado em"), null=True, blank=True)
    created_at = models.DateTimeField(_("criado em"), auto_now_add=True)

    tenant_path = "projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("medição")
        verbose_name_plural = _("medições")
        ordering = ["-data_corte"]
        constraints = [
            models.UniqueConstraint(
                fields=["projeto"],
                condition=Q(status=StatusMedicaoChoices.AGUARDANDO_APROVACAO),
                name="medicao_pendente_unica_por_projeto",
            ),
        ]

    def __str__(self) -> str:
        return f"Medição {self.projeto.nome} — {self.data_corte}"


class ItemMedicao(models.Model):
    """Linha de um serviço dentro de uma Medicao.

    Todos os campos numéricos são snapshots imutáveis tirados no momento da
    criação da Medicao — nunca recalculados depois, mesmo que RDOs sejam
    re-aprovados ou o preço do serviço mude posteriormente. Isso torna a
    medição um registro financeiro auditável, não uma view derivada.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medicao = models.ForeignKey(
        Medicao,
        verbose_name=_("medição"),
        on_delete=models.CASCADE,
        related_name="itens",
    )
    servico = models.ForeignKey(
        CatalogoServico,
        verbose_name=_("serviço"),
        on_delete=models.PROTECT,
        related_name="itens_medicao",
    )
    quantidade_anterior = models.DecimalField(
        _("quantidade anterior"),
        max_digits=12,
        decimal_places=3,
    )
    quantidade_acumulada = models.DecimalField(
        _("quantidade acumulada"),
        max_digits=12,
        decimal_places=3,
    )
    quantidade_periodo = models.DecimalField(
        _("quantidade do período"),
        max_digits=12,
        decimal_places=3,
    )
    preco_unitario_snapshot = models.DecimalField(
        _("preço unitário (snapshot)"),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    valor_periodo = models.DecimalField(
        _("valor do período"),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    tenant_path = "medicao__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("item de medição")
        verbose_name_plural = _("itens de medição")

    def __str__(self) -> str:
        return f"{self.servico.nome} — {self.quantidade_periodo}"
