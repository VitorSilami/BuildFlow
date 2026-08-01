# Importação de EAP via CSV/XLSX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Gerente importar uma planilha CSV/XLSX pela UI para popular a EAP de um projeto vazio, sem depender do comando de management `seed_legacy_data.py`.

**Architecture:** Nova função de serviço pura (`configuracoes/eap_import.py`) faz parsing (CSV/XLSX) → localização de cabeçalho → validação linha a linha → criação atômica de `Disciplina`/`CatalogoServico`. Uma `APIView` multipart (`EapImportView`) expõe isso em `/api/v1/projetos/{projeto_pk}/configuracao/eap/importar/`. No frontend, um botão na aba EAP (visível quando ela está vazia) dispara o upload e mostra a lista de erros retornada pela API quando o import falha.

**Tech Stack:** Django REST Framework (`MultiPartParser`), `openpyxl` (já é dependência), `csv` da stdlib, React + TanStack Query, Playwright.

## Global Constraints

- Import só é permitido quando o projeto não tem nenhuma disciplina raiz (`pai__isnull=True`) — senão rejeita com 400 `{"detail": "..."}`.
- Formatos aceitos: `.csv` e `.xlsx`. Qualquer outra extensão é rejeitada com 400 `{"detail": "..."}`.
- Cabeçalho é localizado por conteúdo (não posição fixa): varre até as 20 primeiras linhas procurando a primeira que contenha `DISCIPLINA` e `ATIVIDADE` entre suas células (case-insensitive, trimmed). Essa linha vira o cabeçalho.
- Colunas obrigatórias no cabeçalho encontrado: `DISCIPLINA`, `ATIVIDADE`, `UN` ou `UNIDADE`, `TOTAL` ou `QUANTIDADE`. `CHAVE` e `EAP`, se presentes, são ignoradas. Falta de qualquer coluna obrigatória → 400 `{"detail": "..."}`.
- CSV é decodificado como `utf-8-sig` primeiro; se falhar, `cp1252`.
- Validação é tudo-ou-nada: todas as linhas são checadas antes de qualquer escrita; se houver qualquer erro, nada é criado e a resposta é 400 `{"erros": ["Linha N: ...", ...]}` com `N` = número da linha no arquivo original (1-indexado).
- Linhas totalmente em branco são ignoradas silenciosamente (não geram erro nem contam).
- `DISCIPLINA` e `ATIVIDADE` são comparadas (agrupamento e checagem de duplicata) após `strip()` e case-insensitive; o nome persistido é o da primeira ocorrência (com `strip()`, capitalização original).
- `peso_percentual` sempre fica `None` na importação (não existe no arquivo de origem).
- `Unidade` é resolvida via `get_or_create(sigla=...)` (tabela global, mesmo comportamento do `seed_legacy_data.py`).
- Permissão do endpoint: `IsAuthenticatedWithEmpresa` + `IsGerente` (mesma exigida para criar disciplina).
- Sucesso retorna 201 `{"disciplinas_criadas": N, "servicos_criados": M}`.
- Export está fora de escopo desta rodada.

---

## Task 1: Motor de importação (parsing, validação, criação)

**Files:**
- Create: `backend/buildflow/configuracoes/eap_import.py`
- Test: `backend/buildflow/configuracoes/tests/test_eap_import.py`

**Interfaces:**
- Consumes: `buildflow.configuracoes.models.{Disciplina, CatalogoServico, Unidade}` (já existem); `buildflow.registros_diarios.tests.factories.ProjetoParaRdoFactory` e `.DisciplinaFactory` (já existem, usados só nos testes).
- Produces (usado pela Task 2):
  - `class ArquivoInvalido(Exception)` com atributo `.mensagem: str`
  - `class LinhasInvalidas(Exception)` com atributo `.erros: list[str]`
  - `@dataclass class ResultadoImportacaoEap` com campos `disciplinas_criadas: int`, `servicos_criados: int`
  - `def importar_eap_de_arquivo(projeto: Projeto, arquivo) -> ResultadoImportacaoEap` — `arquivo` é um `UploadedFile` do Django (tem `.name` e `.read()`)

- [ ] **Step 1: Escrever os testes (vão falhar — o módulo ainda não existe)**

Criar `backend/buildflow/configuracoes/tests/test_eap_import.py`:

