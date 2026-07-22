from django.urls import path

from .views import CustosOciosidadeView

app_name = "custos_ociosidade"

urlpatterns = [
    path(
        "projetos/<uuid:projeto_pk>/custos-ociosidade/",
        CustosOciosidadeView.as_view(),
        name="custos-ociosidade",
    ),
]
