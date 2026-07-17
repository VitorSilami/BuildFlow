from rest_framework import mixins
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import TenantScopedViewSetMixin

from .models import Projeto
from .serializers import ProjetoSerializer


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
