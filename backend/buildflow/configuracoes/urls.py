from django.urls import path

from .views import ConfiguracaoProjetoView
from .views import ConfiguracaoRdoView
from .views import DisciplinaDetailViewSet
from .views import DisciplinaViewSet
from .views import EapImportView
from .views import EquipeDetailViewSet
from .views import EquipeViewSet
from .views import MaquinaDetailViewSet
from .views import MaquinaViewSet
from .views import PessoaDetailViewSet
from .views import PessoaViewSet
from .views import ServicoDetailViewSet
from .views import ServicoViewSet
from .views import ValorCustoDetailViewSet
from .views import ValorCustoViewSet

app_name = "configuracoes"

urlpatterns = [
    path(
        "projetos/<uuid:projeto_pk>/configuracao-rdo/",
        ConfiguracaoRdoView.as_view(),
        name="configuracao-rdo",
    ),
    path(
        "projetos/<uuid:projeto_pk>/configuracao/",
        ConfiguracaoProjetoView.as_view(),
        name="configuracao",
    ),
    path(
        "projetos/<uuid:projeto_pk>/configuracao/disciplinas/",
        DisciplinaViewSet.as_view({"get": "list", "post": "create"}),
        name="configuracao-disciplinas",
    ),
    path(
        "projetos/<uuid:projeto_pk>/configuracao/eap/importar/",
        EapImportView.as_view(),
        name="configuracao-eap-importar",
    ),
    path(
        "configuracoes/disciplinas/<uuid:pk>/",
        DisciplinaDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-disciplina-detail",
    ),
    path(
        "configuracoes/disciplinas/<uuid:disciplina_pk>/servicos/",
        ServicoViewSet.as_view({"post": "create"}),
        name="configuracao-disciplina-servicos",
    ),
    path(
        "configuracoes/servicos/<uuid:pk>/",
        ServicoDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-servico-detail",
    ),
    path(
        "projetos/<uuid:projeto_pk>/configuracao/equipes/",
        EquipeViewSet.as_view({"get": "list", "post": "create"}),
        name="configuracao-equipes",
    ),
    path(
        "configuracoes/equipes/<uuid:pk>/",
        EquipeDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-equipe-detail",
    ),
    path(
        "configuracoes/equipes/<uuid:equipe_pk>/pessoas/",
        PessoaViewSet.as_view({"post": "create"}),
        name="configuracao-equipe-pessoas",
    ),
    path(
        "configuracoes/pessoas/<uuid:pk>/",
        PessoaDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-pessoa-detail",
    ),
    path(
        "configuracoes/equipes/<uuid:equipe_pk>/maquinas/",
        MaquinaViewSet.as_view({"post": "create"}),
        name="configuracao-equipe-maquinas",
    ),
    path(
        "configuracoes/maquinas/<uuid:pk>/",
        MaquinaDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-maquina-detail",
    ),
    path(
        "projetos/<uuid:projeto_pk>/configuracao/valores/",
        ValorCustoViewSet.as_view({"get": "list", "post": "create"}),
        name="configuracao-valores",
    ),
    path(
        "configuracoes/valores/<uuid:pk>/",
        ValorCustoDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-valor-detail",
    ),
]
