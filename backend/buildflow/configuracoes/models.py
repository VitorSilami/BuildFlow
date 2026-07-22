import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _

from buildflow.core.querysets import TenantScopedManager
from buildflow.projetos.models import Projeto


class Unidade(models.Model):
    """Tabela global de unidades de medida (X, autoritativo: BASE_QTD_L2/BASE_EAP)."""

    sigla = models.CharField(_("sigla"), max_length=16, unique=True)
    descricao = models.CharField(_("descricao"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("unidade")
        verbose_name_plural = _("unidades")
        ordering = ["sigla"]

    def __str__(self) -> str:
        return self.sigla


class MotivoParada(models.Model):
    """Tabela global de motivos de parada de maquina (H)."""

    descricao = models.CharField(_("descricao"), max_length=255, unique=True)

    class Meta:
        verbose_name = _("motivo de parada")
        verbose_name_plural = _("motivos de parada")
        ordering = ["descricao"]

    def __str__(self) -> str:
        return self.descricao


class Disciplina(models.Model):
    """Catalogo aberto por projeto (X: BASE_EAP.DISCIPLINA / BASE_QTD_L2.DISCIPLINA).

    Nao e um enum fechado — cada projeto pode ter seu proprio conjunto de
    disciplinas (Fase 1/Descoberta, secao 7 do relatorio de campos).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        verbose_name=_("projeto"),
        on_delete=models.CASCADE,
        related_name="disciplinas",
    )
    nome = models.CharField(_("nome"), max_length=255)

    tenant_path = "projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("disciplina")
        verbose_name_plural = _("disciplinas")
        ordering = ["nome"]
        constraints = [
            models.UniqueConstraint(
                fields=["projeto", "nome"],
                name="disciplina_unica_por_projeto",
            ),
        ]

    def __str__(self) -> str:
        return self.nome


class CatalogoServico(models.Model):
    """Servico executavel dentro de uma disciplina (H: CATALOGO)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    disciplina = models.ForeignKey(
        Disciplina,
        verbose_name=_("disciplina"),
        on_delete=models.CASCADE,
        related_name="servicos",
    )
    nome = models.CharField(_("nome"), max_length=255)
    unidade = models.ForeignKey(
        Unidade,
        verbose_name=_("unidade"),
        on_delete=models.PROTECT,
    )

    tenant_path = "disciplina__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("servico do catalogo")
        verbose_name_plural = _("servicos do catalogo")
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome


class Equipe(models.Model):
    """Frente de trabalho de um projeto (H — sub-aba "Frentes & Equipes").

    Adiantada para o Foundational (junto de T020): Presenca/ApontamentoMaquina
    (US4) referenciam Pessoa/Maquina como FK opcional (vinculo com cadastro OU
    avulso), entao os models precisam existir antes de US4 — mesma correcao
    de dependencia ja aplicada a Projeto/Disciplina.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        verbose_name=_("projeto"),
        on_delete=models.CASCADE,
        related_name="equipes",
    )
    nome = models.CharField(_("nome"), max_length=255)
    encarregado = models.ForeignKey(
        "Pessoa",
        verbose_name=_("encarregado"),
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="equipes_como_encarregado",
    )

    tenant_path = "projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("equipe")
        verbose_name_plural = _("equipes")
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome


class Pessoa(models.Model):
    """Integrante cadastrado de uma equipe (H)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    equipe = models.ForeignKey(
        Equipe,
        verbose_name=_("equipe"),
        on_delete=models.CASCADE,
        related_name="pessoas",
    )
    nome = models.CharField(_("nome"), max_length=255)
    funcao = models.CharField(_("funcao"), max_length=255)

    tenant_path = "equipe__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("pessoa")
        verbose_name_plural = _("pessoas")
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome


class Maquina(models.Model):
    """Equipamento no pool de uma equipe (H).

    Correcao de design: `equipe` obrigatorio (nao nullable como sugerido em
    data-model.md) — Maquina so tem caminho ate Empresa via Equipe
    (`tenant_path`), e um FK nulo quebraria o isolamento multitenant (a
    maquina nunca apareceria em nenhum filtro por empresa). Um "pool do
    projeto sem equipe" fica fora do escopo do MVP; lancamento avulso no RDO
    ja cobre a necessidade pratica.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    equipe = models.ForeignKey(
        Equipe,
        verbose_name=_("equipe"),
        on_delete=models.CASCADE,
        related_name="maquinas",
    )
    codigo = models.CharField(_("codigo"), max_length=64)
    nome = models.CharField(_("nome"), max_length=255)

    tenant_path = "equipe__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("maquina")
        verbose_name_plural = _("maquinas")
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome


class TipoValorCustoChoices(models.TextChoices):
    MAO_DE_OBRA = "mao_de_obra", _("Mão de obra")
    EQUIPAMENTO = "equipamento", _("Equipamento")


class MetaMensal(models.Model):
    """Meta de produção por disciplina (H — sub-aba "Metas").

    Nome `MetaMensal` (em vez de `Meta`) para nao colidir com a classe
    `Meta` de opcoes do proprio Django model.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        verbose_name=_("projeto"),
        on_delete=models.CASCADE,
        related_name="metas",
    )
    disciplina = models.ForeignKey(
        Disciplina,
        verbose_name=_("disciplina"),
        on_delete=models.CASCADE,
        related_name="metas",
    )
    unidade = models.ForeignKey(
        Unidade,
        verbose_name=_("unidade"),
        on_delete=models.PROTECT,
    )
    valor_alvo = models.DecimalField(_("valor alvo"), max_digits=12, decimal_places=3)
    peso_percentual = models.DecimalField(
        _("peso percentual"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )

    tenant_path = "projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("meta")
        verbose_name_plural = _("metas")
        constraints = [
            models.UniqueConstraint(
                fields=["projeto", "disciplina"],
                name="meta_unica_por_disciplina_e_projeto",
            ),
        ]

    def __str__(self) -> str:
        return f"Meta {self.disciplina.nome} — {self.valor_alvo}{self.unidade.sigla}"


class ValorCusto(models.Model):
    """Valor de custo de mao de obra ou equipamento (H — sub-aba "Valores dos
    Contratos"), recorte simplificado sem o modulo completo de
    contratos/medicao (fora do escopo do MVP).

    `valor` e R$/dia quando tipo=mao_de_obra (diaria) e R$/hora quando
    tipo=equipamento (valor-hora de maquina) — usado pelo modulo de Custos &
    Ociosidade para atribuir custo real por funcao/maquina.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        verbose_name=_("projeto"),
        on_delete=models.CASCADE,
        related_name="valores_custo",
    )
    tipo = models.CharField(
        _("tipo"),
        max_length=16,
        choices=TipoValorCustoChoices.choices,
    )
    descricao = models.CharField(_("descricao"), max_length=255)
    valor = models.DecimalField(_("valor"), max_digits=12, decimal_places=2)
    funcao = models.CharField(_("função"), max_length=255, blank=True)
    maquina = models.ForeignKey(
        Maquina,
        verbose_name=_("máquina"),
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="valores_custo",
    )

    tenant_path = "projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("valor de custo")
        verbose_name_plural = _("valores de custo")
        ordering = ["descricao"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(tipo="mao_de_obra", maquina__isnull=True)
                    | models.Q(tipo="equipamento", funcao="")
                ),
                name="valor_custo_funcao_ou_maquina_por_tipo",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.descricao} ({self.get_tipo_display()})"
