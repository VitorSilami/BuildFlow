from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import IsGerente
from buildflow.core.permissions import TenantScopedViewSetMixin
from buildflow.projetos.models import Projeto
from buildflow.usuarios.models import User

from . import services
from .models import Medicao
from .models import StatusMedicaoChoices
from .serializers import MedicaoSerializer
from .services import MedicaoInvalida


class ProjetoNestedMixin:
    """Views aninhadas sob `/projetos/{projeto_pk}/...` — deriva `projeto` do
    usuario autenticado (Principio I), nunca do payload."""

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def _get_projeto(self) -> Projeto:
        return get_object_or_404(
            Projeto.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["projeto_pk"],
        )


class MedicaoViewSet(
    TenantScopedViewSetMixin,
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = MedicaoSerializer
    queryset = (
        Medicao.objects.all()
        .select_related("fiscal", "criado_por")
        .prefetch_related("itens")
    )
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(projeto_id=self.kwargs["projeto_pk"]).order_by(
            "-data_corte",
        )

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticatedWithEmpresa(), IsGerente()]
        return [IsAuthenticatedWithEmpresa()]

    def create(self, request, *args, **kwargs):
        projeto = self._get_projeto()
        data_corte = parse_date(str(request.data.get("data_corte", "")))
        if data_corte is None:
            msg = "Informe uma data de corte válida (YYYY-MM-DD)."
            raise ValidationError({"data_corte": msg})
        fiscal = get_object_or_404(
            User.objects.filter(empresa=projeto.empresa),
            pk=request.data.get("fiscal"),
        )
        try:
            medicao = services.criar_medicao(
                projeto=projeto,
                data_corte=data_corte,
                fiscal=fiscal,
                criado_por=request.user,
            )
        except MedicaoInvalida as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        return Response(self.get_serializer(medicao).data, status=201)

    def aprovar(self, request, *args, **kwargs):
        medicao = self.get_object()
        try:
            services.transicionar_status_medicao(
                medicao=medicao,
                novo_status=StatusMedicaoChoices.APROVADO,
                usuario=request.user,
            )
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        return Response(self.get_serializer(medicao).data)

    def rejeitar(self, request, *args, **kwargs):
        medicao = self.get_object()
        try:
            services.transicionar_status_medicao(
                medicao=medicao,
                novo_status=StatusMedicaoChoices.REJEITADO,
                usuario=request.user,
                motivo_rejeicao=request.data.get("motivo_rejeicao", ""),
            )
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        return Response(self.get_serializer(medicao).data)

    def destroy(self, request, *args, **kwargs):
        medicao = self.get_object()
        try:
            services.cancelar_medicao(medicao=medicao, usuario=request.user)
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        return Response(status=204)
