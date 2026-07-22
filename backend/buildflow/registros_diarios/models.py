import uuid

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import Maquina
from buildflow.configuracoes.models import MotivoParada
from buildflow.configuracoes.models import Pessoa
from buildflow.configuracoes.models import Unidade
from buildflow.core.querysets import TenantScopedManager
from buildflow.projetos.models import Projeto


class TurnoChoices(models.TextChoices):
    DIURNO = "diurno", _("Diurno")
    NOTURNO = "noturno", _("Noturno")


class ClimaChoices(models.TextChoices):
    SOL = "sol", _("Sol")
    NUBLADO = "nublado", _("Nublado")
    CHUVA = "chuva", _("Chuva")
    CHUVA_FORTE = "chuva_forte", _("Chuva forte")


class SentidoChoices(models.TextChoices):
    # Default assumido (Fase 1/Descoberta, item 4): valores reais de SENTIDOS
    # nao confirmados nos arquivos de referencia.
    CRESCENTE = "crescente", _("Crescente")
    DECRESCENTE = "decrescente", _("Decrescente")


class TipoOcorrenciaChoices(models.TextChoices):
    CLIMATICA = "climatica", _("Climática")
    INTERFERENCIA = "interferencia", _("Interferência")
    SEGURANCA = "seguranca", _("Segurança")
    LOGISTICA = "logistica", _("Logística")
    QUALIDADE = "qualidade", _("Qualidade")
    OUTRO = "outro", _("Outro")


class RecursoAfetadoChoices(models.TextChoices):
    MAQUINARIOS = "maquinarios", _("Maquinários")
    MAO_DE_OBRA = "mao_de_obra", _("Mão de Obra")
    MATERIAIS = "materiais", _("Materiais")
    RECURSOS = "recursos", _("Recursos")
    AREA_FRENTE = "area_frente", _("Área/Frente")
    OUTRO = "outro", _("Outro")


class StatusPresencaChoices(models.TextChoices):
    PRESENTE = "presente", _("Presente")
    FALTA = "falta", _("Falta")
    ATESTADO = "atestado", _("Atestado")


class OrigemChoices(models.TextChoices):
    COMPOSICAO = "composicao", _("Composição")
    AVULSO = "avulso", _("Avulso")


class StatusRegistroChoices(models.TextChoices):
    AGUARDANDO_APROVACAO = "aguardando_aprovacao", _("Aguardando Aprovação")
    APROVADO = "aprovado", _("Aprovado")
    REJEITADO = "rejeitado", _("Rejeitado")


class RegistroDiario(models.Model):
    """RDO — relato de um dia de trabalho em um projeto.

    Todo RDO nasce "Aguardando Aprovação" e só o fiscal designado pode
    aprová-lo ou rejeitá-lo — ver services.transicionar_status_registro.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        verbose_name=_("projeto"),
        on_delete=models.CASCADE,
        related_name="registros_diarios",
    )
    data_referencia = models.DateField(_("data de referência"))
    turno = models.CharField(_("turno"), max_length=16, choices=TurnoChoices.choices)
    clima = models.CharField(_("clima"), max_length=16, choices=ClimaChoices.choices)
    equipe = models.ForeignKey(
        Equipe,
        verbose_name=_("equipe"),
        on_delete=models.PROTECT,
        related_name="registros_diarios",
    )
    fiscal = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("fiscal"),
        on_delete=models.PROTECT,
        related_name="rdos_como_fiscal",
    )
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("autor"),
        on_delete=models.PROTECT,
        related_name="rdos_criados",
    )
    atualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("atualizado por"),
        on_delete=models.PROTECT,
        related_name="rdos_atualizados",
        null=True,
        blank=True,
    )
    status = models.CharField(
        _("status"),
        max_length=24,
        choices=StatusRegistroChoices.choices,
        default=StatusRegistroChoices.AGUARDANDO_APROVACAO,
    )
    motivo_rejeicao = models.TextField(_("motivo da rejeição"), blank=True)
    aprovado_em = models.DateTimeField(_("aprovado em"), null=True, blank=True)
    created_at = models.DateTimeField(_("criado em"), auto_now_add=True)
    updated_at = models.DateTimeField(_("atualizado em"), auto_now=True)

    tenant_path = "projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("registro diário")
        verbose_name_plural = _("registros diários")
        ordering = ["-data_referencia", "-created_at"]

    def __str__(self) -> str:
        return f"RDO {self.projeto.nome} — {self.data_referencia}"


class ProducaoDiaria(models.Model):
    """Item de producao do dia dentro de um RDO."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registro_diario = models.ForeignKey(
        RegistroDiario,
        verbose_name=_("registro diário"),
        on_delete=models.CASCADE,
        related_name="producoes",
    )
    rodovia = models.CharField(_("rodovia"), max_length=255)
    sentido = models.CharField(
        _("sentido"),
        max_length=16,
        choices=SentidoChoices.choices,
    )
    disciplina = models.ForeignKey(
        Disciplina,
        verbose_name=_("disciplina"),
        on_delete=models.PROTECT,
    )
    servico = models.ForeignKey(
        CatalogoServico,
        verbose_name=_("serviço"),
        on_delete=models.PROTECT,
    )
    km_inicial = models.DecimalField(_("km inicial"), max_digits=8, decimal_places=3)
    km_final = models.DecimalField(_("km final"), max_digits=8, decimal_places=3)
    quantidade = models.DecimalField(_("quantidade"), max_digits=12, decimal_places=3)
    unidade = models.ForeignKey(
        Unidade,
        verbose_name=_("unidade"),
        on_delete=models.PROTECT,
    )

    tenant_path = "registro_diario__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("produção diária")
        verbose_name_plural = _("produções diárias")

    def __str__(self) -> str:
        return f"{self.servico} ({self.quantidade} {self.unidade})"


