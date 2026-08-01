# Importação de EAP — formato hierárquico com peso, datas e valor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender o import de EAP (já em produção, formato `DISCIPLINA/ATIVIDADE/UN/TOTAL` de 2 níveis) para também ler um segundo formato — código hierárquico com pontos (`001.001.001`) + peso + datas + cross-reference de preço/valor com abas de referência — auto-detectado pelo cabeçalho, sem quebrar o formato antigo.

**Architecture:** `eap_import.py` (orquestração) ganha um novo módulo irmão, `eap_import_hierarquico.py`, com toda a lógica do formato novo (detecção, construção da árvore N-níveis a partir do código, validação, cross-reference de valor, criação). Os dois módulos compartilham primitivas (exceções, dataclass de resultado, helpers de parsing numérico) via um terceiro módulo, `eap_import_shared.py`, evitando import circular. `importar_eap_de_arquivo` tenta o formato hierárquico primeiro; se nenhuma aba do arquivo bater com esse cabeçalho, cai para o formato de 2 níveis já existente.

**Tech Stack:** Django (migrations, ORM), `openpyxl` (leitura xlsx multi-aba), DRF (serializers).

## Global Constraints

- Formato hierárquico é detectado por cabeçalho contendo `CÓDIGO` + `TASK NAME` (case-insensitive, trimmed); exige também `UNIDADE` e `QUANTIDADE` no mesmo cabeçalho. `PESO PERCENTUAL`, `DATA INICIO PREVISTA`, `DATA FIM PREVISTA` são colunas opcionais e independentes — ausente do cabeçalho = campo sempre `null`, sem erro.
- `Outline Level` nunca é lido. A árvore é construída 100% a partir do `CÓDIGO`: número de segmentos separados por ponto = profundidade; prefixo até o penúltimo ponto = código do pai.
- Uma linha é folha (`CatalogoServico`) quando nenhuma outra linha do arquivo tem código que a estende com mais um segmento **e** o código tem pelo menos um ponto. Código de nível raiz (sem ponto) sempre vira `Disciplina`, mesmo sem filhos no arquivo (nunca vira `CatalogoServico` — o FK `disciplina` é obrigatório).
- `CÓDIGO` duplicado no arquivo → erro. `CÓDIGO` cujo prefixo-pai não existe no arquivo → erro.
- `UNIDADE`/`QUANTIDADE` exigidos só em linha-folha; mesmos limites já usados no formato antigo (`UNIDADE` até 16 caracteres, `QUANTIDADE` finito/não-negativo/até `999999999.999`). `TASK NAME` até 255 caracteres, igual `DISCIPLINA`/`ATIVIDADE` hoje.
- `PESO PERCENTUAL`, quando presente e não-branco, deve caber no campo (`max_digits=5, decimal_places=2`, ou seja até `999.99`) — sem checagem de soma-100% entre irmãos.
- Datas: se as duas vierem preenchidas na mesma linha-folha, `fim >= início` é obrigatório; se só uma vier, importa só essa.
- Dois campos novos, ambos `null=True, blank=True`, `DecimalField(max_digits=12, decimal_places=2)` (mesma precisão de `ValorCusto.valor`): `CatalogoServico.preco_unitario`, `Disciplina.valor_base`.
- `BASE_CUSTOS_SICRO` (colunas `CÓDIGO`, `PREÇO UNITÁRIO BASE (R$)`) preenche `preco_unitario` por código de serviço-folha. `RESUMO_VALORES` (colunas `CÓDIGO`, `VALOR BASE (R$)`) preenche `valor_base` só em disciplina raiz. Localizadas por nome exato de aba (case-insensitive); aba ausente ou código sem match → campo fica `null`, sem erro.
- Resposta da API continua `{"disciplinas_criadas": N, "servicos_criados": M}`, contando todos os nós (raiz + subdisciplinas juntos) — sem novo campo na resposta.
- Formato hierárquico + valor é exclusivo de `.xlsx` (as abas de referência não existem em CSV). CSV continua servindo só o formato antigo.
- Formato antigo (`DISCIPLINA/ATIVIDADE/UN/TOTAL`, CSV e XLSX) continua funcionando exatamente como está — nenhuma mudança de comportamento ou de mensagens de erro para ele, exceto a mensagem final de "cabeçalho não encontrado" (Task 4), que passa a mencionar os dois formatos.

---

## Task 1: Extrai módulo compartilhado, sem mudar comportamento

**Files:**
- Create: `backend/buildflow/configuracoes/eap_import_shared.py`
- Modify: `backend/buildflow/configuracoes/eap_import.py`

**Interfaces:**
- Produces (usado pelas Tasks 3-4): de `eap_import_shared.py` — `ArquivoInvalido`, `LinhasInvalidas`, `ResultadoImportacaoEap`, `LINHAS_MAX_BUSCA_CABECALHO`, `NOME_MAX_LENGTH`, `UNIDADE_MAX_LENGTH`, `_celula(linha, indice) -> str`, `_parse_quantidade(valor) -> Decimal | None`, `_obter_ou_criar_unidade(sigla) -> Unidade`. De `eap_import.py` — `_ler_planilhas_brutas(arquivo) -> list[tuple[str, list[list[str]]]]` (cada item é `(nome_da_aba, linhas)`; antes era só `list[list[list[str]]]`, sem nome de aba — essa é a mudança de comportamento interna desta task, necessária pra Task 3 localizar abas por nome).

Este é um refactor puro: nenhuma mensagem de erro, nenhum comportamento observável muda. A suíte de testes existente (`test_eap_import.py`, `test_api.py`) deve passar sem nenhuma alteração.

- [ ] **Step 1: Criar `eap_import_shared.py`**