```python
import io
from decimal import Decimal
from http import HTTPStatus

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook

from buildflow.configuracoes.eap_import import ArquivoInvalido
from buildflow.configuracoes.eap_import import LinhasInvalidas
from buildflow.configuracoes.eap_import import importar_eap_de_arquivo
from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.registros_diarios.tests.factories import DisciplinaFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory

pytestmark = pytest.mark.django_db


def _csv_upload(nome: str, conteudo: str, encoding: str = "utf-8") -> SimpleUploadedFile:
    return SimpleUploadedFile(nome, conteudo.encode(encoding), content_type="text/csv")


def _xlsx_upload(nome: str, linhas: list[list]) -> SimpleUploadedFile:
    workbook = Workbook()
    sheet = workbook.active
    for linha in linhas:
        sheet.append(linha)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile(
        nome,
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def test_csv_com_cabecalho_na_primeira_linha_importa_corretamente():
    projeto = ProjetoParaRdoFactory()
    csv_texto = (
        "DISCIPLINA,ATIVIDADE,UN,TOTAL\n"
        "Terraplenagem,Corte,m3,1500\n"
        "Terraplenagem,Aterro,m3,800\n"
    )
    arquivo = _csv_upload("import.csv", csv_texto)

    resultado = importar_eap_de_arquivo(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 2
    disciplina = Disciplina.objects.get(projeto=projeto, nome="Terraplenagem")
    assert disciplina.pai is None
    assert set(disciplina.servicos.values_list("nome", flat=True)) == {"Corte", "Aterro"}
    corte = disciplina.servicos.get(nome="Corte")
    assert corte.quantidade_planejada == Decimal("1500")
    assert corte.peso_percentual is None
    assert corte.unidade.sigla == "m3"


def test_csv_com_linhas_de_titulo_antes_do_cabecalho_e_importado():
    projeto = ProjetoParaRdoFactory()
    csv_texto = (
        "MODELO IMPORT SOFT\n"
        "Lote 2 - Patrocinio\n"
        "\n"
        "CHAVE,EAP,DISCIPLINA,ATIVIDADE,UN,TOTAL\n"
        "1,1,Terraplenagem,Corte,m3,1500\n"
        "2,2,Terraplenagem,Aterro,m3,800\n"
    )
    arquivo = _csv_upload("legado.csv", csv_texto)

    resultado = importar_eap_de_arquivo(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 2


def test_xlsx_com_mesmo_conteudo_produz_mesmo_resultado():
    projeto = ProjetoParaRdoFactory()
    arquivo = _xlsx_upload(
        "import.xlsx",
        [
            ["DISCIPLINA", "ATIVIDADE", "UN", "TOTAL"],
            ["Terraplenagem", "Corte", "m3", 1500],
            ["Terraplenagem", "Aterro", "m3", 800],
        ],
    )

    resultado = importar_eap_de_arquivo(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 2


def test_csv_em_cp1252_com_acentuacao_decodifica_corretamente():
    projeto = ProjetoParaRdoFactory()
    csv_texto = (
        "DISCIPLINA,ATIVIDADE,UN,TOTAL\n"
        "Terraplenagem,Preparação de subleito,m3,500\n"
    )
    arquivo = _csv_upload("import.csv", csv_texto, encoding="cp1252")

    resultado = importar_eap_de_arquivo(projeto, arquivo)

    assert resultado.servicos_criados == 1
    servico = CatalogoServico.objects.get(disciplina__projeto=projeto)
    assert servico.nome == "Preparação de subleito"


def test_linha_com_disciplina_em_branco_gera_erro_e_nao_cria_nada():
    projeto = ProjetoParaRdoFactory()
    csv_texto = (
        "DISCIPLINA,ATIVIDADE,UN,TOTAL\n"
        "Terraplenagem,Corte,m3,1500\n"
        ",Aterro,m3,800\n"
    )
    arquivo = _csv_upload("import.csv", csv_texto)

    with pytest.raises(LinhasInvalidas) as exc_info:
        importar_eap_de_arquivo(projeto, arquivo)

    assert exc_info.value.erros == ["Linha 3: DISCIPLINA em branco."]
    assert not Disciplina.objects.filter(projeto=projeto).exists()


def test_linha_com_total_nao_numerico_gera_erro_e_nao_cria_nada():
    projeto = ProjetoParaRdoFactory()
    csv_texto = "DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,abc\n"
    arquivo = _csv_upload("import.csv", csv_texto)

    with pytest.raises(LinhasInvalidas) as exc_info:
        importar_eap_de_arquivo(projeto, arquivo)

    assert exc_info.value.erros == ["Linha 2: TOTAL/QUANTIDADE inválido."]
    assert not Disciplina.objects.filter(projeto=projeto).exists()


def test_atividade_duplicada_na_mesma_disciplina_gera_erro():
    projeto = ProjetoParaRdoFactory()
    csv_texto = (
        "DISCIPLINA,ATIVIDADE,UN,TOTAL\n"
        "Terraplenagem,Corte,m3,1500\n"
        "Terraplenagem,Corte,m3,200\n"
    )
    arquivo = _csv_upload("import.csv", csv_texto)

    with pytest.raises(LinhasInvalidas) as exc_info:
        importar_eap_de_arquivo(projeto, arquivo)

    assert exc_info.value.erros == ["Linha 3: ATIVIDADE duplicada para esta DISCIPLINA."]


def test_multiplas_linhas_com_mesma_disciplina_agrupam_em_uma_disciplina():
    projeto = ProjetoParaRdoFactory()
    csv_texto = (
        "DISCIPLINA,ATIVIDADE,UN,TOTAL\n"
        "Terraplenagem,Corte,m3,1500\n"
        "Terraplenagem,Aterro,m3,800\n"
        "Drenagem,Escavação de vala,m,200\n"
    )
    arquivo = _csv_upload("import.csv", csv_texto)

    resultado = importar_eap_de_arquivo(projeto, arquivo)

    assert resultado.disciplinas_criadas == 2
    assert resultado.servicos_criados == 3
    terraplenagem = Disciplina.objects.get(projeto=projeto, nome="Terraplenagem")
    assert terraplenagem.servicos.count() == 2


def test_projeto_com_eap_nao_vazia_rejeita_import():
    projeto = ProjetoParaRdoFactory()
    DisciplinaFactory(projeto=projeto)
    arquivo = _csv_upload("import.csv", "DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,1500\n")

    with pytest.raises(ArquivoInvalido) as exc_info:
        importar_eap_de_arquivo(projeto, arquivo)

    assert "já possui uma EAP" in exc_info.value.mensagem


def test_extensao_nao_suportada_e_rejeitada():
    projeto = ProjetoParaRdoFactory()
    arquivo = SimpleUploadedFile("import.txt", b"conteudo", content_type="text/plain")

    with pytest.raises(ArquivoInvalido) as exc_info:
        importar_eap_de_arquivo(projeto, arquivo)

    assert "não suportado" in exc_info.value.mensagem


def test_cabecalho_nao_encontrado_e_rejeitado():
    projeto = ProjetoParaRdoFactory()
    arquivo = _csv_upload("import.csv", "col1,col2\nvalor1,valor2\n")

    with pytest.raises(ArquivoInvalido) as exc_info:
        importar_eap_de_arquivo(projeto, arquivo)

    assert "Cabeçalho não encontrado" in exc_info.value.mensagem
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_eap_import.py -v`
Expected: FAIL em todos com `ModuleNotFoundError: No module named 'buildflow.configuracoes.eap_import'`

