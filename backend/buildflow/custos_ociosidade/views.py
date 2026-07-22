from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import IsGerente
from buildflow.projetos.models import Projeto

from .services import calcular_custos_ociosidade


class CustosOciosidadeView(APIView):
    """Custo/deficit de mao de obra e custo/ociosidade de maquinas de um
    projeto, por mes — somente leitura, restrito ao perfil Gerente."""

    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)

    def get(self, request, projeto_pk):
        projeto = get_object_or_404(
            Projeto.objects.for_empresa(request.user.empresa),
            pk=projeto_pk,
        )

        ano, mes = self._parse_filtro_mes(request.query_params.get("mes"))

        return Response(calcular_custos_ociosidade(projeto, ano, mes))

    @staticmethod
    def _parse_filtro_mes(mes: str | None) -> tuple[int, int]:
        if not mes:
            raise ValidationError({"mes": "Use o formato YYYY-MM."})
        try:
            ano_str, mes_str = mes.split("-")
            return int(ano_str), int(mes_str)
        except ValueError as erro:
            raise ValidationError({"mes": "Use o formato YYYY-MM."}) from erro
