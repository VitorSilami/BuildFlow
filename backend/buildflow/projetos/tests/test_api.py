from decimal import Decimal
from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import MetaMensal
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import EmpresaFactory
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario

pytestmark = pytest.mark.django_db

PROJETOS_URL = "/api/v1/projetos/"


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def test_lista_apenas_projetos_da_propria_empresa():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    Projeto.objects.create(empresa=empresa, nome="Projeto A", criado_por=usuario)

    outra_empresa = EmpresaFactory()
    outro_usuario = UsuarioFactory(empresa=outra_empresa)
    Projeto.objects.create(
        empresa=outra_empresa,
        nome="Projeto B",
        criado_por=outro_usuario,
    )

    response = _authenticated_client(usuario).get(PROJETOS_URL)

    assert response.status_code == HTTPStatus.OK
    nomes = [item["nome"] for item in response.json()["results"]]
    assert nomes == ["Projeto A"]


def test_criar_projeto_atribui_empresa_e_criado_por_automaticamente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {"nome": "Duplicação BR-365", "descricao": "Lote 2"},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED
    projeto = Projeto.objects.get(nome="Duplicação BR-365")
    assert projeto.empresa_id == empresa.id
    assert projeto.criado_por_id == usuario.id


def test_criar_projeto_ignora_empresa_enviada_no_payload():
    empresa = EmpresaFactory()
    outra_empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {"nome": "Projeto Teste", "empresa": str(outra_empresa.id)},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED
    projeto = Projeto.objects.get(nome="Projeto Teste")
    assert projeto.empresa_id == empresa.id  # nunca a empresa enviada no payload


@pytest.mark.parametrize("nome", ["", "   "])
def test_criar_projeto_com_nome_vazio_ou_so_espacos_e_rejeitado(nome):
    usuario = UsuarioFactory()

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {"nome": nome},
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_anonimo_nao_acessa_projetos():
    response = APIClient().get(PROJETOS_URL)

    # DRF usa 403 (nao 401) quando o unico authenticator configurado
    # (SessionAuthentication) nao oferece challenge WWW-Authenticate.
    assert response.status_code == HTTPStatus.FORBIDDEN


def test_criar_projeto_aceita_campos_opcionais_novos():
    usuario = UsuarioFactory()

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {
            "nome": "Duplicação BR-365",
            "numero_contrato": "CTR-2026-01",
            "trecho": "BR-365 · km 10-25",
            "engenheiro_responsavel": "Eng. Carlos Mendes",
            "status": "pausado",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED
    projeto = Projeto.objects.get(nome="Duplicação BR-365")
    assert projeto.numero_contrato == "CTR-2026-01"
    assert projeto.trecho == "BR-365 · km 10-25"
    assert projeto.engenheiro_responsavel == "Eng. Carlos Mendes"
    assert projeto.status == "pausado"


def test_criar_projeto_sem_campos_novos_usa_status_ativo_por_padrao():
    usuario = UsuarioFactory()

    response = _authenticated_client(usuario).post(
        PROJETOS_URL,
        {"nome": "Projeto Simples"},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED
    projeto = Projeto.objects.get(nome="Projeto Simples")
    assert projeto.numero_contrato == ""
    assert projeto.trecho == ""
    assert projeto.engenheiro_responsavel == ""
    assert projeto.status == "ativo"


def test_lista_projetos_inclui_execucao_percentual_calculada():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Projeto Com Meta",
        criado_por=usuario,
    )
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
    )
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disciplina,
        unidade=unidade,
        valor_alvo=Decimal("1000"),
        peso_percentual=Decimal("100"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    registro = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("250"),
        unidade=unidade,
    )

    response = _authenticated_client(usuario).get(PROJETOS_URL)

    assert response.status_code == HTTPStatus.OK
    item = next(
        r for r in response.json()["results"] if r["nome"] == "Projeto Com Meta"
    )
    assert item["execucao_percentual"] == "25.00"


def test_projeto_sem_meta_retorna_execucao_percentual_null():
    usuario = UsuarioFactory()
    Projeto.objects.create(
        empresa=usuario.empresa,
        nome="Projeto Sem Meta",
        criado_por=usuario,
    )

    response = _authenticated_client(usuario).get(PROJETOS_URL)

    assert response.status_code == HTTPStatus.OK
    item = next(
        r for r in response.json()["results"] if r["nome"] == "Projeto Sem Meta"
    )
    assert item["execucao_percentual"] is None