- [ ] **Step 3: Implementar `eap_import.py`**

Criar `backend/buildflow/configuracoes/eap_import.py`:

```python
from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from decimal import Decimal
from decimal import InvalidOperation
from zipfile import BadZipFile

import openpyxl
from django.db import transaction
from django.utils.translation import gettext_lazy as _
from openpyxl.utils.exceptions import InvalidFileException

from .models import CatalogoServico
from .models import Disciplina
from .models import Unidade

LINHAS_MAX_BUSCA_CABECALHO = 20
COLUNAS_OBRIGATORIAS = {
    "disciplina": {"DISCIPLINA"},
    "atividade": {"ATIVIDADE"},
    "unidade": {"UN", "UNIDADE"},
    "quantidade": {"TOTAL", "QUANTIDADE"},
}


class ArquivoInvalido(Exception):
    """Erro de pré-condição, formato ou cabeçalho — mensagem única."""

    def __init__(self, mensagem: str) -> None:
        self.mensagem = mensagem
        super().__init__(mensagem)


class LinhasInvalidas(Exception):
    """Erros de validação linha a linha — uma mensagem por linha."""

    def __init__(self, erros: list[str]) -> None:
        self.erros = erros
        super().__init__("; ".join(erros))


@dataclass
class ResultadoImportacaoEap:
    disciplinas_criadas: int
    servicos_criados: int


def importar_eap_de_arquivo(projeto, arquivo) -> ResultadoImportacaoEap:
    if projeto.disciplinas.filter(pai__isnull=True).exists():
        msg = str(
            _(
                "Este projeto já possui uma EAP. Import só é permitido em "
                "projetos sem disciplinas cadastradas.",
            ),
        )
        raise ArquivoInvalido(msg)

    linhas_brutas = _ler_linhas_brutas(arquivo)
    indice_cabecalho, colunas = _localizar_cabecalho(linhas_brutas)
    linhas_validas, erros = _validar_linhas(linhas_brutas, indice_cabecalho, colunas)
    if erros:
        raise LinhasInvalidas(erros)

    return _criar_disciplinas_e_servicos(projeto, linhas_validas)


def _ler_linhas_brutas(arquivo) -> list[list[str]]:
    nome = (arquivo.name or "").lower()
    if nome.endswith(".xlsx"):
        return _ler_linhas_xlsx(arquivo)
    if nome.endswith(".csv"):
        return _ler_linhas_csv(arquivo)
    msg = str(_("Formato não suportado. Envie um arquivo .csv ou .xlsx."))
    raise ArquivoInvalido(msg)


def _ler_linhas_xlsx(arquivo) -> list[list[str]]:
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(arquivo.read()), data_only=True)
    except (BadZipFile, InvalidFileException) as exc:
        msg = str(_("Não foi possível ler o arquivo .xlsx."))
        raise ArquivoInvalido(msg) from exc

    planilha = workbook.active
    return [
        ["" if valor is None else str(valor).strip() for valor in row]
        for row in planilha.iter_rows(values_only=True)
    ]


def _ler_linhas_csv(arquivo) -> list[list[str]]:
    dados = arquivo.read()
    try:
        texto = dados.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = dados.decode("cp1252")

    leitor = csv.reader(io.StringIO(texto))
    return [[celula.strip() for celula in linha] for linha in leitor]


def _localizar_cabecalho(linhas: list[list[str]]) -> tuple[int, dict[str, int]]:
    limite = min(len(linhas), LINHAS_MAX_BUSCA_CABECALHO)
    for indice in range(limite):
        celulas_normalizadas = [celula.strip().upper() for celula in linhas[indice]]
        if "DISCIPLINA" in celulas_normalizadas and "ATIVIDADE" in celulas_normalizadas:
            colunas = _resolver_colunas(celulas_normalizadas)
            if colunas is not None:
                return indice, colunas
            break

    msg = str(
        _(
            "Cabeçalho não encontrado ou incompleto. Colunas obrigatórias: "
            "DISCIPLINA, ATIVIDADE, UN/UNIDADE, TOTAL/QUANTIDADE.",
        ),
    )
    raise ArquivoInvalido(msg)


def _resolver_colunas(celulas_normalizadas: list[str]) -> dict[str, int] | None:
    colunas: dict[str, int] = {}
    for campo, nomes_aceitos in COLUNAS_OBRIGATORIAS.items():
        indice = next(
            (i for i, celula in enumerate(celulas_normalizadas) if celula in nomes_aceitos),
            None,
        )
        if indice is None:
            return None
        colunas[campo] = indice
    return colunas


def _celula(linha: list[str], indice: int) -> str:
    return linha[indice].strip() if indice < len(linha) else ""


def _parse_quantidade(valor: str) -> Decimal | None:
    if not valor:
        return None
    try:
        return Decimal(valor.replace(",", "."))
    except InvalidOperation:
        return None


def _validar_linhas(
    linhas: list[list[str]],
    indice_cabecalho: int,
    colunas: dict[str, int],
) -> tuple[list[dict], list[str]]:
    linhas_validas: list[dict] = []
    erros: list[str] = []
    combinacoes_vistas: set[tuple[str, str]] = set()

    for offset, linha in enumerate(linhas[indice_cabecalho + 1 :], start=1):
        numero_linha = indice_cabecalho + offset + 1
        if not any(celula.strip() for celula in linha):
            continue

        disciplina = _celula(linha, colunas["disciplina"])
        atividade = _celula(linha, colunas["atividade"])
        unidade = _celula(linha, colunas["unidade"])
        quantidade_bruta = _celula(linha, colunas["quantidade"])

        if not disciplina:
            erros.append(f"Linha {numero_linha}: DISCIPLINA em branco.")
            continue
        if not atividade:
            erros.append(f"Linha {numero_linha}: ATIVIDADE em branco.")
            continue
        if not unidade:
            erros.append(f"Linha {numero_linha}: UNIDADE em branco.")
            continue

        quantidade = _parse_quantidade(quantidade_bruta)
        if quantidade is None:
            erros.append(f"Linha {numero_linha}: TOTAL/QUANTIDADE inválido.")
            continue

        chave = (disciplina.upper(), atividade.upper())
        if chave in combinacoes_vistas:
            erros.append(f"Linha {numero_linha}: ATIVIDADE duplicada para esta DISCIPLINA.")
            continue
        combinacoes_vistas.add(chave)

        linhas_validas.append(
            {
                "disciplina": disciplina,
                "atividade": atividade,
                "unidade": unidade,
                "quantidade": quantidade,
            },
        )

    return linhas_validas, erros


def _criar_disciplinas_e_servicos(projeto, linhas_validas: list[dict]) -> ResultadoImportacaoEap:
    grupos: dict[str, list[dict]] = {}
    nomes_disciplina: dict[str, str] = {}
    for linha in linhas_validas:
        chave = linha["disciplina"].upper()
        grupos.setdefault(chave, []).append(linha)
        nomes_disciplina.setdefault(chave, linha["disciplina"])

    servicos_criados = 0
    with transaction.atomic():
        for chave, linhas_do_grupo in grupos.items():
            disciplina = Disciplina.objects.create(
                projeto=projeto,
                nome=nomes_disciplina[chave],
                pai=None,
            )
            for linha in linhas_do_grupo:
                unidade, _criada = Unidade.objects.get_or_create(sigla=linha["unidade"])
                CatalogoServico.objects.create(
                    disciplina=disciplina,
                    nome=linha["atividade"],
                    unidade=unidade,
                    quantidade_planejada=linha["quantidade"],
                )
                servicos_criados += 1

    return ResultadoImportacaoEap(
        disciplinas_criadas=len(grupos),
        servicos_criados=servicos_criados,
    )
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_eap_import.py -v`
Expected: `11 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/buildflow/configuracoes/eap_import.py backend/buildflow/configuracoes/tests/test_eap_import.py
git commit -m "feat: adiciona motor de importacao de EAP via CSV/XLSX"
```

