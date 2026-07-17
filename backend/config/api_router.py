from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from buildflow.projetos.views import ProjetoViewSet
from buildflow.usuarios.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("users", UserViewSet)
router.register("projetos", ProjetoViewSet, basename="projeto")


app_name = "api"
urlpatterns = router.urls
