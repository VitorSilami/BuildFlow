from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import TenantScopedViewSetMixin
from buildflow.projetos.models import Projeto

from . import services
from .models import RegistroDiario
from .serializers import FotoSerializer
from .serializers import RegistroDiarioSerializer


class RegistroDiarioViewSet(
    TenantScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = RegistroDiarioSerializer
    queryset = RegistroDiario.objects.all().prefetch_related(
        "producoes",
        "presencas",
        "maquinas",
        "ocorrencias",
        "fotos",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(projeto_id=self.kwargs["projeto_pk"])

    def _get_projeto(self) -> Projeto:
        # Principio I: o projeto so e valido se pertencer a empresa do
        # usuario autenticado — senao, 404 (nunca 403, FR-013).
        return get_object_or_404(
            Projeto.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["projeto_pk"],
        )

    def perform_create(self, serializer):
        projeto = self._get_projeto()
        serializer.save(projeto=projeto, autor=self.request.user)

    def list(self, request, *args, **kwargs):
        self._get_projeto()  # 404 antecipado se o projeto nao existe/nao e da empresa
        return super().list(request, *args, **kwargs)


class RegistroDiarioDetailView(
    TenantScopedViewSetMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    """Detalhe de um RDO, rota plana (`/registros-diarios/{id}/`, sem projeto
    no path — contracts/api.md)."""

    serializer_class = RegistroDiarioSerializer
    queryset = RegistroDiario.objects.all().prefetch_related(
        "producoes",
        "presencas",
        "maquinas",
        "ocorrencias",
        "fotos",
    )


class FotoUploadView(mixins.CreateModelMixin, GenericViewSet):
    serializer_class = FotoSerializer
    permission_classes = (IsAuthenticatedWithEmpresa,)
    parser_classes = (MultiPartParser, FormParser)

    def _get_registro(self) -> RegistroDiario:
        return get_object_or_404(
            RegistroDiario.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["registro_pk"],
        )

    def create(self, request, *args, **kwargs):
        registro = self._get_registro()
        arquivo = request.FILES.get("arquivo")
        if arquivo:
            try:
                services.validar_arquivo_foto(arquivo)
            except DjangoValidationError as exc:
                raise ValidationError({"arquivo": exc.messages}) from exc

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(registro_diario=registro)
        return Response(serializer.data, status=201)
