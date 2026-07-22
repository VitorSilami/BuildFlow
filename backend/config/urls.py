from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include
from django.urls import path
from django.views import defaults as default_views
from drf_spectacular.views import SpectacularAPIView
from drf_spectacular.views import SpectacularSwaggerView

# UI é 100% React/SPA (frontend/) consumindo esta API — sem paginas/templates
# server-rendered aqui. Autenticacao via sessao (allauth headless + Google),
# nunca via DRF auth-token (Principio III: cookie HttpOnly, nao token exposto
# ao JS). As rotas server-rendered do allauth/users padrao do
# cookiecutter-django foram removidas.
urlpatterns = [
    # Django Admin, use {% url 'admin:index' %}
    path(settings.ADMIN_URL, admin.site.urls),
    # Media files
    *static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT),
]

# API URLS
urlpatterns += [
    # API base url (versionado, Principio VI)
    path("api/v1/", include("config.api_router")),
    # Rotas aninhadas (registros diarios sob projeto) - fora do router flat
    path("api/v1/", include("buildflow.registros_diarios.urls")),
    path("api/v1/", include("buildflow.configuracoes.urls")),
    path("api/v1/", include("buildflow.custos_ociosidade.urls")),
    path("api/v1/", include("buildflow.rnc.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="api-schema"),
        name="api-docs",
    ),
    # Autenticacao (login Google, sessao, logout) via django-allauth headless.
    # Namespace proprio da lib para nao colidir com /api/v1/ (ver research.md).
    path("_allauth/", include("allauth.headless.urls")),
]

if settings.DEBUG:
    # This allows the error pages to be debugged during development, just visit
    # these url in browser to see how these error pages look like.
    urlpatterns += [
        path(
            "400/",
            default_views.bad_request,
            kwargs={"exception": Exception("Bad Request!")},
        ),
        path(
            "403/",
            default_views.permission_denied,
            kwargs={"exception": Exception("Permission Denied")},
        ),
        path(
            "404/",
            default_views.page_not_found,
            kwargs={"exception": Exception("Page not Found")},
        ),
        path("500/", default_views.server_error),
    ]
    if "debug_toolbar" in settings.INSTALLED_APPS:
        import debug_toolbar

        urlpatterns = [
            path("__debug__/", include(debug_toolbar.urls)),
            *urlpatterns,
        ]