---

## Task 2: Endpoint da API

**Files:**
- Modify: `backend/buildflow/configuracoes/views.py`
- Modify: `backend/buildflow/configuracoes/urls.py`
- Modify: `backend/buildflow/configuracoes/tests/test_api.py`

**Interfaces:**
- Consumes: `eap_import.{ArquivoInvalido, LinhasInvalidas, importar_eap_de_arquivo}` (Task 1); `ProjetoNestedMixin._get_projeto()`, `IsAuthenticatedWithEmpresa`, `IsGerente` (já existem em `views.py`/`core/permissions.py`).
- Produces (usado pela Task 3): `POST /api/v1/projetos/{projeto_pk}/configuracao/eap/importar/`, multipart, campo `arquivo`. Resposta 201 `{"disciplinas_criadas": int, "servicos_criados": int}`; 400 `{"erros": [str, ...]}` ou `{"detail": str}`; 403 para não-Gerente; 404 cross-tenant.

- [ ] **Step 1: Escrever os testes de API (vão falhar — a rota ainda não existe)**

Em `backend/buildflow/configuracoes/tests/test_api.py`, adicionar aos imports do topo do arquivo:

```python
from django.core.files.uploadedfile import SimpleUploadedFile
```

E ao final do arquivo:

```python
def test_importar_eap_via_csv_retorna_201_com_contadores():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)
    arquivo = SimpleUploadedFile(
        "import.csv",
        b"DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,1500\n",
        content_type="text/csv",
    )

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/eap/importar/",
        {"arquivo": arquivo},
        format="multipart",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert response.json() == {"disciplinas_criadas": 1, "servicos_criados": 1}


def test_importar_eap_retorna_lista_de_erros_quando_ha_linha_invalida():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)
    arquivo = SimpleUploadedFile(
        "import.csv",
        b"DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,abc\n",
        content_type="text/csv",
    )

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/eap/importar/",
        {"arquivo": arquivo},
        format="multipart",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json() == {"erros": ["Linha 2: TOTAL/QUANTIDADE inválido."]}


def test_importar_eap_com_projeto_ja_populado_retorna_detail():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    DisciplinaFactory(projeto=projeto)
    client = _authenticated_client(usuario)
    arquivo = SimpleUploadedFile(
        "import.csv",
        b"DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,1500\n",
        content_type="text/csv",
    )

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/eap/importar/",
        {"arquivo": arquivo},
        format="multipart",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert "já possui uma EAP" in response.json()["detail"]


def test_auxiliar_administrativo_recebe_403_ao_importar_eap():
    usuario = UsuarioFactory(perfil=PerfilChoices.AUXILIAR_ADMINISTRATIVO)
    projeto = ProjetoParaRdoFactory()
    client = _authenticated_client(usuario)
    arquivo = SimpleUploadedFile(
        "import.csv",
        b"DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,1500\n",
        content_type="text/csv",
    )

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/eap/importar/",
        {"arquivo": arquivo},
        format="multipart",
    )

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_importar_eap_de_projeto_de_outra_empresa_retorna_404():
    usuario_a = UsuarioFactory()
    projeto_a = ProjetoParaRdoFactory(criado_por=usuario_a)
    usuario_b = UsuarioFactory()
    client = _authenticated_client(usuario_b)
    arquivo = SimpleUploadedFile(
        "import.csv",
        b"DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,1500\n",
        content_type="text/csv",
    )

    response = client.post(
        f"/api/v1/projetos/{projeto_a.id}/configuracao/eap/importar/",
        {"arquivo": arquivo},
        format="multipart",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
```