Criar `backend/buildflow/configuracoes/eap_import_shared.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from decimal import InvalidOperation

from .models import Unidade

LINHAS_MAX_BUSCA_CABECALHO = 20
NOME_MAX_LENGTH = 255
UNIDADE_MAX_LENGTH = 16
QUANTIDADE_MAXIMA = Decimal("999999999.999")


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


def _celula(linha: list[str], indice: int) -> str:
    return linha[indice].strip() if indice < len(linha) else ""


def _parse_quantidade(valor: str) -> Decimal | None:
    if not valor:
        return None
    try:
        quantidade = Decimal(valor.replace(",", "."))
    except InvalidOperation:
        return None
    if not quantidade.is_finite() or quantidade < 0 or quantidade > QUANTIDADE_MAXIMA:
        return None
    return quantidade


def _obter_ou_criar_unidade(sigla: str) -> Unidade:
    unidade = Unidade.objects.filter(sigla__iexact=sigla).first()
    if unidade is not None:
        return unidade
    return Unidade.objects.create(sigla=sigla)
```

- [ ] **Step 2: Substituir o conteúdo de `eap_import.py`**

Substituir **todo** o conteúdo de `backend/buildflow/configuracoes/eap_import.py` por:

```python
from __future__ import annotations

import csv
import io
from zipfile import BadZipFile

import openpyxl
from django.db import transaction
from django.utils.translation import gettext_lazy as _
from openpyxl.utils.exceptions import InvalidFileException

from .eap_import_shared import LINHAS_MAX_BUSCA_CABECALHO
from .eap_import_shared import NOME_MAX_LENGTH
from .eap_import_shared import UNIDADE_MAX_LENGTH
from .eap_import_shared import ArquivoInvalido
from .eap_import_shared import LinhasInvalidas
from .eap_import_shared import ResultadoImportacaoEap
from .eap_import_shared import _celula
from .eap_import_shared import _obter_ou_criar_unidade
from .eap_import_shared import _parse_quantidade
from .models import CatalogoServico
from .models import Disciplina

MAX_EAP_IMPORT_BYTES = 5 * 1024 * 1024
COLUNAS_OBRIGATORIAS = {
    "disciplina": {"DISCIPLINA"},
    "atividade": {"ATIVIDADE"},
    "unidade": {"UN", "UNIDADE"},
    "quantidade": {"TOTAL", "QUANTIDADE"},
}


def importar_eap_de_arquivo(projeto, arquivo) -> ResultadoImportacaoEap:
    if arquivo.size > MAX_EAP_IMPORT_BYTES:
        msg = str(_("Arquivo excede o tamanho máximo permitido (5 MB)."))
        raise ArquivoInvalido(msg)

    if projeto.disciplinas.filter(pai__isnull=True).exists():
        msg = str(
            _(
                "Este projeto já possui uma EAP. Import só é permitido em "
                "projetos sem disciplinas cadastradas.",
            ),
        )
        raise ArquivoInvalido(msg)

    planilhas = _ler_planilhas_brutas(arquivo)

    linhas, indice_cabecalho, colunas = _localizar_cabecalho_em_planilhas(planilhas)
    linhas_validas, erros = _validar_linhas(linhas, indice_cabecalho, colunas)
    if erros:
        raise LinhasInvalidas(erros)

    return _criar_disciplinas_e_servicos(projeto, linhas_validas)


def _ler_planilhas_brutas(arquivo) -> list[tuple[str, list[list[str]]]]:
    nome = (arquivo.name or "").lower()
    if nome.endswith(".xlsx"):
        return _ler_planilhas_xlsx(arquivo)
    if nome.endswith(".csv"):
        return [("", _ler_linhas_csv(arquivo))]
    msg = str(_("Formato não suportado. Envie um arquivo .csv ou .xlsx."))
    raise ArquivoInvalido(msg)


def _ler_planilhas_xlsx(arquivo) -> list[tuple[str, list[list[str]]]]:
    try:
        workbook = openpyxl.load_workbook(
            io.BytesIO(arquivo.read()),
            data_only=True,
            read_only=True,
        )
    except (BadZipFile, InvalidFileException) as exc:
        msg = str(_("Não foi possível ler o arquivo .xlsx."))
        raise ArquivoInvalido(msg) from exc

    return [
        (
            planilha.title,
            [
                ["" if valor is None else str(valor).strip() for valor in row]
                for row in planilha.iter_rows(values_only=True)
            ],
        )
        for planilha in workbook.worksheets
    ]


def _ler_linhas_csv(arquivo) -> list[list[str]]:
    dados = arquivo.read()
    try:
        texto = dados.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = dados.decode("cp1252")

    leitor = csv.reader(io.StringIO(texto))
    return [[celula.strip() for celula in linha] for linha in leitor]


def _localizar_cabecalho_em_planilhas(
    planilhas: list[tuple[str, list[list[str]]]],
) -> tuple[list[list[str]], int, dict[str, int]]:
    for _nome_aba, linhas in planilhas:
        resultado = _tentar_localizar_cabecalho(linhas)
        if resultado is not None:
            indice, colunas = resultado
            return linhas, indice, colunas

    msg = str(
        _(
            "Cabeçalho não encontrado ou incompleto. Colunas obrigatórias: "
            "DISCIPLINA, ATIVIDADE, UN/UNIDADE, TOTAL/QUANTIDADE.",
        ),
    )
    raise ArquivoInvalido(msg)


def _tentar_localizar_cabecalho(linhas: list[list[str]]) -> tuple[int, dict[str, int]] | None:
    limite = min(len(linhas), LINHAS_MAX_BUSCA_CABECALHO)
    for indice in range(limite):
        celulas_normalizadas = [celula.strip().upper() for celula in linhas[indice]]
        if "DISCIPLINA" in celulas_normalizadas and "ATIVIDADE" in celulas_normalizadas:
            colunas = _resolver_colunas(celulas_normalizadas)
            if colunas is not None:
                return indice, colunas
            return None
    return None


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
        if not any(_celula(linha, indice) for indice in colunas.values()):
            continue

        disciplina = _celula(linha, colunas["disciplina"])
        atividade = _celula(linha, colunas["atividade"])
        unidade = _celula(linha, colunas["unidade"])
        quantidade_bruta = _celula(linha, colunas["quantidade"])

        if not disciplina:
            erros.append(f"Linha {numero_linha}: DISCIPLINA em branco.")
            continue
        if len(disciplina) > NOME_MAX_LENGTH:
            erros.append(
                f"Linha {numero_linha}: DISCIPLINA excede o tamanho máximo "
                f"({NOME_MAX_LENGTH} caracteres).",
            )
            continue
        if not atividade:
            erros.append(f"Linha {numero_linha}: ATIVIDADE em branco.")
            continue
        if len(atividade) > NOME_MAX_LENGTH:
            erros.append(
                f"Linha {numero_linha}: ATIVIDADE excede o tamanho máximo "
                f"({NOME_MAX_LENGTH} caracteres).",
            )
            continue
        if not unidade:
            erros.append(f"Linha {numero_linha}: UNIDADE em branco.")
            continue
        if len(unidade) > UNIDADE_MAX_LENGTH:
            erros.append(
                f"Linha {numero_linha}: UNIDADE excede o tamanho máximo "
                f"({UNIDADE_MAX_LENGTH} caracteres).",
            )
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
                unidade = _obter_ou_criar_unidade(linha["unidade"])
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

- [ ] **Step 3: Rodar a suíte existente sem nenhuma alteração — confirmar zero regressão**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_eap_import.py buildflow/configuracoes/tests/test_api.py -v`
Expected: todos os testes passam, exatamente como antes (nenhum teste foi tocado nesta task — `ArquivoInvalido`/`LinhasInvalidas`/`MAX_EAP_IMPORT_BYTES` continuam acessíveis via `buildflow.configuracoes.eap_import`, porque `eap_import.py` os importa de `eap_import_shared.py` pro próprio uso, o que automaticamente os expõe no namespace do módulo).

