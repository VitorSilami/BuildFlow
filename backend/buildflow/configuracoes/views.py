from django.shortcuts import get_object_or_404
from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import IsGerente
from buildflow.core.permissions import TenantScopedViewSetMixin
from buildflow.projetos.models import Projeto
from buildflow.usuarios.api.serializers import UserSerializer
from buildflow.usuarios.models import User

from . import services
from .models import CatalogoServico
from .models import Disciplina
from .models import Equipe
from .models import Maquina
from .models import MotivoParada
from .models import Pessoa
from .models import Unidade
from .models import ValorCusto
from .serializers import CatalogoServicoSerializer
from .serializers import DisciplinaSerializer
from .serializers import EquipeSerializer
from .serializers import MaquinaSerializer
from .serializers import MotivoParadaSerializer
from .serializers import PessoaSerializer
from .serializers import UnidadeSerializer
from .serializers import ValorCustoSerializer


class ConfiguracaoRdoView(APIView):
    """Bootstrap somente-leitura para o formulário de RDO: disciplinas (com
    serviços), unidades, equipes (com pessoas/máquinas) e motivos de parada
    do projeto — usado para popular os seletores da etapa de produção/equipe/
    máquinas (FR-020).
    """

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def get(self, request, projeto_pk):
        projeto = get_object_or_404(
            Projeto.objects.for_empresa(request.user.empresa),
            pk=projeto_pk,
        )

        disciplinas = Disciplina.objects.filter(projeto=projeto).prefetch_related(
            "servicos",
        )
        equipes = Equipe.objects.filter(projeto=projeto).prefetch_related(
            "pessoas",
            "maquinas",
        )

        fiscais = User.objects.filter(empresa=request.user.empresa, is_active=True)

        return Response(
            {
                "disciplinas": DisciplinaSerializer(disciplinas, many=True).data,
                "unidades": UnidadeSerializer(Unidade.objects.all(), many=True).data,
                "equipes": EquipeSerializer(equipes, many=True).data,
                "motivos_parada": MotivoParadaSerializer(
                    MotivoParada.objects.all(),
                    many=True,
                ).data,
                "fiscais": UserSerializer(fiscais, many=True).data,
            },
        )


class ConfiguracaoProjetoView(APIView):
    """Visão completa da Configuração de um projeto (FR-023): EAP
    (disciplinas com peso/avanço), equipes (com pessoas/máquinas) e valores
    de custo.
    """

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def get(self, request, projeto_pk):
        projeto = get_object_or_404(
            Projeto.objects.for_empresa(request.user.empresa),
            pk=projeto_pk,
        )

        equipes = Equipe.objects.filter(projeto=projeto).prefetch_related(
            "pessoas",
            "maquinas",
        )
        valores = ValorCusto.objects.filter(projeto=projeto)
        disciplinas = Disciplina.objects.filter(projeto=projeto).prefetch_related(
            "servicos",
        )

        return Response(
            {
                "disciplinas": DisciplinaSerializer(disciplinas, many=True).data,
                "equipes": EquipeSerializer(equipes, many=True).data,
                "valores_custo": ValorCustoSerializer(valores, many=True).data,
                "soma_pesos_disciplinas": services.soma_pesos_disciplinas(projeto),
            },
        )


class ProjetoNestedMixin:
    """Views aninhadas sob `/projetos/{projeto_pk}/...` — deriva `projeto` do
    usuario autenticado (Principio I), nunca do payload."""

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def _get_projeto(self) -> Projeto:
        return get_object_or_404(
            Projeto.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["projeto_pk"],
        )


class DisciplinaViewSet(
    TenantScopedViewSetMixin,
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = DisciplinaSerializer
    queryset = Disciplina.objects.all().prefetch_related("servicos")

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticatedWithEmpresa(), IsGerente()]
        return [IsAuthenticatedWithEmpresa()]

    def get_queryset(self):
        return super().get_queryset().filter(projeto_id=self.kwargs["projeto_pk"])

    def perform_create(self, serializer):
        serializer.save(projeto=self._get_projeto())


class DisciplinaDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = DisciplinaSerializer
    queryset = Disciplina.objects.all()
    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)


class DisciplinaNestedMixin:
    """Views aninhadas sob `/configuracoes/disciplinas/{disciplina_pk}/...`."""

    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)

    def _get_disciplina(self) -> Disciplina:
        return get_object_or_404(
            Disciplina.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["disciplina_pk"],
        )


class ServicoViewSet(DisciplinaNestedMixin, mixins.CreateModelMixin, GenericViewSet):
    serializer_class = CatalogoServicoSerializer
    queryset = CatalogoServico.objects.all()

    def perform_create(self, serializer):
        serializer.save(disciplina=self._get_disciplina())


class ServicoDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = CatalogoServicoSerializer
    queryset = CatalogoServico.objects.all()
    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)


class EquipeViewSet(
    TenantScopedViewSetMixin,
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = EquipeSerializer
    queryset = Equipe.objects.all().prefetch_related("pessoas", "maquinas")

    def get_queryset(self):
        return super().get_queryset().filter(projeto_id=self.kwargs["projeto_pk"])

    def perform_create(self, serializer):
        serializer.save(projeto=self._get_projeto())


class EquipeDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = EquipeSerializer
    queryset = Equipe.objects.all()


class EquipeNestedMixin:
    """Views aninhadas sob `/configuracao/equipes/{equipe_pk}/...`."""

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def _get_equipe(self) -> Equipe:
        return get_object_or_404(
            Equipe.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["equipe_pk"],
        )


class PessoaViewSet(EquipeNestedMixin, mixins.CreateModelMixin, GenericViewSet):
    serializer_class = PessoaSerializer
    queryset = Pessoa.objects.all()

    def perform_create(self, serializer):
        serializer.save(equipe=self._get_equipe())


class PessoaDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = PessoaSerializer
    queryset = Pessoa.objects.all()


class MaquinaViewSet(EquipeNestedMixin, mixins.CreateModelMixin, GenericViewSet):
    serializer_class = MaquinaSerializer
    queryset = Maquina.objects.all()

    def perform_create(self, serializer):
        serializer.save(equipe=self._get_equipe())


class MaquinaDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = MaquinaSerializer
    queryset = Maquina.objects.all()


class ValorCustoViewSet(
    TenantScopedViewSetMixin,
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = ValorCustoSerializer
    queryset = ValorCusto.objects.all()

    def get_queryset(self):
        return super().get_queryset().filter(projeto_id=self.kwargs["projeto_pk"])

    def perform_create(self, serializer):
        serializer.save(projeto=self._get_projeto())


class ValorCustoDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = ValorCustoSerializer
    queryset = ValorCusto.objects.all()
