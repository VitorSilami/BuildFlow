import datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import TenantScopedViewSetMixin
from buildflow.registros_diarios.models import RegistroDiario

from .models import Projeto
from .serializers import ProjetoSerializer
from .services import calcular_execucao_percentual
from .services import decimal_para_str_ou_none

DIAS_LIMITE_ALERTA_RDO = 7


class ProjetoViewSet(
    TenantScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = ProjetoSerializer
    queryset = Projeto.objects.all()

    def perform_create(self, serializer):
        # Principio I: empresa e criado_por sempre derivados do usuario
        # autenticado, nunca aceitos do payload do cliente.
        serializer.save(empresa=self.request.user.empresa, criado_por=self.request.user)


class DashboardView(APIView):
    permission_classes = (IsAuthenticatedWithEmpresa,)

    def get(self, request, *args, **kwargs):
        empresa = request.user.empresa
        projetos = Projeto.objects.for_empresa(empresa)

        projetos_ativos = projetos.filter(status=Projeto.StatusChoices.ATIVO)

        execucoes = []
        projetos_payload = []
        for projeto in projetos_ativos:
            execucao = calcular_execucao_percentual(projeto)
            if execucao is not None:
                execucoes.append(execucao)
            projetos_payload.append(
                {
                    "id": str(projeto.id),
                    "nome": projeto.nome,
                    "status": projeto.status,
                    "execucao_percentual": decimal_para_str_ou_none(execucao),
                },
            )

        execucao_media = (
            (sum(execucoes) / len(execucoes)).quantize(Decimal("0.01"))
            if execucoes
            else None
        )

        hoje = timezone.now().date()
        limite = hoje - datetime.timedelta(days=DIAS_LIMITE_ALERTA_RDO)
        alertas = []
        for projeto in projetos_ativos:
            ultimo_rdo = (
                RegistroDiario.objects.filter(projeto=projeto)
                .order_by("-data_referencia")
                .first()
            )
            if ultimo_rdo is None or ultimo_rdo.data_referencia < limite:
                dias_sem_rdo = (
                    (hoje - ultimo_rdo.data_referencia).days
                    if ultimo_rdo is not None
                    else None
                )
                alertas.append(
                    {
                        "projeto_id": str(projeto.id),
                        "projeto_nome": projeto.nome,
                        "dias_sem_rdo": dias_sem_rdo,
                    },
                )

        return Response(
            {
                "projetos_ativos": projetos_ativos.count(),
                "projetos_pausados": projetos.filter(
                    status=Projeto.StatusChoices.PAUSADO,
                ).count(),
                "projetos_concluidos": projetos.filter(
                    status=Projeto.StatusChoices.CONCLUIDO,
                ).count(),
                "execucao_media": decimal_para_str_ou_none(execucao_media),
                "projetos": projetos_payload,
                "alertas": alertas,
            },
        )
