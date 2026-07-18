import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from buildflow.core.querysets import TenantScopedManager
from buildflow.empresas.models import Empresa


class Projeto(models.Model):
    """Obra gerenciada por uma empresa (FR-014 a FR-018).

    Pulled para a fase Foundational (em vez de US3) porque Disciplina,
    Unidade e demais cadastros compartilhados dependem de Projeto — ver nota
    de correcao em tasks.md.
    """

    tenant_path = "empresa"

    class StatusChoices(models.TextChoices):
        ATIVO = "ativo", _("Ativo")
        PAUSADO = "pausado", _("Pausado")
        CONCLUIDO = "concluido", _("Concluído")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        Empresa,
        verbose_name=_("empresa"),
        on_delete=models.CASCADE,
        related_name="projetos",
    )
    nome = models.CharField(_("nome"), max_length=255)
    descricao = models.TextField(_("breve descricao"), blank=True)
    numero_contrato = models.CharField(
        _("número do contrato"),
        max_length=100,
        blank=True,
    )
    trecho = models.CharField(_("trecho"), max_length=255, blank=True)
    engenheiro_responsavel = models.CharField(
        _("engenheiro responsável"),
        max_length=255,
        blank=True,
    )
    status = models.CharField(
        _("status"),
        max_length=16,
        choices=StatusChoices.choices,
        default=StatusChoices.ATIVO,
    )
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("criado por"),
        on_delete=models.PROTECT,
        related_name="projetos_criados",
    )
    created_at = models.DateTimeField(_("criado em"), auto_now_add=True)
    updated_at = models.DateTimeField(_("atualizado em"), auto_now=True)

    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("projeto")
        verbose_name_plural = _("projetos")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.nome
