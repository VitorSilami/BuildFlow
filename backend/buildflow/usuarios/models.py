from typing import ClassVar

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from buildflow.empresas.models import Empresa

from .managers import UserManager


class PerfilChoices(models.TextChoices):
    GERENTE = "gerente", _("Gerente")
    AUXILIAR_ADMINISTRATIVO = "auxiliar_administrativo", _("Auxiliar administrativo")


class User(AbstractUser):
    """Usuario customizado do BuildFlow.

    Nao ha cadastro publico (Principio II da constituicao): usuarios sao criados
    pelo Django Admin, sempre vinculados a uma Empresa antes de poderem autenticar.
    """

    first_name = None  # type: ignore[assignment]
    last_name = None  # type: ignore[assignment]
    username = None  # type: ignore[assignment]

    nome = models.CharField(_("nome"), max_length=255)
    email = models.EmailField(_("email address"), unique=True)
    # null=True apenas para permitir superusuarios de plataforma (sem empresa,
    # criados via createsuperuser) — todo "usuario comum" (Gerente/Auxiliar)
    # MUST ter empresa; reforcado em UserAdmin.save_model e no adapter de login
    # (FR-003 / Principio I).
    empresa = models.ForeignKey(
        Empresa,
        verbose_name=_("empresa"),
        on_delete=models.PROTECT,
        related_name="usuarios",
        null=True,
        blank=True,
    )
    perfil = models.CharField(
        _("perfil"),
        max_length=32,
        choices=PerfilChoices.choices,
        blank=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    objects: ClassVar[UserManager] = UserManager()

    def __str__(self) -> str:
        return self.email

    def clean(self) -> None:
        super().clean()
        # FR-003: usuario comum (nao-superusuario) MUST estar vinculado a uma
        # empresa. Superusuarios de plataforma (is_superuser=True) sao a
        # excecao deliberada (ver comentario no campo `empresa`).
        if not self.is_superuser and self.empresa_id is None:
            msg = _("Usuarios comuns devem estar vinculados a uma empresa.")
            raise ValidationError({"empresa": msg})