`DisciplinaFactory` já está importado em `test_api.py` (usado em outros testes do arquivo) — se não estiver, adicionar `from buildflow.registros_diarios.tests.factories import DisciplinaFactory` junto aos outros imports de factories.

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_api.py -k importar_eap -v`
Expected: FAIL com 404 (rota não existe ainda)

- [ ] **Step 3: Implementar a view**

Em `backend/buildflow/configuracoes/views.py`, adicionar aos imports do topo:

```python
from rest_framework.parsers import FormParser
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import eap_import
```

(`Response` e `APIView` já estão importados no arquivo — não duplicar; `MultiPartParser`/`FormParser` e `eap_import` são novos.)

Adicionar a nova view, depois da classe `DisciplinaViewSet` (antes de `DisciplinaDetailViewSet`):

```python
class EapImportView(ProjetoNestedMixin, APIView):
    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, projeto_pk):
        projeto = self._get_projeto()
        arquivo = request.FILES.get("arquivo")
        if arquivo is None:
            return Response({"detail": "Nenhum arquivo enviado."}, status=400)

        try:
            resultado = eap_import.importar_eap_de_arquivo(projeto, arquivo)
        except eap_import.ArquivoInvalido as exc:
            return Response({"detail": exc.mensagem}, status=400)
        except eap_import.LinhasInvalidas as exc:
            return Response({"erros": exc.erros}, status=400)

        return Response(
            {
                "disciplinas_criadas": resultado.disciplinas_criadas,
                "servicos_criados": resultado.servicos_criados,
            },
            status=201,
        )
