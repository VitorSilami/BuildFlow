from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class CustosOciosidadeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "buildflow.custos_ociosidade"
    verbose_name = _("Custos e ociosidade")