- [ ] **Step 4: Rodar a suíte completa do backend**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib`
Expected: todos os testes passam, nenhuma regressão.

- [ ] **Step 5: Commit**

```bash
git add backend/buildflow/configuracoes/eap_import.py backend/buildflow/configuracoes/eap_import_shared.py
git commit -m "refactor: extrai primitivas compartilhadas do import de EAP para eap_import_shared.py"
```

---

## Task 2: Schema — `preco_unitario` e `valor_base`

**Files:**
- Modify: `backend/buildflow/configuracoes/models.py`
- Create: `backend/buildflow/configuracoes/migrations/0012_catalogoservico_preco_unitario_disciplina_valor_base.py`
- Modify: `backend/buildflow/configuracoes/serializers.py`
- Modify: `backend/buildflow/configuracoes/tests/test_models.py`
- Modify: `backend/buildflow/configuracoes/tests/test_api.py`

**Interfaces:**
- Produces (usado pela Task 3): `CatalogoServico.preco_unitario: Decimal | None`, `Disciplina.valor_base: Decimal | None` — ambos aceitos em `.objects.create(...)` como qualquer outro campo do model.

- [ ] **Step 1: Adicionar os campos ao model**

Em `backend/buildflow/configuracoes/models.py`, dentro da classe `Disciplina`, logo depois do campo `peso_percentual` (o bloco que termina em `blank=True,\n    )` antes de `tenant_path`):

```python
    valor_base = models.DecimalField(
        _("valor base"),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
```

Dentro da classe `CatalogoServico`, logo depois do campo `peso_percentual` (antes de `quantidade_planejada`):

```python
    preco_unitario = models.DecimalField(
        _("preço unitário"),
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
```

- [ ] **Step 2: Criar a migration**

Criar `backend/buildflow/configuracoes/migrations/0012_catalogoservico_preco_unitario_disciplina_valor_base.py`:

```python
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('configuracoes', '0011_disciplina_pai'),
    ]

    operations = [
        migrations.AddField(
            model_name='catalogoservico',
            name='preco_unitario',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name='preço unitário'),
        ),
        migrations.AddField(
            model_name='disciplina',
            name='valor_base',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name='valor base'),
        ),
    ]
```

- [ ] **Step 3: Rodar a migration**

Run: `cd backend && ./.venv/Scripts/python.exe manage.py migrate configuracoes --settings=config.settings.test`
Expected: `Applying configuracoes.0012_catalogoservico_preco_unitario_disciplina_valor_base... OK`

- [ ] **Step 4: Expor os campos nos serializers**

Em `backend/buildflow/configuracoes/serializers.py`, no `Meta.fields` de `CatalogoServicoSerializer`, adicionar `"preco_unitario"` logo depois de `"peso_percentual"`:

```python
        fields = [
            "id",
            "nome",
            "unidade",
            "peso_percentual",
            "preco_unitario",
            "quantidade_planejada",
```

No `Meta.fields` de `DisciplinaSerializer`, adicionar `"valor_base"` logo depois de `"peso_percentual"`:

```python
        fields = [
            "id",
            "nome",
            "peso_percentual",
            "valor_base",
            "pai",
```

- [ ] **Step 5: Escrever os testes de model**

Em `backend/buildflow/configuracoes/tests/test_models.py`, adicionar ao final do arquivo:

```python
def test_disciplina_aceita_valor_base_opcional():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto,
        nome="Terraplenagem",
        valor_base=Decimal("1500000.00"),
    )

    disciplina.refresh_from_db()
    assert disciplina.valor_base == Decimal("1500000.00")


def test_catalogo_servico_aceita_preco_unitario_opcional():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")

    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        preco_unitario=Decimal("18.50"),
    )

    servico.refresh_from_db()
    assert servico.preco_unitario == Decimal("18.50")
```

- [ ] **Step 6: Escrever os testes de API**

Em `backend/buildflow/configuracoes/tests/test_api.py`, adicionar ao final do arquivo:

```python
def test_patch_disciplina_atualiza_valor_base():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/disciplinas/{disciplina.id}/",
        {"valor_base": "2500000.00"},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["valor_base"] == "2500000.00"


def test_patch_servico_atualiza_preco_unitario():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=unidade)
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/servicos/{servico.id}/",
        {"preco_unitario": "18.50"},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["preco_unitario"] == "18.50"
