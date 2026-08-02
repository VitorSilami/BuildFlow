from django.urls import path

from .views import MedicaoViewSet

app_name = "medicoes"

urlpatterns = [
    path(
        "projetos/<uuid:projeto_pk>/medicoes/",
        MedicaoViewSet.as_view({"get": "list", "post": "create"}),
        name="medicao-list",
    ),
    path(
        "projetos/<uuid:projeto_pk>/medicoes/<uuid:pk>/",
        MedicaoViewSet.as_view({"get": "retrieve", "delete": "destroy"}),
        name="medicao-detail",
    ),
    path(
        "projetos/<uuid:projeto_pk>/medicoes/<uuid:pk>/aprovar/",
        MedicaoViewSet.as_view({"post": "aprovar"}),
        name="medicao-aprovar",
    ),
    path(
        "projetos/<uuid:projeto_pk>/medicoes/<uuid:pk>/rejeitar/",
        MedicaoViewSet.as_view({"post": "rejeitar"}),
        name="medicao-rejeitar",
    ),
]
