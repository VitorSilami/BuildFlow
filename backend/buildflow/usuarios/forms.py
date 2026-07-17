from django.contrib.auth import forms as admin_forms
from django.core.exceptions import ValidationError
from django.forms import EmailField
from django.utils.translation import gettext_lazy as _

from .models import User


def _validate_empresa_obrigatoria(cleaned_data):
    is_superuser = cleaned_data.get("is_superuser")
    empresa = cleaned_data.get("empresa")
    if not is_superuser and not empresa:
        msg = _(
            "Usuarios comuns (nao-superusuario) devem estar vinculados a uma empresa.",
        )
        raise ValidationError(msg)
    return cleaned_data


class UserAdminChangeForm(admin_forms.UserChangeForm):
    class Meta(admin_forms.UserChangeForm.Meta):
        model = User
        field_classes = {"email": EmailField}

    def clean(self):
        return _validate_empresa_obrigatoria(super().clean())


class UserAdminCreationForm(admin_forms.AdminUserCreationForm):
    """Form de criacao de usuario no Django Admin.

    Unico fluxo de criacao de conta do sistema — nao ha cadastro publico
    (Principio II da constituicao).
    """

    class Meta(admin_forms.UserCreationForm.Meta):
        model = User
        fields = ("email", "nome", "empresa", "perfil")
        field_classes = {"email": EmailField}
        error_messages = {
            "email": {"unique": _("This email has already been taken.")},
        }

    def clean(self):
        return _validate_empresa_obrigatoria(super().clean())
