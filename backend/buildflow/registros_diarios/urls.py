from django.urls import path

from .views import FotoUploadView
from .views import RegistroDiarioDetailView
from .views import RegistroDiarioViewSet

app_name = "registros_diarios"

urlpatterns = [
    path(
        "projetos/<uuid:projeto_pk>/registros-diarios/",
        RegistroDiarioViewSet.as_view({"get": "list", "post": "create"}),
        name="registro-diario-list",
    ),
    path(
        "registros-diarios/<uuid:pk>/",
        RegistroDiarioDetailView.as_view({"get": "retrieve"}),
        name="registro-diario-detail",
    ),
    path(
        "registros-diarios/<uuid:registro_pk>/fotos/",
        FotoUploadView.as_view({"post": "create"}),
        name="registro-diario-foto",
    ),
]
