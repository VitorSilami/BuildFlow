from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class RncConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "buildflow.rnc"
    verbose_name = _("RNC")
