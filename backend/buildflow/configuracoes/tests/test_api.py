from decimal import Decimal
from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import Maquina
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.registros_diarios.tests.factories import CatalogoServicoFactory
from buildflow.registros_diarios.tests.factories import DisciplinaFactory
from buildflow.registros_diarios.tests.factories import EquipeFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory
from buildflow.registros_diarios.tests.factories import UnidadeFactory
from buildflow.usuarios.models import PerfilChoices

pytestmark = pytest.mark.django_db

SOMA_PESOS_ESPERADA = 25.0


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


def test_configuracao_rdo_servico_nao_expoe_campos_da_eap():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    CatalogoServicoFactory(disciplina=disciplina, unidade=unidade)

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/configuracao-rdo/",
    )

    assert response.status_code == HTTPStatus.OK
    servico = response.json()["disciplinas"][0]["servicos"][0]
    assert set(servico.keys()) == {"id", "nome", "unidade"}
    assert "peso_percentual" not in servico
    assert "quantidade_executada" not in servico
    assert "producoes_vinculadas" not in servico


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


def test_criar_disciplina_com_peso_percentual():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/disciplinas/",
        {"nome": "Terraplenagem", "peso_percentual": "25.00"},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert response.json()["peso_percentual"] == "25.00"
    assert response.json()["avanco_percentual"] is None


def test_patch_disciplina_atualiza_peso_percentual():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/disciplinas/{disciplina.id}/",
        {"peso_percentual": "40.00"},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["peso_percentual"] == "40.00"


def test_criar_servico_no_catalogo_da_disciplina():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/configuracoes/disciplinas/{disciplina.id}/servicos/",
        {
            "nome": "Corte",
            "unidade": unidade.id,
            "peso_percentual": "100.00",
            "quantidade_planejada": "1000.000",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    body = response.json()
    assert body["nome"] == "Corte"
    assert body["peso_percentual"] == "100.00"
    assert body["quantidade_planejada"] == "1000.000"
    assert body["quantidade_executada_manual"] == "0.000"
    assert body["quantidade_executada"] == "0.000"
    assert body["producoes_vinculadas"] == []
    assert body["avanco_percentual"] == "0.00"


def test_patch_servico_atualiza_peso_quantidade_e_recalcula_avanco():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=UnidadeFactory())
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/servicos/{servico.id}/",
        {"quantidade_planejada": "1000.000", "quantidade_executada_manual": "250.000"},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["avanco_percentual"] == "25.00"
    assert response.json()["quantidade_executada"] == "250.000"


def test_configuracao_projeto_retorna_soma_pesos_disciplinas_e_avanco():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    client = _authenticated_client(usuario)

    client.patch(
        f"/api/v1/configuracoes/disciplinas/{disciplina.id}/",
        {"peso_percentual": "25.00"},
        format="json",
    )
    servico_response = client.post(
        f"/api/v1/configuracoes/disciplinas/{disciplina.id}/servicos/",
        {
            "nome": "Corte",
            "unidade": unidade.id,
            "peso_percentual": "100.00",
            "quantidade_planejada": "1000.000",
            "quantidade_executada_manual": "1000.000",
        },
        format="json",
    )
    assert servico_response.status_code == HTTPStatus.CREATED, servico_response.data

    configuracao = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")
    body = configuracao.json()

    assert float(body["soma_pesos_disciplinas"]) == SOMA_PESOS_ESPERADA
    assert "metas" not in body
    assert body["disciplinas"][0]["avanco_percentual"] == "100.00"


def test_auxiliar_administrativo_recebe_403_ao_criar_disciplina():
    usuario = UsuarioFactory(perfil=PerfilChoices.AUXILIAR_ADMINISTRATIVO)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/disciplinas/",
        {"nome": "Terraplenagem"},
        format="json",
    )

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_auxiliar_administrativo_recebe_403_ao_criar_servico():
    usuario = UsuarioFactory(perfil=PerfilChoices.AUXILIAR_ADMINISTRATIVO)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/configuracoes/disciplinas/{disciplina.id}/servicos/",
        {"nome": "Corte", "unidade": unidade.id},
        format="json",
    )

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_auxiliar_administrativo_ainda_consegue_ler_configuracao():
    usuario = UsuarioFactory(perfil=PerfilChoices.AUXILIAR_ADMINISTRATIVO)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")

    assert response.status_code == HTTPStatus.OK


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


def test_patch_servico_ignora_quantidade_executada_bruta_por_ser_somente_leitura():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(
        disciplina=disciplina,
        unidade=UnidadeFactory(),
        quantidade_planejada="1000.000",
    )
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/servicos/{servico.id}/",
        {"quantidade_executada": "999.000"},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    servico.refresh_from_db()
    assert str(servico.quantidade_executada_manual) == "0.000"
    assert response.json()["quantidade_executada"] == "0.000"


def test_servico_expoe_producoes_vinculadas_ordenadas_por_data_recente():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=unidade)
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    registro_antigo = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    registro_recente = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-10",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_antigo,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("100.000"),
        unidade=unidade,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_recente,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("1.000"),
        km_final=Decimal("2.000"),
        quantidade=Decimal("150.000"),
        unidade=unidade,
    )
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")

    servico_body = response.json()["disciplinas"][0]["servicos"][0]
    assert servico_body["quantidade_executada"] == "250.000"
    assert servico_body["producoes_vinculadas"] == [
        {"data_referencia": "2026-07-10", "quantidade": "150.000"},
        {"data_referencia": "2026-07-01", "quantidade": "100.000"},
    ]
