from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import IsGerente
from buildflow.core.permissions import TenantScopedViewSetMixin
from buildflow.projetos.models import Projeto
from buildflow.rnc import services
from buildflow.rnc.models import RNC
from buildflow.rnc.models import AcaoCorretiva
from buildflow.rnc.serializers import AcaoCorretivaSerializer
from buildflow.rnc.serializers import RncSerializer


class RncViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, GenericViewSet):
    serializer_class = RncSerializer
    queryset = RNC.objects.all().prefetch_related("acoes_corretivas")
    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)
    pagination_class = None

    def get_queryset(self):
        queryset = (
            RNC.objects.for_empresa(self.request.user.empresa)
            .filter(projeto_id=self.kwargs["projeto_pk"])
            .prefetch_related("acoes_corretivas")
        )
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        categoria = self.request.query_params.get("categoria")
        if categoria:
            queryset = queryset.filter(categoria=categoria)
        return queryset

    def _get_projeto(self) -> Projeto:
        return get_object_or_404(
            Projeto.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["projeto_pk"],
        )

    def perform_create(self, serializer):
        projeto = self._get_projeto()
        numero_sequencial = services.gerar_numero_sequencial(projeto)
        serializer.save(
            projeto=projeto,
            numero_sequencial=numero_sequencial,
            criado_por=self.request.user,
        )

    def list(self, request, *args, **kwargs):
        self._get_projeto()
        return super().list(request, *args, **kwargs)


class RncDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = RncSerializer
    queryset = RNC.objects.all().prefetch_related("acoes_corretivas")
    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)

    def concluir(self, request, *args, **kwargs):
        rnc = self.get_object()
        try:
            services.concluir_rnc(rnc=rnc, eficacia=request.data.get("eficacia", ""))
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        return Response(self.get_serializer(rnc).data)


class RncNestedMixin:
    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)

    def _get_rnc(self) -> RNC:
        return get_object_or_404(
            RNC.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["rnc_pk"],
        )


class AcaoCorretivaViewSet(RncNestedMixin, mixins.CreateModelMixin, GenericViewSet):
    serializer_class = AcaoCorretivaSerializer
    queryset = AcaoCorretiva.objects.all()

    def perform_create(self, serializer):
        rnc = self._get_rnc()
        try:
            services.validar_rnc_editavel(rnc)
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        serializer.save(rnc=rnc)
