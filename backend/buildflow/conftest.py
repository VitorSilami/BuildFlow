from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from buildflow.core.tests.factories import UsuarioFactory

if TYPE_CHECKING:
    from buildflow.usuarios.models import User


@pytest.fixture(autouse=True)
def _media_storage(settings, tmpdir) -> None:
    settings.MEDIA_ROOT = tmpdir.strpath


@pytest.fixture
def user(db) -> User:
    return UsuarioFactory.create()
