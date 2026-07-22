from django.urls import path

from buildflow.rnc.views import AcaoCorretivaViewSet
from buildflow.rnc.views import RncDetailViewSet
from buildflow.rnc.views import RncViewSet

app_name = "rnc"

urlpatterns = [
    path(
        "projetos/<uuid:projeto_pk>/rncs/",
        RncViewSet.as_view({"get": "list", "post": "create"}),
        name="rnc-list",
    ),
    path(
        "rncs/<uuid:pk>/",
        RncDetailViewSet.as_view({"get": "retrieve", "patch": "partial_update"}),
        name="rnc-detail",
    ),
    path(
        "rncs/<uuid:pk>/concluir/",
        RncDetailViewSet.as_view({"post": "concluir"}),
        name="rnc-concluir",
    ),
    path(
        "rncs/<uuid:rnc_pk>/acoes-corretivas/",
        AcaoCorretivaViewSet.as_view({"post": "create"}),
        name="rnc-acao-corretiva",
    ),
]
