from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class ConfiguracoesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "buildflow.configuracoes"
    verbose_name = _("Configuracoes")
