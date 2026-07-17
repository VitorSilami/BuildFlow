from __future__ import annotations

from typing import TYPE_CHECKING

from django.urls import resolve
from django.urls import reverse

if TYPE_CHECKING:
    from buildflow.usuarios.models import User


def test_user_detail(user: User):
    expected_url = f"/api/v1/users/{user.pk}/"
    assert reverse("api:user-detail", kwargs={"pk": user.pk}) == expected_url
    assert resolve(expected_url).view_name == "api:user-detail"


def test_user_list():
    assert reverse("api:user-list") == "/api/v1/users/"
    assert resolve("/api/v1/users/").view_name == "api:user-list"


def test_user_me():
    assert reverse("api:user-me") == "/api/v1/users/me/"
    assert resolve("/api/v1/users/me/").view_name == "api:user-me"
