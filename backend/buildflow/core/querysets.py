from __future__ import annotations

from django.db import models


class TenantScopedQuerySet(models.QuerySet):
    """QuerySet que sabe filtrar por empresa via o caminho declarado no model.

    Cada model que participa do isolamento multitenant (Principio I) declara
    `tenant_path`: o lookup Django ate o FK de Empresa (ex.: "empresa" em
    Projeto, "projeto__empresa" em RegistroDiario).
    """

    def for_empresa(self, empresa) -> TenantScopedQuerySet:
        return self.filter(**{self.model.tenant_path: empresa})


class TenantScopedManager(models.Manager.from_queryset(TenantScopedQuerySet)):
    pass
