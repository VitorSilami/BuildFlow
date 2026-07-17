from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class UsuariosConfig(AppConfig):
    name = "buildflow.usuarios"
    verbose_name = _("Usuarios")

    def ready(self):
        pass
