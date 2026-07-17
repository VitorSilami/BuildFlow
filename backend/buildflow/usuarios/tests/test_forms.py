"""Module for all Form Tests."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from django.utils.translation import gettext_lazy as _

from buildflow.core.tests.factories import EmpresaFactory
from buildflow.usuarios.forms import UserAdminCreationForm

if TYPE_CHECKING:
    from buildflow.usuarios.models import User


class TestUserAdminCreationForm:
    """Testes da UserAdminCreationForm (unico fluxo de criacao de conta)."""

    def test_email_ja_cadastrado_e_rejeitado(self, user: User):
        empresa = EmpresaFactory()

        form = UserAdminCreationForm(
            {
                "email": user.email,
                "nome": "Outro Nome",
                "empresa": empresa.pk,
                "perfil": "gerente",
                "password1": "My_R@ndom-P@ssw0rd",
                "password2": "My_R@ndom-P@ssw0rd",
            },
        )

        assert not form.is_valid()
        assert "email" in form.errors
        assert form.errors["email"][0] == _("This email has already been taken.")

    @pytest.mark.django_db
    def test_usuario_comum_sem_empresa_e_rejeitado(self):
        form = UserAdminCreationForm(
            {
                "email": "novo@example.com",
                "nome": "Novo",
                "perfil": "gerente",
                "password1": "My_R@ndom-P@ssw0rd",
                "password2": "My_R@ndom-P@ssw0rd",
            },
        )

        assert not form.is_valid()
        assert "__all__" in form.errors or "empresa" in form.errors

    @pytest.mark.django_db
    def test_usuario_comum_com_empresa_e_aceito(self):
        empresa = EmpresaFactory()

        form = UserAdminCreationForm(
            {
                "email": "novo2@example.com",
                "nome": "Novo",
                "empresa": empresa.pk,
                "perfil": "gerente",
                "password1": "My_R@ndom-P@ssw0rd",
                "password2": "My_R@ndom-P@ssw0rd",
            },
        )

        assert form.is_valid(), form.errors
