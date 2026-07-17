from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from rest_framework.test import APIRequestFactory

from buildflow.usuarios.api.views import UserViewSet

if TYPE_CHECKING:
    from buildflow.usuarios.models import User


class TestUserViewSet:
    @pytest.fixture
    def api_rf(self) -> APIRequestFactory:
        return APIRequestFactory()

    def test_get_queryset(self, user: User, api_rf: APIRequestFactory):
        view = UserViewSet()
        request = api_rf.get("/fake-url/")
        request.user = user

        view.request = request

        assert user in view.get_queryset()

    def test_me(self, user: User, api_rf: APIRequestFactory):
        view = UserViewSet()
        request = api_rf.get("/fake-url/")
        request.user = user

        view.request = request

        response = view.me(request)  # type: ignore[misc,call-arg,arg-type]

        assert response.data == {
            "id": user.id,
            "email": user.email,
            "nome": user.nome,
            "perfil": user.perfil,
            "empresa": user.empresa_id,
            "empresa_nome": user.empresa.nome,
        }