```

- [ ] **Step 7: Rodar os testes**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_models.py buildflow/configuracoes/tests/test_api.py -v`
Expected: todos passam, incluindo os 4 novos.

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib`
Expected: todos os testes passam.

- [ ] **Step 9: Commit**

```bash
git add backend/buildflow/configuracoes/models.py backend/buildflow/configuracoes/migrations/0012_catalogoservico_preco_unitario_disciplina_valor_base.py backend/buildflow/configuracoes/serializers.py backend/buildflow/configuracoes/tests/test_models.py backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: adiciona preco_unitario e valor_base ao model e serializers da EAP"
```

---

## Task 3: Motor de importação do formato hierárquico

**Files:**
- Create: `backend/buildflow/configuracoes/eap_import_hierarquico.py`
- Test: `backend/buildflow/configuracoes/tests/test_eap_import_hierarquico.py`

**Interfaces:**
- Consumes: de `eap_import_shared.py` (Task 1) — `LINHAS_MAX_BUSCA_CABECALHO`, `NOME_MAX_LENGTH`, `UNIDADE_MAX_LENGTH`, `LinhasInvalidas`, `ResultadoImportacaoEap`, `_celula`, `_obter_ou_criar_unidade`, `_parse_quantidade`. De `eap_import.py` (Task 1) — `_ler_planilhas_brutas(arquivo) -> list[tuple[str, list[list[str]]]]` (usado só nos testes desta task, pra montar o input de `localizar_cabecalho`). Do model — `preco_unitario`/`valor_base` (Task 2).
- Produces (usado pela Task 4): `localizar_cabecalho(planilhas: list[tuple[str, list[list[str]]]]) -> tuple[str, list[list[str]], int, dict[str, int]] | None` — retorna `None` se nenhuma aba tiver o cabeçalho do formato hierárquico. `importar(projeto, planilhas: list[tuple[str, list[list[str]]]], linhas: list[list[str]], indice_cabecalho: int, colunas: dict[str, int]) -> ResultadoImportacaoEap` — levanta `LinhasInvalidas` se houver erro de validação.

- [ ] **Step 1: Escrever os testes (vão falhar — o módulo ainda não existe)**

Criar `backend/buildflow/configuracoes/tests/test_eap_import_hierarquico.py`:

```python
import io
from datetime import date
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook

from buildflow.configuracoes.eap_import import _ler_planilhas_brutas
from buildflow.configuracoes.eap_import_hierarquico import importar
from buildflow.configuracoes.eap_import_hierarquico import localizar_cabecalho
from buildflow.configuracoes.eap_import_shared import LinhasInvalidas
from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory

pytestmark = pytest.mark.django_db

CABECALHO_PRINCIPAL = [
    "CÓDIGO", "Task Name", "Peso Percentual", "Outline Level",
    "data inicio prevista", "data fim prevista", "unidade", "quantidade",
]


def _workbook_upload(nome: str, abas: dict[str, list[list]]) -> SimpleUploadedFile:
    workbook = Workbook()
    workbook.remove(workbook.active)
    for titulo, linhas in abas.items():
        sheet = workbook.create_sheet(titulo)
        for linha in linhas:
            sheet.append(linha)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile(
        nome,
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def _importar(projeto, arquivo):
    planilhas = _ler_planilhas_brutas(arquivo)
    resultado_localizacao = localizar_cabecalho(planilhas)
    assert resultado_localizacao is not None
    _nome_aba, linhas, indice_cabecalho, colunas = resultado_localizacao
    return importar(projeto, planilhas, linhas, indice_cabecalho, colunas)


def test_arvore_2_e_3_niveis_com_peso_datas_e_valor_e_criada_corretamente():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 40, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "2026-09-01", "2026-09-10", "vb", 1],
        ["002", "Terraplenagem", 60, 1, "", "", "", ""],
        ["002.001", "Escavações", 55, 2, "", "", "", ""],
        ["002.001.001", "Escavação 1ª Categoria", 97, 3, "2026-09-15", "2026-10-01", "m³", 500],
        ["002.001.002", "Escavação 2ª Categoria", 3, 3, "", "", "m³", 20],
        ["002.002", "Aterros", 45, 2, "2026-10-05", "2026-10-20", "m³", 300],
    ]
    resumo_valores = [
        ["CÓDIGO", "DISCIPLINA", "VALOR BASE (R$)"],
        ["001", "Mobilização", 500000],
        ["002", "Terraplenagem", 2000000],
    ]
    custos_sicro = [
        ["CÓDIGO", "DISCIPLINA", "SERVIÇO", "UNIDADE", "PREÇO UNITÁRIO BASE (R$)"],
        ["001.001", "Mobilização", "Canteiro", "vb", 100000],
        ["002.001.001", "Terraplenagem", "Escavação 1ª Categoria", "m³", 18.5],
    ]
    arquivo = _workbook_upload(
        "import.xlsx",
        {
            "EXPORT_PROJECT": principal,
            "RESUMO_VALORES": resumo_valores,
            "BASE_CUSTOS_SICRO": custos_sicro,
        },
    )

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 3
    assert resultado.servicos_criados == 4

    mobilizacao = Disciplina.objects.get(projeto=projeto, nome="Mobilização")
    assert mobilizacao.pai is None
    assert mobilizacao.peso_percentual == Decimal("40.00")
    assert mobilizacao.valor_base == Decimal("500000.00")

    canteiro = CatalogoServico.objects.get(nome="Canteiro")
    assert canteiro.disciplina_id == mobilizacao.id
    assert canteiro.peso_percentual == Decimal("100.00")
    assert canteiro.data_inicio_prevista == date(2026, 9, 1)
    assert canteiro.data_fim_prevista == date(2026, 9, 10)
    assert canteiro.unidade.sigla == "vb"
    assert canteiro.quantidade_planejada == Decimal("1")
    assert canteiro.preco_unitario == Decimal("100000.00")

    terraplenagem = Disciplina.objects.get(projeto=projeto, nome="Terraplenagem")
    assert terraplenagem.pai is None
    assert terraplenagem.valor_base == Decimal("2000000.00")

    escavacoes = Disciplina.objects.get(projeto=projeto, nome="Escavações")
    assert escavacoes.pai_id == terraplenagem.id
    assert escavacoes.valor_base is None

    escavacao_1a = CatalogoServico.objects.get(nome="Escavação 1ª Categoria")
    assert escavacao_1a.disciplina_id == escavacoes.id
    assert escavacao_1a.preco_unitario == Decimal("18.50")

    escavacao_2a = CatalogoServico.objects.get(nome="Escavação 2ª Categoria")
    assert escavacao_2a.disciplina_id == escavacoes.id
    assert escavacao_2a.preco_unitario is None
    assert escavacao_2a.data_inicio_prevista is None

    aterros = CatalogoServico.objects.get(nome="Aterros")
    assert aterros.disciplina_id == terraplenagem.id
    assert aterros.preco_unitario is None
    assert aterros.quantidade_planejada == Decimal("300")