```

- [ ] **Step 4: Registrar a rota**

Em `backend/buildflow/configuracoes/urls.py`, adicionar ao import:

```python
from .views import EapImportView
```

E adicionar ao `urlpatterns`, logo após o bloco de `configuracao-disciplinas`:

```python
    path(
        "projetos/<uuid:projeto_pk>/configuracao/eap/importar/",
        EapImportView.as_view(),
        name="configuracao-eap-importar",
    ),
```

- [ ] **Step 5: Rodar os testes para confirmar que passam**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_api.py -v`
Expected: todos os testes do arquivo passam (incluindo os 5 novos)

- [ ] **Step 6: Rodar a suíte completa do backend**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib`
Expected: todos os testes passam, nenhuma regressão

- [ ] **Step 7: Commit**

```bash
git add backend/buildflow/configuracoes/views.py backend/buildflow/configuracoes/urls.py backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: expoe endpoint de importacao de EAP via CSV/XLSX"
```

---

## Task 3: Hook, tipo e botão de importação no frontend

**Files:**
- Modify: `frontend/src/types/configuracao.ts`
- Modify: `frontend/src/features/configuracoes/configuracaoApi.ts`
- Create: `frontend/src/features/configuracoes/ImportarEapButton.tsx`
- Modify: `frontend/src/pages/ConfiguracaoPage.tsx`

**Interfaces:**
- Consumes: `apiClient`/`ApiError` (`services/apiClient.ts`), `Alert`/`Button` (`components/ui`), `toast` (`hooks/use-toast`) — todos já existem.
- Produces (usado pela Task 4): componente `<ImportarEapButton projetoId={string} />`; input de arquivo com `aria-label="Importar planilha"`; botão visível com texto `"Importar planilha"` (ou `"Importando…"` durante o upload); lista de erros renderizada em `<Alert>` quando a importação falha.

- [ ] **Step 1: Adicionar o tipo de resultado**

Em `frontend/src/types/configuracao.ts`, adicionar ao final do arquivo:

```ts
export interface ResultadoImportacaoEap {
  disciplinas_criadas: number
  servicos_criados: number
}
```

- [ ] **Step 2: Adicionar o hook `useImportarEap`**

Em `frontend/src/features/configuracoes/configuracaoApi.ts`, adicionar ao import do topo:

```ts
import type { CatalogoServico, ConfiguracaoProjeto, Disciplina, ResultadoImportacaoEap, ValorCusto } from '../../types/configuracao'
```

(substituindo a linha de import de tipos existente, que hoje não inclui `ResultadoImportacaoEap`).

E adicionar ao final do arquivo:

```ts
export class ImportarEapError extends Error {
  erros: string[] | null
  detail: string | null

