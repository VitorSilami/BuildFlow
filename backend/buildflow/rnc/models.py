import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from buildflow.core.querysets import TenantScopedManager
from buildflow.projetos.models import Projeto


class CategoriaChoices(models.TextChoices):
    TERRAPLENAGEM = "terraplenagem", _("Terraplenagem")
    PAVIMENTACAO = "pavimentacao", _("Pavimentação")
    CONTENCOES = "contencoes", _("Contenções")
    OAES = "oaes", _("OAEs")
    OACS_E_DRENAGEM = "oacs_e_drenagem", _("OACs e Drenagem")
    SINALIZACAO_SEGURANCA = "sinalizacao_seguranca", _("Sinalização e Segurança")
    OUTROS = "outros", _("Outros")


class OrigemChoices(models.TextChoices):
    PRODUTO = "produto", _("Produto")
    SERVICO = "servico", _("Serviço")
    PESSOAL = "pessoal", _("Pessoal")
    SEGURANCA = "seguranca", _("Segurança")
    EQUIPAMENTO = "equipamento", _("Equipamento")
    PROJETO = "projeto", _("Projeto")


class GravidadeChoices(models.TextChoices):
    ALTA = "alta", _("Alta")
    MEDIA = "media", _("Média")
    BAIXA = "baixa", _("Baixa")


class TipoRncChoices(models.TextChoices):
    AC = "ac", _("Ação Corretiva")
    AP = "ap", _("Ação Preventiva")


class StatusRncChoices(models.TextChoices):
    PENDENTE = "pendente", _("Pendente")
    CONCLUIDA = "concluida", _("Concluída")


class EficaciaChoices(models.TextChoices):
    EFICAZ = "eficaz", _("Eficaz")
    INEFICAZ = "ineficaz", _("Ineficaz")


class RNC(models.Model):
    """Registro de Não Conformidade — documento formal de notificação à
    contratada, com causa raiz (6M) e ações corretivas.

    Editável (PATCH) enquanto status == pendente; sem reabertura após
    concluída (Clarification, spec 2026-07-22).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        verbose_name=_("projeto"),
        on_delete=models.CASCADE,
        related_name="rncs",
    )
    numero_sequencial = models.PositiveIntegerField(_("número sequencial"))
    data_emissao = models.DateField(_("data de emissão"))
    contratada = models.CharField(_("contratada"), max_length=255)
    categoria = models.CharField(
        _("categoria"),
        max_length=32,
        choices=CategoriaChoices.choices,
    )
    origem = models.CharField(_("origem"), max_length=16, choices=OrigemChoices.choices)
    gravidade = models.CharField(
        _("gravidade"),
        max_length=16,
        choices=GravidadeChoices.choices,
    )
    tipo = models.CharField(_("tipo"), max_length=4, choices=TipoRncChoices.choices)
    item = models.CharField(_("item"), max_length=255)
    subitem = models.CharField(_("subitem"), max_length=255, blank=True)
    norma = models.CharField(
        _("norma / requisito normativo"),
        max_length=255,
        blank=True,
    )
    requisito = models.CharField(_("requisito"), max_length=255, blank=True)
    abrangencia = models.CharField(_("abrangência"), max_length=255, blank=True)
    km = models.CharField(_("km"), max_length=32, blank=True)
    reincidencia = models.BooleanField(_("reincidência"), default=False)
    descricao = models.TextField(_("descrição"))
    acao_imediata = models.TextField(_("ação imediata"), blank=True)
    data_implementacao = models.DateField(
        _("data de implementação"),
        null=True,
        blank=True,
    )
    responsavel_implementacao = models.CharField(
        _("responsável pela implementação"),
        max_length=255,
        blank=True,
    )

    causa_metodo = models.BooleanField(_("causa: método"), default=False)
    causa_metodo_detalhe = models.CharField(
        _("detalhe: método"),
        max_length=255,
        blank=True,
    )
    causa_material = models.BooleanField(_("causa: material"), default=False)
    causa_material_detalhe = models.CharField(
        _("detalhe: material"),
        max_length=255,
        blank=True,
    )
    causa_mao_de_obra = models.BooleanField(_("causa: mão de obra"), default=False)
    causa_mao_de_obra_detalhe = models.CharField(
        _("detalhe: mão de obra"),
        max_length=255,
        blank=True,
    )
    causa_maquina = models.BooleanField(_("causa: máquina"), default=False)
    causa_maquina_detalhe = models.CharField(
        _("detalhe: máquina"),
        max_length=255,
        blank=True,
    )
    causa_medicao = models.BooleanField(_("causa: medição"), default=False)
    causa_medicao_detalhe = models.CharField(
        _("detalhe: medição"),
        max_length=255,
        blank=True,
    )
    causa_meio_ambiente = models.BooleanField(_("causa: meio ambiente"), default=False)
    causa_meio_ambiente_detalhe = models.CharField(
        _("detalhe: meio ambiente"),
        max_length=255,
        blank=True,
    )

    data_prazo = models.DateField(_("data prazo"), null=True, blank=True)
    status = models.CharField(
        _("status"),
        max_length=16,
        choices=StatusRncChoices.choices,
        default=StatusRncChoices.PENDENTE,
    )
    eficacia = models.CharField(
        _("eficácia"),
        max_length=16,
        choices=EficaciaChoices.choices,
        blank=True,
    )
    data_conclusao = models.DateTimeField(_("data de conclusão"), null=True, blank=True)

    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("criado por"),
        on_delete=models.PROTECT,
        related_name="rncs_criadas",
    )
    created_at = models.DateTimeField(_("criado em"), auto_now_add=True)
    updated_at = models.DateTimeField(_("atualizado em"), auto_now=True)

    tenant_path = "projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("RNC")
        verbose_name_plural = _("RNCs")
        ordering = ["-data_emissao", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["projeto", "numero_sequencial"],
                name="rnc_numero_sequencial_unico_por_projeto",
            ),
        ]

    def __str__(self) -> str:
        return f"RNC-{self.numero_sequencial:03d} — {self.projeto.nome}"


class AcaoCorretiva(models.Model):
    """Ação corretiva de uma RNC — lista, adicionada uma a uma (sem
    update/delete nesta rodada, mesmo padrão de `Foto` em registros_diarios)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rnc = models.ForeignKey(
        RNC,
        verbose_name=_("RNC"),
        on_delete=models.CASCADE,
        related_name="acoes_corretivas",
    )
    descricao = models.TextField(_("descrição"))
    risco = models.TextField(_("risco"), blank=True)
    data_limite = models.DateField(_("data limite"))
    responsavel = models.CharField(_("responsável"), max_length=255)

    tenant_path = "rnc__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("ação corretiva")
        verbose_name_plural = _("ações corretivas")

    def __str__(self) -> str:
        return self.descricao[:50]
