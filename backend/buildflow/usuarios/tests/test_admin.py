from http import HTTPStatus

import pytest
from django.urls import reverse

from buildflow.core.tests.factories import EmpresaFactory
from buildflow.usuarios.models import User


class TestUserAdmin:
    def test_changelist(self, admin_client):
        url = reverse("admin:usuarios_user_changelist")
        response = admin_client.get(url)
        assert response.status_code == HTTPStatus.OK

    def test_search(self, admin_client):
        url = reverse("admin:usuarios_user_changelist")
        response = admin_client.get(url, data={"q": "admin"})
        assert response.status_code == HTTPStatus.OK

    @pytest.mark.django_db
    def test_add_usuario_comum_exige_empresa_e_perfil(self, admin_client):
        empresa = EmpresaFactory()
        url = reverse("admin:usuarios_user_add")

        response = admin_client.post(
            url,
            data={
                "email": "new-user@example.com",
                "nome": "Novo Usuario",
                "empresa": empresa.pk,
                "perfil": "gerente",
                "password1": "My_R@ndom-P@ssw0rd",
                "password2": "My_R@ndom-P@ssw0rd",
            },
        )
        assert response.status_code == HTTPStatus.FOUND
        assert User.objects.filter(email="new-user@example.com").exists()

    @pytest.mark.django_db
    def test_add_usuario_comum_sem_empresa_e_rejeitado(self, admin_client):
        url = reverse("admin:usuarios_user_add")

        response = admin_client.post(
            url,
            data={
                "email": "sem-empresa@example.com",
                "nome": "Sem Empresa",
                "perfil": "gerente",
                "password1": "My_R@ndom-P@ssw0rd",
                "password2": "My_R@ndom-P@ssw0rd",
            },
        )
        assert response.status_code == HTTPStatus.OK  # form re-renderizado com erro
        assert not User.objects.filter(email="sem-empresa@example.com").exists()

    def test_view_user(self, admin_client):
        user = User.objects.get(email="admin@example.com")
        url = reverse("admin:usuarios_user_change", kwargs={"object_id": user.pk})
        response = admin_client.get(url)
        assert response.status_code == HTTPStatus.OK
