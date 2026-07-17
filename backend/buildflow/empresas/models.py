import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _


class Empresa(models.Model):
    """Fronteira de isolamento multitenant (Principio I da constituicao)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(_("nome"), max_length=255)
    slug = models.SlugField(_("identificador interno"), unique=True)
    is_active = models.BooleanField(_("ativa"), default=True)
    created_at = models.DateTimeField(_("criado em"), auto_now_add=True)
    updated_at = models.DateTimeField(_("atualizado em"), auto_now=True)

    class Meta:
        verbose_name = _("empresa")
        verbose_name_plural = _("empresas")
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome
