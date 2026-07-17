from http import HTTPStatus

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios.models import RegistroDiario

from .factories import CatalogoServicoFactory
from .factories import DisciplinaFactory
from .factories import EquipeFactory
from .factories import ProjetoParaRdoFactory
from .factories import UnidadeFactory

pytestmark = pytest.mark.django_db


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def _uma_imagem_fake() -> SimpleUploadedFile:
    # PNG 1x1 minimo valido.
    conteudo = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return SimpleUploadedFile("foto.png", conteudo, content_type="image/png")


@pytest.fixture
def registro():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=unidade)
    fiscal = UsuarioFactory(empresa=usuario.empresa)

    payload = {
        "data_referencia": "2026-07-17",
        "turno": "diurno",
        "clima": "sol",
        "equipe": str(equipe.id),
        "fiscal": fiscal.id,
        "producoes": [
            {
                "rodovia": "BR-365",
                "sentido": "crescente",
                "disciplina": str(disciplina.id),
                "servico": str(servico.id),
                "km_inicial": "10.000",
                "km_final": "10.500",
                "quantidade": "500.000",
                "unidade": unidade.id,
            },
        ],
        "presencas": [],
        "maquinas": [],
        "ocorrencias": [],
    }
    url = f"/api/v1/projetos/{projeto.id}/registros-diarios/"
    response = _authenticated_client(usuario).post(url, payload, format="json")
    registro_id = response.json()["id"]
    return {"usuario": usuario, "registro_id": registro_id}


def test_upload_de_foto_com_km(registro, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    url = f"/api/v1/registros-diarios/{registro['registro_id']}/fotos/"
    response = _authenticated_client(registro["usuario"]).post(
        url,
        {"arquivo": _uma_imagem_fake(), "km": "10.250"},
        format="multipart",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    rdo = RegistroDiario.objects.get(pk=registro["registro_id"])
    assert rdo.fotos.count() == 1
    assert str(rdo.fotos.first().km) == "10.250"