def test_atualizar_projeto_altera_campos_editaveis():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Projeto Original",
        criado_por=usuario,
    )

    response = _authenticated_client(usuario).patch(
        f"{PROJETOS_URL}{projeto.id}/",
        {
            "nome": "Projeto Atualizado",
            "trecho": "BR-101 · km 5-20",
            "engenheiro_responsavel": "Eng. Ana Souza",
            "status": "pausado",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.OK
    projeto.refresh_from_db()
    assert projeto.nome == "Projeto Atualizado"
    assert projeto.trecho == "BR-101 · km 5-20"
    assert projeto.engenheiro_responsavel == "Eng. Ana Souza"
    assert projeto.status == "pausado"


def test_atualizar_projeto_ignora_empresa_enviada_no_payload():
    empresa = EmpresaFactory()
    outra_empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Projeto X",
        criado_por=usuario,
    )

    response = _authenticated_client(usuario).patch(
        f"{PROJETOS_URL}{projeto.id}/",
        {"empresa": str(outra_empresa.id)},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK
    projeto.refresh_from_db()
    assert projeto.empresa_id == empresa.id  # nunca a empresa enviada no payload


def test_atualizar_projeto_ignora_criado_por_enviado_no_payload():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    outro_usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Projeto Y",
        criado_por=usuario,
    )

    response = _authenticated_client(usuario).patch(
        f"{PROJETOS_URL}{projeto.id}/",
        {"criado_por": outro_usuario.id},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK
    projeto.refresh_from_db()
    assert projeto.criado_por_id == usuario.id  # nunca o criado_por enviado no payload


def test_atualizar_projeto_via_put_substitui_campos_editaveis():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Projeto Original",
        descricao="Descricao original",
        numero_contrato="CTR-0001",
        trecho="BR-101 · km 0-10",
        engenheiro_responsavel="Eng. Original",
        status="ativo",
        criado_por=usuario,
    )

    response = _authenticated_client(usuario).put(
        f"{PROJETOS_URL}{projeto.id}/",
        {
            "nome": "Projeto Renovado",
            "descricao": "",
            "numero_contrato": "",
            "trecho": "",
            "engenheiro_responsavel": "",
            "status": "concluido",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["nome"] == "Projeto Renovado"
    assert body["status"] == "concluido"
    assert body["execucao_percentual"] is None
    assert body["ultimo_rdo_data"] is None

    projeto.refresh_from_db()
    assert projeto.nome == "Projeto Renovado"
    assert projeto.descricao == ""
    assert projeto.status == "concluido"


def test_atualizar_projeto_de_outra_empresa_retorna_404():
    empresa_a = EmpresaFactory()
    usuario_a = UsuarioFactory(empresa=empresa_a)
    empresa_b = EmpresaFactory()
    usuario_b = UsuarioFactory(empresa=empresa_b)
    projeto_b = Projeto.objects.create(
        empresa=empresa_b,
        nome="Projeto B",
        criado_por=usuario_b,
    )

    response = _authenticated_client(usuario_a).patch(
        f"{PROJETOS_URL}{projeto_b.id}/",
        {"nome": "Tentativa de alteracao"},
        format="json",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    projeto_b.refresh_from_db()
    assert projeto_b.nome == "Projeto B"


def test_atualizar_projeto_com_nome_vazio_e_rejeitado():
    usuario = UsuarioFactory()
    projeto = Projeto.objects.create(
        empresa=usuario.empresa,
        nome="Projeto Valido",
        criado_por=usuario,
    )

    response = _authenticated_client(usuario).patch(
        f"{PROJETOS_URL}{projeto.id}/",
        {"nome": "   "},
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_ultimo_rdo_data_reflete_registro_mais_recente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa,
        nome="Projeto Com RDO",
        criado_por=usuario,
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-10",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )

    response = _authenticated_client(usuario).get(PROJETOS_URL)

    assert response.status_code == HTTPStatus.OK
    item = next(r for r in response.json()["results"] if r["nome"] == "Projeto Com RDO")
    assert item["ultimo_rdo_data"] == "2026-07-10"


def test_ultimo_rdo_data_e_null_sem_nenhum_rdo():
    usuario = UsuarioFactory()
    Projeto.objects.create(
        empresa=usuario.empresa,
        nome="Projeto Sem RDO",
        criado_por=usuario,
    )

    response = _authenticated_client(usuario).get(PROJETOS_URL)

    assert response.status_code == HTTPStatus.OK
    item = next(r for r in response.json()["results"] if r["nome"] == "Projeto Sem RDO")
    assert item["ultimo_rdo_data"] is None