def test_codigo_orfao_e_rejeitado():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["003.001", "Escavações", 100, 2, "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == [
        "Linha 2: código 003.001 não tem uma linha pai 003 no arquivo.",
    ]


def test_codigo_duplicado_e_rejeitado():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001", "Mobilização duplicada", 100, 1, "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == ["Linha 3: código 001 duplicado."]


def test_unidade_em_branco_na_folha_gera_erro_mas_na_intermediaria_nao():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "", "", "", 1],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == ["Linha 3: UNIDADE em branco."]


def test_peso_invalido_gera_erro():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", "abc", 1, "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == ["Linha 2: PESO PERCENTUAL inválido."]


def test_data_fim_antes_do_inicio_gera_erro():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "2026-09-10", "2026-09-01", "vb", 1],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    with pytest.raises(LinhasInvalidas) as exc_info:
        _importar(projeto, arquivo)

    assert exc_info.value.erros == [
        "Linha 3: data fim prevista anterior à data início prevista.",
    ]


def test_colunas_opcionais_ausentes_do_cabecalho_nao_geram_erro():
    projeto = ProjetoParaRdoFactory()
    principal = [
        ["CÓDIGO", "Task Name", "unidade", "quantidade"],
        ["001", "Mobilização", "", ""],
        ["001.001", "Canteiro", "vb", 1],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 1
    canteiro = CatalogoServico.objects.get(nome="Canteiro")
    assert canteiro.peso_percentual is None
    assert canteiro.data_inicio_prevista is None
    assert canteiro.data_fim_prevista is None


def test_abas_de_referencia_ausentes_deixam_preco_e_valor_nulos():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "", "", "vb", 1],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    mobilizacao = Disciplina.objects.get(projeto=projeto, nome="Mobilização")
    assert mobilizacao.valor_base is None
    canteiro = CatalogoServico.objects.get(nome="Canteiro")
    assert canteiro.preco_unitario is None


def test_codigo_raiz_sem_filhos_vira_disciplina_vazia_nao_servico():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 0
    mobilizacao = Disciplina.objects.get(projeto=projeto, nome="Mobilização")
    assert mobilizacao.servicos.count() == 0