  constructor(erros: string[] | null, detail: string | null) {
    super(detail ?? erros?.join(' ') ?? 'Falha ao importar planilha.')
    this.erros = erros
    this.detail = detail
  }
}

async function importarEapRequest(projetoId: string, arquivo: File): Promise<ResultadoImportacaoEap> {
  const formData = new FormData()
  formData.append('arquivo', arquivo)

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api/v1/projetos/${projetoId}/configuracao/eap/importar/`,
    {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        'X-CSRFToken': document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? '',
      },
    },
  )

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ImportarEapError(body?.erros ?? null, body?.detail ?? null)
  }
  return body as ResultadoImportacaoEap
}

export function useImportarEap(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (arquivo: File) => importarEapRequest(projetoId, arquivo),
    onSuccess: invalidar,
  })
}
```

- [ ] **Step 3: Criar o componente `ImportarEapButton`**

Criar `frontend/src/features/configuracoes/ImportarEapButton.tsx`:

```tsx
import { useRef, useState, type ChangeEvent } from 'react'
import { Alert, Button } from '../../components/ui'
import { toast } from '../../hooks/use-toast'
import { ImportarEapError, useImportarEap } from './configuracaoApi'

interface ImportarEapButtonProps {
  projetoId: string
}

export function ImportarEapButton({ projetoId }: ImportarEapButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [erros, setErros] = useState<string[] | null>(null)
  const importarEap = useImportarEap(projetoId)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!arquivo) return

    setErros(null)
    importarEap.mutate(arquivo, {
      onSuccess: (resultado) => {
        toast({
          title: `${resultado.disciplinas_criadas} disciplinas e ${resultado.servicos_criados} serviços importados.`,
          variant: 'success',
        })
      },
      onError: (error) => {
        if (error instanceof ImportarEapError) {
          setErros(error.erros ?? [error.detail ?? 'Não foi possível importar a planilha.'])
        } else {
          setErros(['Não foi possível importar a planilha.'])
        }
      },
    })
  }

  return (
    <div aria-label="Importar planilha da EAP">
      <Button
        type="button"
        variant="outline"
        disabled={importarEap.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {importarEap.isPending ? 'Importando…' : 'Importar planilha'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        aria-label="Importar planilha"
        className="hidden"
        onChange={handleFileChange}
      />
      {erros && (
        <Alert>
          <ul className="list-disc pl-4">
            {erros.map((erro) => (
              <li key={erro}>{erro}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Integrar na aba EAP**

Em `frontend/src/pages/ConfiguracaoPage.tsx`, adicionar ao import do topo (junto aos outros imports de `features/configuracoes`):

```tsx
import { ImportarEapButton } from '../features/configuracoes/ImportarEapButton'
```

E trocar o bloco do `EmptyState` da aba EAP (linhas 153-155 do arquivo atual):

```tsx
              {disciplinas.length === 0 && (
                <EmptyState>Cadastre uma disciplina na aba Disciplinas para começar a EAP.</EmptyState>
              )}
```

por:

```tsx
              {disciplinas.length === 0 && (
                <>
                  <EmptyState>Cadastre uma disciplina na aba Disciplinas para começar a EAP.</EmptyState>
                  <div className="mb-4 flex justify-center">
                    <ImportarEapButton projetoId={projetoId ?? ''} />
                  </div>
                </>
              )}
```

- [ ] **Step 5: Checar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/configuracao.ts frontend/src/features/configuracoes/configuracaoApi.ts frontend/src/features/configuracoes/ImportarEapButton.tsx frontend/src/pages/ConfiguracaoPage.tsx
git commit -m "feat: adiciona botao de importacao de EAP via CSV/XLSX na UI"
```

---

## Task 4: Testes e2e

**Files:**
- Modify: `frontend/tests/e2e/config.spec.ts`

**Interfaces:**
- Consumes: rota mockada `**/api/v1/projetos/*/configuracao/eap/importar/` (Task 2/3); `page.getByRole('button', { name: 'Importar planilha' })`; `page.getByLabel('Importar planilha')` (input de arquivo, Task 3).

- [ ] **Step 1: Escrever os testes e2e**

Em `frontend/tests/e2e/config.spec.ts`, adicionar ao final do arquivo:

```ts
test('importa planilha CSV e popula a EAP com as disciplinas do arquivo', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  let importado = false

  await page.route(CONFIG_URL, (route) => {
    const disciplinas = importado
      ? [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: null,
            avanco_percentual: null,
            subdisciplinas: [],
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: null,
                quantidade_planejada: '1500.000',
                quantidade_executada: '0.000',
                quantidade_executada_manual: '0.000',
                producoes_vinculadas: [],
                carta_controle: null,
                avanco_percentual: null,
              },
            ],
          },
        ]
      : []
    return route.fulfill({
      json: { disciplinas, equipes: [], valores_custo: [], soma_pesos_disciplinas: 0 },
    })
  })

  await page.route('**/api/v1/projetos/*/configuracao/eap/importar/', (route) => {
    importado = true
    return route.fulfill({ status: 201, json: { disciplinas_criadas: 1, servicos_criados: 1 } })
  })

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()

  await expect(page.getByRole('button', { name: 'Importar planilha' })).toBeVisible()

  await page.getByLabel('Importar planilha').setInputFiles({
    name: 'import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,1500\n'),
  })

  await expect(page.getByText('Terraplenagem')).toBeVisible()
})

test('mostra lista de erros quando a planilha tem linha inválida e não altera a EAP', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({ json: { disciplinas: [], equipes: [], valores_custo: [], soma_pesos_disciplinas: 0 } }),
  )
  await page.route('**/api/v1/projetos/*/configuracao/eap/importar/', (route) =>
    route.fulfill({ status: 400, json: { erros: ['Linha 2: TOTAL/QUANTIDADE inválido.'] } }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()

  await page.getByLabel('Importar planilha').setInputFiles({
    name: 'import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('DISCIPLINA,ATIVIDADE,UN,TOTAL\nTerraplenagem,Corte,m3,abc\n'),
  })

  await expect(page.getByText('Linha 2: TOTAL/QUANTIDADE inválido.')).toBeVisible()
  await expect(page.getByText('Cadastre uma disciplina na aba Disciplinas para começar a EAP.')).toBeVisible()
})
```

- [ ] **Step 2: Rodar a suíte e2e completa deste arquivo**

Run: `cd frontend && npx playwright test tests/e2e/config.spec.ts`
Expected: todos os testes do arquivo passam (incluindo os 2 novos), nenhuma regressão

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/config.spec.ts
git commit -m "test: adiciona testes e2e de importacao de EAP via CSV/XLSX"
```
