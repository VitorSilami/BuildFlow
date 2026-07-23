from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import mixins
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from buildflow.core.filtros import filtro_intervalo_datas
from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import TenantScopedViewSetMixin
from buildflow.projetos.models import Projeto

from . import services
from .models import RegistroDiario
from .models import StatusRegistroChoices
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
        queryset = queryset.filter(projeto_id=self.kwargs["projeto_pk"])

        data_inicio = self.request.query_params.get("data_inicio")
        data_fim = self.request.query_params.get("data_fim")
        filtro_intervalo = filtro_intervalo_datas(data_inicio, data_fim, "data_referencia")
        if filtro_intervalo:
            return queryset.filter(**filtro_intervalo)

        mes = self.request.query_params.get("mes")
        if mes:
            ano, mes_numero = self._parse_filtro_mes(mes)
            queryset = queryset.filter(
                data_referencia__year=ano,
                data_referencia__month=mes_numero,
            )
        return queryset

    @staticmethod
    def _parse_filtro_mes(mes: str) -> tuple[int, int]:
        try:
            ano_str, mes_str = mes.split("-")
            return int(ano_str), int(mes_str)
        except ValueError as erro:
            raise ValidationError({"mes": "Use o formato YYYY-MM."}) from erro

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
        if request.query_params.get("mes") or request.query_params.get("data_inicio"):
            self.pagination_class = None
        return super().list(request, *args, **kwargs)

    def aprovar(self, request, *args, **kwargs):
        registro = self.get_object()
        try:
            services.transicionar_status_registro(
                registro=registro,
                novo_status=StatusRegistroChoices.APROVADO,
                usuario=request.user,
            )
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        return Response(self.get_serializer(registro).data)

    def rejeitar(self, request, *args, **kwargs):
        registro = self.get_object()
        try:
            services.transicionar_status_registro(
                registro=registro,
                novo_status=StatusRegistroChoices.REJEITADO,
                usuario=request.user,
                motivo_rejeicao=request.data.get("motivo_rejeicao", ""),
            )
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        return Response(self.get_serializer(registro).data)


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
