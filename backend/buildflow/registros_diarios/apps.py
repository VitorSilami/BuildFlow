from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class RegistrosDiariosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "buildflow.registros_diarios"
    verbose_name = _("Registros diarios")