def test_linha_totalmente_em_branco_e_ignorada():
    projeto = ProjetoParaRdoFactory()
    principal = [
        CABECALHO_PRINCIPAL,
        ["001", "Mobilização", 100, 1, "", "", "", ""],
        ["001.001", "Canteiro", 100, 2, "", "", "vb", 1],
        ["", "", "", "", "", "", "", ""],
    ]
    arquivo = _workbook_upload("import.xlsx", {"EXPORT_PROJECT": principal})

    resultado = _importar(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 1
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_eap_import_hierarquico.py -v`
Expected: FAIL com `ModuleNotFoundError: No module named 'buildflow.configuracoes.eap_import_hierarquico'`

- [ ] **Step 3: Implementar `eap_import_hierarquico.py`**

Criar `backend/buildflow/configuracoes/eap_import_hierarquico.py`:

```python
from __future__ import annotations

import datetime
from dataclasses import dataclass
from decimal import Decimal
from decimal import InvalidOperation

from django.db import transaction

from .eap_import_shared import LINHAS_MAX_BUSCA_CABECALHO
from .eap_import_shared import NOME_MAX_LENGTH
from .eap_import_shared import UNIDADE_MAX_LENGTH
from .eap_import_shared import LinhasInvalidas
from .eap_import_shared import ResultadoImportacaoEap
from .eap_import_shared import _celula
from .eap_import_shared import _obter_ou_criar_unidade
from .eap_import_shared import _parse_quantidade
from .models import CatalogoServico
from .models import Disciplina

COLUNAS_OBRIGATORIAS = {
    "codigo": "CÓDIGO",
    "nome": "TASK NAME",
    "unidade": "UNIDADE",
    "quantidade": "QUANTIDADE",
}
COLUNAS_OPCIONAIS = {
    "peso": "PESO PERCENTUAL",
    "data_inicio": "DATA INICIO PREVISTA",
    "data_fim": "DATA FIM PREVISTA",
}
PESO_MAXIMO = Decimal("999.99")
VALOR_MAXIMO = Decimal("9999999999.99")
ABA_CUSTOS_SICRO = "BASE_CUSTOS_SICRO"
COLUNA_CUSTOS_SICRO_VALOR = "PREÇO UNITÁRIO BASE (R$)"
ABA_RESUMO_VALORES = "RESUMO_VALORES"
COLUNA_RESUMO_VALORES_VALOR = "VALOR BASE (R$)"


@dataclass
class _NoHierarquico:
    codigo: str
    nome: str
    numero_linha: int
    peso: Decimal | None
    data_inicio: datetime.date | None
    data_fim: datetime.date | None
    unidade_bruta: str
    quantidade_bruta: str


def localizar_cabecalho(
    planilhas: list[tuple[str, list[list[str]]]],
) -> tuple[str, list[list[str]], int, dict[str, int]] | None:
    for nome_aba, linhas in planilhas:
        resultado = _tentar_localizar_cabecalho(linhas)
        if resultado is not None:
            indice, colunas = resultado
            return nome_aba, linhas, indice, colunas
    return None


def _tentar_localizar_cabecalho(linhas: list[list[str]]) -> tuple[int, dict[str, int]] | None:
    limite = min(len(linhas), LINHAS_MAX_BUSCA_CABECALHO)
    for indice in range(limite):
        celulas_normalizadas = [celula.strip().upper() for celula in linhas[indice]]
        if "CÓDIGO" in celulas_normalizadas and "TASK NAME" in celulas_normalizadas:
            colunas = _resolver_colunas(celulas_normalizadas)
            if colunas is not None:
                return indice, colunas
            return None
    return None


def _resolver_colunas(celulas_normalizadas: list[str]) -> dict[str, int] | None:
    colunas: dict[str, int] = {}
    for campo, nome_coluna in COLUNAS_OBRIGATORIAS.items():
        indice = _indice_coluna(celulas_normalizadas, nome_coluna)
        if indice is None:
            return None
        colunas[campo] = indice
    for campo, nome_coluna in COLUNAS_OPCIONAIS.items():
        indice = _indice_coluna(celulas_normalizadas, nome_coluna)
        if indice is not None:
            colunas[campo] = indice
    return colunas


def _indice_coluna(celulas_normalizadas: list[str], nome_coluna: str) -> int | None:
    return next(
        (i for i, celula in enumerate(celulas_normalizadas) if celula == nome_coluna),
        None,
    )


def _parse_peso(valor: str) -> Decimal | None:
    try:
        peso = Decimal(valor.replace(",", "."))
    except InvalidOperation:
        return None
    if not peso.is_finite() or peso < 0 or peso > PESO_MAXIMO:
        return None
    return peso


def _parse_data(valor: str) -> datetime.date | None:
    for formato in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(valor, formato).date()
        except ValueError:
            continue
    return None


def _parsear_linhas(
    linhas: list[list[str]],
    indice_cabecalho: int,
    colunas: dict[str, int],
) -> tuple[dict[str, _NoHierarquico], list[str]]:
    nos: dict[str, _NoHierarquico] = {}
    erros: list[str] = []

    for offset, linha in enumerate(linhas[indice_cabecalho + 1 :], start=1):
        numero_linha = indice_cabecalho + offset + 1
        if not any(_celula(linha, indice) for indice in colunas.values()):
            continue

        codigo = _celula(linha, colunas["codigo"])
        nome = _celula(linha, colunas["nome"])

        if not codigo:
            erros.append(f"Linha {numero_linha}: CÓDIGO em branco.")
            continue
        if not nome:
            erros.append(f"Linha {numero_linha}: TASK NAME em branco.")
            continue
        if len(nome) > NOME_MAX_LENGTH:
            erros.append(
                f"Linha {numero_linha}: TASK NAME excede o tamanho máximo "
                f"({NOME_MAX_LENGTH} caracteres).",
            )
            continue
        if codigo in nos:
            erros.append(f"Linha {numero_linha}: código {codigo} duplicado.")
            continue

        peso = None
        if "peso" in colunas:
            peso_bruto = _celula(linha, colunas["peso"])
            if peso_bruto:
                peso = _parse_peso(peso_bruto)
                if peso is None:
                    erros.append(f"Linha {numero_linha}: PESO PERCENTUAL inválido.")
                    continue

        data_inicio = None
        if "data_inicio" in colunas:
            bruta = _celula(linha, colunas["data_inicio"])
            if bruta:
                data_inicio = _parse_data(bruta)
                if data_inicio is None:
                    erros.append(f"Linha {numero_linha}: DATA INICIO PREVISTA inválida.")
                    continue

        data_fim = None
        if "data_fim" in colunas:
            bruta = _celula(linha, colunas["data_fim"])
            if bruta:
                data_fim = _parse_data(bruta)
                if data_fim is None:
                    erros.append(f"Linha {numero_linha}: DATA FIM PREVISTA inválida.")
                    continue

        if data_inicio is not None and data_fim is not None and data_fim < data_inicio:
            erros.append(
                f"Linha {numero_linha}: data fim prevista anterior à data início prevista.",
            )
            continue

        nos[codigo] = _NoHierarquico(
            codigo=codigo,
            nome=nome,
            numero_linha=numero_linha,
            peso=peso,
            data_inicio=data_inicio,
            data_fim=data_fim,
            unidade_bruta=_celula(linha, colunas["unidade"]),
            quantidade_bruta=_celula(linha, colunas["quantidade"]),
        )

    return nos, erros


def _construir_arvore(
    nos: dict[str, _NoHierarquico],
) -> tuple[dict[str, str | None], set[str], list[str]]:
    erros: list[str] = []
    pais: dict[str, str | None] = {}

    for codigo in nos:
        if "." in codigo:
            codigo_pai = codigo.rsplit(".", 1)[0]
            if codigo_pai not in nos:
                erros.append(
                    f"Linha {nos[codigo].numero_linha}: código {codigo} não tem uma "
                    f"linha pai {codigo_pai} no arquivo.",
                )
                continue
            pais[codigo] = codigo_pai
        else:
            pais[codigo] = None

    codigos_com_filhos = {pai for pai in pais.values() if pai is not None}
    # Codigo de nivel raiz (sem ponto) sempre vira Disciplina, mesmo sem
    # filhos no arquivo — CatalogoServico exige uma disciplina-pai (FK
    # obrigatoria), entao uma folha de verdade so pode existir a partir do
    # nivel 2.
    folhas = {
        codigo for codigo in pais if codigo not in codigos_com_filhos and "." in codigo
    }

    return pais, folhas, erros


def _validar_folhas(
    nos: dict[str, _NoHierarquico],
    folhas: set[str],
) -> tuple[dict[str, Decimal], list[str]]:
    erros: list[str] = []
    quantidades: dict[str, Decimal] = {}

    for codigo in folhas:
        no = nos[codigo]
        if not no.unidade_bruta:
            erros.append(f"Linha {no.numero_linha}: UNIDADE em branco.")
            continue
        if len(no.unidade_bruta) > UNIDADE_MAX_LENGTH:
            erros.append(
                f"Linha {no.numero_linha}: UNIDADE excede o tamanho máximo "
                f"({UNIDADE_MAX_LENGTH} caracteres).",
            )
            continue
        quantidade = _parse_quantidade(no.quantidade_bruta)
        if quantidade is None:
            erros.append(f"Linha {no.numero_linha}: QUANTIDADE inválida.")
            continue
        quantidades[codigo] = quantidade

    return quantidades, erros


def _localizar_aba_por_nome(
    planilhas: list[tuple[str, list[list[str]]]],
    nome_aba: str,
) -> list[list[str]] | None:
    for nome, linhas in planilhas:
        if nome.strip().upper() == nome_aba.upper():
            return linhas
    return None


def _parse_valor(valor: str) -> Decimal | None:
    try:
        numero = Decimal(valor.replace(",", "."))
    except InvalidOperation:
        return None
    if not numero.is_finite() or numero < 0 or numero > VALOR_MAXIMO:
        return None
    return numero


def _tentar_localizar_cabecalho_lookup(
    linhas: list[list[str]],
    nome_coluna_valor: str,
) -> tuple[int, int, int] | None:
    limite = min(len(linhas), LINHAS_MAX_BUSCA_CABECALHO)
    for indice in range(limite):
        celulas_normalizadas = [celula.strip().upper() for celula in linhas[indice]]
        indice_codigo = _indice_coluna(celulas_normalizadas, "CÓDIGO")
        if indice_codigo is None:
            continue
        indice_valor = _indice_coluna(celulas_normalizadas, nome_coluna_valor)
        if indice_valor is None:
            continue
        return indice, indice_codigo, indice_valor
    return None


def _ler_lookup_por_codigo(
    linhas: list[list[str]],
    nome_coluna_valor: str,
) -> dict[str, Decimal]:
    resultado = _tentar_localizar_cabecalho_lookup(linhas, nome_coluna_valor)
    if resultado is None:
        return {}
    indice_cabecalho, indice_codigo, indice_valor = resultado

    lookup: dict[str, Decimal] = {}
    for linha in linhas[indice_cabecalho + 1 :]:
        codigo = _celula(linha, indice_codigo)
        valor_bruto = _celula(linha, indice_valor)
        if not codigo or not valor_bruto:
            continue
        valor = _parse_valor(valor_bruto)
        if valor is not None:
            lookup[codigo] = valor
    return lookup


def _ler_lookup_valor(
    planilhas: list[tuple[str, list[list[str]]]],
    nome_aba: str,
    nome_coluna_valor: str,
) -> dict[str, Decimal]:
    linhas = _localizar_aba_por_nome(planilhas, nome_aba)
    if linhas is None:
        return {}
    return _ler_lookup_por_codigo(linhas, nome_coluna_valor)


def importar(
    projeto,
    planilhas: list[tuple[str, list[list[str]]]],
    linhas: list[list[str]],
    indice_cabecalho: int,
    colunas: dict[str, int],
) -> ResultadoImportacaoEap:
    nos, erros_parse = _parsear_linhas(linhas, indice_cabecalho, colunas)
    pais, folhas, erros_arvore = _construir_arvore(nos)
    quantidades, erros_folhas = _validar_folhas(nos, folhas)

    erros = erros_parse + erros_arvore + erros_folhas
    if erros:
        raise LinhasInvalidas(erros)

    precos = _ler_lookup_valor(planilhas, ABA_CUSTOS_SICRO, COLUNA_CUSTOS_SICRO_VALOR)
    valores_base = _ler_lookup_valor(planilhas, ABA_RESUMO_VALORES, COLUNA_RESUMO_VALORES_VALOR)

    return _criar_arvore(projeto, nos, pais, folhas, quantidades, precos, valores_base)


def _criar_arvore(
    projeto,
    nos: dict[str, _NoHierarquico],
    pais: dict[str, str | None],
    folhas: set[str],
    quantidades: dict[str, Decimal],
    precos: dict[str, Decimal],
    valores_base: dict[str, Decimal],
) -> ResultadoImportacaoEap:
    objetos: dict[str, Disciplina] = {}
    disciplinas_criadas = 0
    servicos_criados = 0

    codigos_ordenados = sorted(nos, key=lambda codigo: codigo.count("."))

    with transaction.atomic():
        for codigo in codigos_ordenados:
            no = nos[codigo]
            codigo_pai = pais[codigo]
            disciplina_pai = objetos[codigo_pai] if codigo_pai is not None else None

            if codigo in folhas:
                unidade = _obter_ou_criar_unidade(no.unidade_bruta)
                CatalogoServico.objects.create(
                    disciplina=disciplina_pai,
                    nome=no.nome,
                    unidade=unidade,
                    quantidade_planejada=quantidades[codigo],
                    peso_percentual=no.peso,
                    data_inicio_prevista=no.data_inicio,
                    data_fim_prevista=no.data_fim,
                    preco_unitario=precos.get(codigo),
                )
                servicos_criados += 1
            else:
                disciplina = Disciplina.objects.create(
                    projeto=projeto,
                    nome=no.nome,
                    pai=disciplina_pai,
                    peso_percentual=no.peso,
                    valor_base=valores_base.get(codigo) if codigo_pai is None else None,
                )
                objetos[codigo] = disciplina
                disciplinas_criadas += 1

    return ResultadoImportacaoEap(
        disciplinas_criadas=disciplinas_criadas,
        servicos_criados=servicos_criados,
    )
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_eap_import_hierarquico.py -v`
Expected: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/buildflow/configuracoes/eap_import_hierarquico.py backend/buildflow/configuracoes/tests/test_eap_import_hierarquico.py
git commit -m "feat: adiciona motor de importacao do formato hierarquico com peso, datas e valor"
```

---

## Task 4: Dispatch, testes de API e verificação com o arquivo real

**Files:**
- Modify: `backend/buildflow/configuracoes/eap_import.py`
- Modify: `backend/buildflow/configuracoes/tests/test_eap_import.py`
- Modify: `backend/buildflow/configuracoes/tests/test_api.py`

**Interfaces:**
- Consumes: `eap_import_hierarquico.{localizar_cabecalho, importar}` (Task 3).

- [ ] **Step 1: Escrever os testes que vão falhar**

Em `backend/buildflow/configuracoes/tests/test_eap_import.py`, adicionar ao final do arquivo:

```python
def test_arquivo_com_formato_hierarquico_e_detectado_automaticamente():
    projeto = ProjetoParaRdoFactory()
    arquivo = _xlsx_upload(
        "import.xlsx",
        [
            ["CÓDIGO", "Task Name", "UNIDADE", "QUANTIDADE"],
            ["001", "Mobilização", "", ""],
            ["001.001", "Canteiro", "vb", 1],
        ],
    )

    resultado = importar_eap_de_arquivo(projeto, arquivo)

    assert resultado.disciplinas_criadas == 1
    assert resultado.servicos_criados == 1
```

Em `backend/buildflow/configuracoes/tests/test_api.py`, confirmar que `import io` e `from openpyxl import Workbook` já estão nos imports do topo do arquivo (adicionar se não estiverem), e adicionar ao final do arquivo:

```python
def test_importar_eap_formato_hierarquico_retorna_201_e_reflete_valor_e_preco():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)

    workbook = Workbook()
    principal = workbook.active
    principal.title = "EXPORT_PROJECT"
    principal.append(["CÓDIGO", "Task Name", "Peso Percentual", "unidade", "quantidade"])
    principal.append(["001", "Mobilização", 100, "", ""])
    principal.append(["001.001", "Canteiro", 100, "vb", 1])
    resumo = workbook.create_sheet("RESUMO_VALORES")
    resumo.append(["CÓDIGO", "VALOR BASE (R$)"])
    resumo.append(["001", 500000])
    custos = workbook.create_sheet("BASE_CUSTOS_SICRO")
    custos.append(["CÓDIGO", "PREÇO UNITÁRIO BASE (R$)"])
    custos.append(["001.001", 100000])
    buffer = io.BytesIO()
    workbook.save(buffer)
    arquivo = SimpleUploadedFile(
        "import.xlsx",
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/eap/importar/",
        {"arquivo": arquivo},
        format="multipart",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert response.json() == {"disciplinas_criadas": 1, "servicos_criados": 1}

    configuracao = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")
    disciplina = configuracao.json()["disciplinas"][0]
    assert disciplina["nome"] == "Mobilização"
    assert disciplina["valor_base"] == "500000.00"
    servico = disciplina["servicos"][0]
    assert servico["nome"] == "Canteiro"
    assert servico["preco_unitario"] == "100000.00"
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_eap_import.py buildflow/configuracoes/tests/test_api.py -k hierarquico -v`
Expected: FAIL — o arquivo hierárquico atualmente cai no parser antigo e é rejeitado por falta de `DISCIPLINA`/`ATIVIDADE`.

- [ ] **Step 3: Ligar o dispatch em `eap_import.py`**

Em `backend/buildflow/configuracoes/eap_import.py`, adicionar ao import:

```python
from . import eap_import_hierarquico
```

Substituir a função `importar_eap_de_arquivo` por:

```python
def importar_eap_de_arquivo(projeto, arquivo) -> ResultadoImportacaoEap:
    if arquivo.size > MAX_EAP_IMPORT_BYTES:
        msg = str(_("Arquivo excede o tamanho máximo permitido (5 MB)."))
        raise ArquivoInvalido(msg)

    if projeto.disciplinas.filter(pai__isnull=True).exists():
        msg = str(
            _(
                "Este projeto já possui uma EAP. Import só é permitido em "
                "projetos sem disciplinas cadastradas.",
            ),
        )
        raise ArquivoInvalido(msg)

    planilhas = _ler_planilhas_brutas(arquivo)

    resultado_hierarquico = eap_import_hierarquico.localizar_cabecalho(planilhas)
    if resultado_hierarquico is not None:
        _nome_aba, linhas, indice_cabecalho, colunas = resultado_hierarquico
        return eap_import_hierarquico.importar(
            projeto, planilhas, linhas, indice_cabecalho, colunas,
        )

    linhas, indice_cabecalho, colunas = _localizar_cabecalho_em_planilhas(planilhas)
    linhas_validas, erros = _validar_linhas(linhas, indice_cabecalho, colunas)
    if erros:
        raise LinhasInvalidas(erros)

    return _criar_disciplinas_e_servicos(projeto, linhas_validas)
```

Atualizar a mensagem de erro final em `_localizar_cabecalho_em_planilhas` (a função em si não muda de outra forma):

```python
    msg = str(
        _(
            "Cabeçalho não encontrado ou incompleto. Colunas obrigatórias: "
            "DISCIPLINA, ATIVIDADE, UN/UNIDADE, TOTAL/QUANTIDADE (formato de "
            "2 níveis) ou CÓDIGO, TASK NAME, UNIDADE, QUANTIDADE (formato "
            "hierárquico).",
        ),
    )
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib buildflow/configuracoes/tests/test_eap_import.py buildflow/configuracoes/tests/test_api.py -v`
Expected: todos passam, incluindo os 2 novos.

- [ ] **Step 5: Rodar a suíte completa do backend**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest --ds=config.settings.test --reuse-db --import-mode=importlib`
Expected: todos os testes passam, nenhuma regressão (formato antigo continua funcionando).

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/configuracoes/eap_import.py backend/buildflow/configuracoes/tests/test_eap_import.py backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: liga deteccao automatica do formato hierarquico ao endpoint de importacao"
```

- [ ] **Step 7: Verificação manual com o arquivo real (fora do escopo automatizado)**

Antes de considerar a feature pronta pra uso: importar `MODELO IMPORTAÇÃO_rev01.xlsx` de verdade num projeto vazio (via shell do Django, chamando `eap_import.importar_eap_de_arquivo` diretamente, como já foi feito para validar o `MODELO IMPORT SOFT`) e conferir visualmente no browser — peso, datas, Gantt e `preco_unitario`/`valor_base` aparecendo corretamente na aba EAP.
