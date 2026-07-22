from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import Maquina
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios.tests.factories import CatalogoServicoFactory
from buildflow.registros_diarios.tests.factories import DisciplinaFactory
from buildflow.registros_diarios.tests.factories import EquipeFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory
from buildflow.registros_diarios.tests.factories import UnidadeFactory

pytestmark = pytest.mark.django_db

PESO_ESPERADO = 25.0


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def test_configuracao_rdo_retorna_disciplinas_equipes_e_unidades_do_projeto():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    CatalogoServicoFactory(disciplina=disciplina, unidade=unidade)
    EquipeFactory(projeto=projeto)

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/configuracao-rdo/",
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert len(body["disciplinas"]) == 1
    assert len(body["disciplinas"][0]["servicos"]) == 1
    assert len(body["equipes"]) == 1
    assert len(body["unidades"]) >= 1
    assert usuario.email in [f["email"] for f in body["fiscais"]]


def test_configuracao_rdo_de_outra_empresa_retorna_404():
    usuario_a = UsuarioFactory()
    projeto_a = ProjetoParaRdoFactory(criado_por=usuario_a)
    usuario_b = UsuarioFactory()

    response = _authenticated_client(usuario_b).get(
        f"/api/v1/projetos/{projeto_a.id}/configuracao-rdo/",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_criar_equipe_com_pessoa_e_maquina():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)

    equipe_response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/equipes/",
        {"nome": "Equipe Terraplenagem"},
        format="json",
    )
    assert equipe_response.status_code == HTTPStatus.CREATED, equipe_response.data
    equipe_id = equipe_response.json()["id"]

    pessoa_response = client.post(
        f"/api/v1/configuracoes/equipes/{equipe_id}/pessoas/",
        {"nome": "João", "funcao": "Ajudante"},
        format="json",
    )
    assert pessoa_response.status_code == HTTPStatus.CREATED, pessoa_response.data

    maquina_response = client.post(
        f"/api/v1/configuracoes/equipes/{equipe_id}/maquinas/",
        {"codigo": "ESC-01", "nome": "Escavadeira"},
        format="json",
    )
    assert maquina_response.status_code == HTTPStatus.CREATED, maquina_response.data

    configuracao = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")
    equipes = configuracao.json()["equipes"]
    assert len(equipes) == 1
    assert len(equipes[0]["pessoas"]) == 1
    assert len(equipes[0]["maquinas"]) == 1


def test_criar_meta_e_valor_de_custo():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    client = _authenticated_client(usuario)

    meta_response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/metas/",
        {
            "disciplina": str(disciplina.id),
            "unidade": unidade.id,
            "valor_alvo": "1000.000",
            "peso_percentual": "25.00",
        },
        format="json",
    )
    assert meta_response.status_code == HTTPStatus.CREATED, meta_response.data

    valor_response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/valores/",
        {"tipo": "mao_de_obra", "descricao": "Ajudante", "valor": "2500.00"},
        format="json",
    )
    assert valor_response.status_code == HTTPStatus.CREATED, valor_response.data

    configuracao = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")
    body = configuracao.json()
    assert len(body["metas"]) == 1
    assert len(body["valores_custo"]) == 1
    assert float(body["soma_pesos_metas"]) == PESO_ESPERADO


def test_editar_meta_existente():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    client = _authenticated_client(usuario)

    meta_response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/metas/",
        {
            "disciplina": str(disciplina.id),
            "unidade": unidade.id,
            "valor_alvo": "1000.000",
        },
        format="json",
    )
    meta_id = meta_response.json()["id"]

    edit_response = client.patch(
        f"/api/v1/configuracoes/metas/{meta_id}/",
        {"valor_alvo": "1500.000"},
        format="json",
    )

    assert edit_response.status_code == HTTPStatus.OK
    assert edit_response.json()["valor_alvo"] == "1500.000"


def test_ignora_projeto_enviado_no_payload_de_equipe():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    outro_projeto = ProjetoParaRdoFactory(
        criado_por=UsuarioFactory(empresa=usuario.empresa),
    )
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/equipes/",
        {"nome": "Equipe X", "projeto": str(outro_projeto.id)},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED
    equipe = Equipe.objects.get(nome="Equipe X")
    assert equipe.projeto_id == projeto.id  # nunca o "outro_projeto" do payload


def test_valor_custo_mao_de_obra_com_funcao_e_criado_com_sucesso():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/valores/",
        {
            "tipo": "mao_de_obra",
            "descricao": "Ajudante",
            "valor": "250.00",
            "funcao": "Ajudante",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert response.json()["funcao"] == "Ajudante"
    assert response.json()["maquina"] is None


def test_valor_custo_equipamento_com_maquina_e_criado_com_sucesso():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    maquina = Maquina.objects.create(equipe=equipe, codigo="ESC-01", nome="Escavadeira")
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/valores/",
        {
            "tipo": "equipamento",
            "descricao": "Escavadeira 320D",
            "valor": "180.00",
            "maquina": str(maquina.id),
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert response.json()["maquina"] == str(maquina.id)
    assert response.json()["funcao"] == ""


def test_valor_custo_mao_de_obra_com_maquina_e_rejeitado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    maquina = Maquina.objects.create(equipe=equipe, codigo="ESC-01", nome="Escavadeira")
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/valores/",
        {
            "tipo": "mao_de_obra",
            "descricao": "Ajudante",
            "valor": "250.00",
            "maquina": str(maquina.id),
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_valor_custo_equipamento_com_funcao_e_rejeitado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/valores/",
        {
            "tipo": "equipamento",
            "descricao": "Escavadeira 320D",
            "valor": "180.00",
            "funcao": "Ajudante",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
