from django.shortcuts import get_object_or_404
from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import TenantScopedViewSetMixin
from buildflow.projetos.models import Projeto
from buildflow.usuarios.api.serializers import UserSerializer
from buildflow.usuarios.models import User

from . import services
from .models import Disciplina
from .models import Equipe
from .models import Maquina
from .models import MetaMensal
from .models import MotivoParada
from .models import Pessoa
from .models import Unidade
from .models import ValorCusto
from .serializers import DisciplinaSerializer
from .serializers import EquipeSerializer
from .serializers import MaquinaSerializer
from .serializers import MetaMensalSerializer
from .serializers import MotivoParadaSerializer
from .serializers import PessoaSerializer
from .serializers import UnidadeSerializer
from .serializers import ValorCustoSerializer


class ConfiguracaoRdoView(APIView):
    """Bootstrap somente-leitura para o formulário de RDO: disciplinas (com
    serviços), unidades, equipes (com pessoas/máquinas) e motivos de parada
    do projeto — usado para popular os seletores da etapa de produção/equipe/
    máquinas (FR-020).

    Correção pós-design (mesma razão de Projeto/Equipe terem sido
    adiantados): a UI de RDO (US4) precisa listar esses cadastros antes de a
    gestão completa de Configurações (US5, CRUD) existir. Aqui só leitura.
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
                # Correcao pos-teste manual: o formulario de RDO exigia digitar um ID
                # de usuario a mao para o fiscal, sem forma de descobri-lo na UI.
                "fiscais": UserSerializer(fiscais, many=True).data,
            },
        )


class ConfiguracaoProjetoView(APIView):
    """Visão completa da Configuração de um projeto (FR-023): metas,
    equipes (com pessoas/máquinas), valores de custo e disciplinas.
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
        metas = MetaMensal.objects.filter(projeto=projeto)
        valores = ValorCusto.objects.filter(projeto=projeto)

        return Response(
            {
                "disciplinas": DisciplinaSerializer(
                    Disciplina.objects.filter(projeto=projeto),
                    many=True,
                ).data,
                "equipes": EquipeSerializer(equipes, many=True).data,
                "metas": MetaMensalSerializer(metas, many=True).data,
                "valores_custo": ValorCustoSerializer(valores, many=True).data,
                "soma_pesos_metas": services.soma_pesos_disciplinas(projeto),
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
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = DisciplinaSerializer
    queryset = Disciplina.objects.all()

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


class EquipeViewSet(
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


class MetaViewSet(
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = MetaMensalSerializer
    queryset = MetaMensal.objects.all()

    def get_queryset(self):
        return super().get_queryset().filter(projeto_id=self.kwargs["projeto_pk"])

    def perform_create(self, serializer):
        serializer.save(projeto=self._get_projeto())


class MetaDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = MetaMensalSerializer
    queryset = MetaMensal.objects.all()


class ValorCustoViewSet(
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