class Presenca(models.Model):
    """Presenca de uma pessoa em um RDO — vinculada a cadastro OU avulsa
    (Clarification, spec.md 2026-07-16)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registro_diario = models.ForeignKey(
        RegistroDiario,
        verbose_name=_("registro diário"),
        on_delete=models.CASCADE,
        related_name="presencas",
    )
    pessoa = models.ForeignKey(
        Pessoa,
        verbose_name=_("pessoa"),
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    nome_avulso = models.CharField(_("nome (avulso)"), max_length=255, blank=True)
    funcao = models.CharField(_("função"), max_length=255)
    status = models.CharField(
        _("status"),
        max_length=16,
        choices=StatusPresencaChoices.choices,
    )
    origem = models.CharField(_("origem"), max_length=16, choices=OrigemChoices.choices)

    tenant_path = "registro_diario__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("presença")
        verbose_name_plural = _("presenças")
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(pessoa__isnull=False, nome_avulso="")
                    | models.Q(pessoa__isnull=True, nome_avulso__gt="")
                ),
                name="presenca_pessoa_xor_avulso",
            ),
        ]

    def __str__(self) -> str:
        return self.pessoa.nome if self.pessoa_id else self.nome_avulso


class ApontamentoMaquina(models.Model):
    """Uso de uma maquina em um RDO — vinculada a cadastro OU avulsa."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registro_diario = models.ForeignKey(
        RegistroDiario,
        verbose_name=_("registro diário"),
        on_delete=models.CASCADE,
        related_name="maquinas",
    )
    maquina = models.ForeignKey(
        Maquina,
        verbose_name=_("máquina"),
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    identificacao_avulsa = models.CharField(
        _("identificação (avulsa)"),
        max_length=255,
        blank=True,
    )
    horas_produtivas = models.DecimalField(
        _("horas produtivas"),
        max_digits=5,
        decimal_places=2,
    )
    horas_paradas = models.DecimalField(
        _("horas paradas"),
        max_digits=5,
        decimal_places=2,
        default=0,
    )
    motivo_parada = models.ForeignKey(
        MotivoParada,
        verbose_name=_("motivo da parada"),
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    origem = models.CharField(_("origem"), max_length=16, choices=OrigemChoices.choices)

    tenant_path = "registro_diario__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("apontamento de máquina")
        verbose_name_plural = _("apontamentos de máquina")
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(maquina__isnull=False, identificacao_avulsa="")
                    | models.Q(maquina__isnull=True, identificacao_avulsa__gt="")
                ),
                name="apontamento_maquina_xor_avulso",
            ),
        ]

    def __str__(self) -> str:
        return self.maquina.nome if self.maquina_id else self.identificacao_avulsa

    @property
    def eficiencia(self) -> float:
        total = self.horas_produtivas + self.horas_paradas
        if total == 0:
            return 0.0
        return float(self.horas_produtivas / total)


class Ocorrencia(models.Model):
    """Evento relatado em um RDO."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registro_diario = models.ForeignKey(
        RegistroDiario,
        verbose_name=_("registro diário"),
        on_delete=models.CASCADE,
        related_name="ocorrencias",
    )
    tipo = models.CharField(
        _("tipo"),
        max_length=16,
        choices=TipoOcorrenciaChoices.choices,
    )
    recurso_afetado = models.CharField(
        _("recurso afetado"),
        max_length=16,
        choices=RecursoAfetadoChoices.choices,
    )
    descricao = models.TextField(_("descrição"))

    tenant_path = "registro_diario__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("ocorrência")
        verbose_name_plural = _("ocorrências")

    def __str__(self) -> str:
        return f"{self.tipo}: {self.descricao[:50]}"


def foto_upload_path(instance: Foto, filename: str) -> str:
    return f"rdos/{instance.registro_diario_id}/fotos/{filename}"


class Foto(models.Model):
    """Evidencia visual anexada a um RDO (FR-022)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registro_diario = models.ForeignKey(
        RegistroDiario,
        verbose_name=_("registro diário"),
        on_delete=models.CASCADE,
        related_name="fotos",
    )
    arquivo = models.ImageField(_("arquivo"), upload_to=foto_upload_path)
    km = models.DecimalField(
        _("km"),
        max_digits=8,
        decimal_places=3,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(_("criado em"), auto_now_add=True)

    tenant_path = "registro_diario__projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("foto")
        verbose_name_plural = _("fotos")

    def __str__(self) -> str:
        return f"Foto {self.id} — RDO {self.registro_diario_id}"
