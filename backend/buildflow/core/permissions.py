from __future__ import annotations

import typing

from rest_framework.permissions import BasePermission

if typing.TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView


class IsAuthenticatedWithEmpresa(BasePermission):
    """Autenticado E vinculado a uma empresa (Principio I).

    Defesa em profundidade: mesmo superusuarios de plataforma (sem empresa)
    nao devem acessar dados de negocio via API.
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.empresa_id is not None)


class TenantScopedViewSetMixin:
    """Restringe o queryset a empresa do usuario autenticado (Principio I).

    Toda view que exponha um recurso vinculado (direta ou indiretamente) a uma
    Empresa MUST herdar deste mixin. A criacao continua responsabilidade de
    cada view concreta (`perform_create`), que MUST derivar `empresa` (ou o FK
    pai equivalente) do usuario autenticado — nunca do payload do cliente.
    """

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.for_empresa(self.request.user.empresa)
