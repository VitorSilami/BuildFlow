# Field OS Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `Projeto` with 4 real fields (contrato, trecho, engenheiro responsável, status),
compute `% execução` from existing `MetaMensal`/`ProducaoDiaria` data (never invented), and expose
a new `GET /api/v1/dashboard/` aggregation endpoint — the backend foundation the "Field OS"
frontend redesign (a separate, later plan) will consume.

**Architecture:** All new logic lives in the existing `projetos` app (no new Django app — YAGNI, per
the design doc's decision). A pure, testable calculation function computes execução; the
serializer exposes it as a read-only field; a plain DRF `APIView` (not a ViewSet — this isn't a
CRUD resource) aggregates across a company's projects for the dashboard.

**Tech Stack:** Django 6, DRF, `pytest`/`pytest-django` (pinned `8.4.2`), `factory_boy`.

## Global Constraints

- Empresa/tenant isolation (Princípio I) applies to every new query — never trust a client-supplied
  identifier, always scope through `TenantScopedManager.for_empresa(request.user.empresa)` or the
  existing `TenantScopedViewSetMixin`.
- TDD is mandatory per this project's testing rules: write the failing test, confirm it fails, then
  implement, per task below.
- `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest --cov` and
  `uv run ruff check && uv run ruff format --check` must pass after every task.
- Commit messages in Portuguese, imperative, explaining why.
- The 4 new `Projeto` fields are all optional (`blank=True`) — existing projects and the existing
  create-project flow (name-only) must keep working unchanged.
- `% execução` is `Decimal | None` — `None` when there's no basis to compute it (no metas, or no
  meta with a `peso_percentual` set for this project). Never return `0` as a stand-in for "unknown."

---

### Task 1: Adicionar campos novos ao `Projeto`

**Files:**
- Modify: `backend/buildflow/projetos/models.py`
- Create: `backend/buildflow/projetos/migrations/0003_*.py` (exact name chosen by Django, generated
  via `manage.py makemigrations`, not hand-written)
- Modify: `backend/buildflow/projetos/serializers.py`
- Test: `backend/buildflow/projetos/tests/test_api.py`

**Interfaces:**
- Produces: `Projeto.numero_contrato: str` (blank), `Projeto.trecho: str` (blank),
  `Projeto.engenheiro_responsavel: str` (blank), `Projeto.status: str` (choices, default
  `"ativo"`), and `Projeto.StatusChoices` (a `TextChoices` class with `ATIVO = "ativo"`,
  `PAUSADO = "pausado"`, `CONCLUIDO = "concluido"`). `ProjetoSerializer` now includes these 4
  fields as writable-optional.

- [ ] **Step 1: Write the failing test**

Add to `backend/buildflow/projetos/tests/test_api.py`:
```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_api.py -k "campos_novos or status_ativo" -v
```
Expected: FAIL — `numero_contrato`/`trecho`/`engenheiro_responsavel`/`status` don't exist on
`Projeto` yet, or the serializer silently ignores them (either way, the assertions fail).

- [ ] **Step 3: Add the fields to the model**

The current `backend/buildflow/projetos/models.py` reads:
```python
class Projeto(models.Model):
    """Obra gerenciada por uma empresa (FR-014 a FR-018).

    Pulled para a fase Foundational (em vez de US3) porque Disciplina,
    Unidade e demais cadastros compartilhados dependem de Projeto — ver nota
    de correcao em tasks.md.
    """

    tenant_path = "empresa"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        Empresa,
        verbose_name=_("empresa"),
        on_delete=models.CASCADE,
        related_name="projetos",
    )
    nome = models.CharField(_("nome"), max_length=255)
    descricao = models.TextField(_("breve descricao"), blank=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("criado por"),
        on_delete=models.PROTECT,
        related_name="projetos_criados",
    )
    created_at = models.DateTimeField(_("criado em"), auto_now_add=True)
    updated_at = models.DateTimeField(_("atualizado em"), auto_now=True)

    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("projeto")
        verbose_name_plural = _("projetos")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.nome
```

Add a `StatusChoices` inner class right after `tenant_path = "empresa"`, and the 4 new fields right
after `descricao`, so the class body becomes:
```python
class Projeto(models.Model):
    """Obra gerenciada por uma empresa (FR-014 a FR-018).

    Pulled para a fase Foundational (em vez de US3) porque Disciplina,
    Unidade e demais cadastros compartilhados dependem de Projeto — ver nota
    de correcao em tasks.md.
    """

    tenant_path = "empresa"

    class StatusChoices(models.TextChoices):
        ATIVO = "ativo", _("Ativo")
        PAUSADO = "pausado", _("Pausado")
        CONCLUIDO = "concluido", _("Concluído")

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(
        Empresa,
        verbose_name=_("empresa"),
        on_delete=models.CASCADE,
        related_name="projetos",
    )
    nome = models.CharField(_("nome"), max_length=255)
    descricao = models.TextField(_("breve descricao"), blank=True)
    numero_contrato = models.CharField(_("número do contrato"), max_length=100, blank=True)
    trecho = models.CharField(_("trecho"), max_length=255, blank=True)
    engenheiro_responsavel = models.CharField(
        _("engenheiro responsável"),
        max_length=255,
        blank=True,
    )
    status = models.CharField(
        _("status"),
        max_length=16,
        choices=StatusChoices.choices,
        default=StatusChoices.ATIVO,
    )
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name=_("criado por"),
        on_delete=models.PROTECT,
        related_name="projetos_criados",
    )
    created_at = models.DateTimeField(_("criado em"), auto_now_add=True)
    updated_at = models.DateTimeField(_("atualizado em"), auto_now=True)

    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("projeto")
        verbose_name_plural = _("projetos")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.nome
```

- [ ] **Step 4: Generate and apply the migration**

```bash
cd backend
export DJANGO_SETTINGS_MODULE=config.settings.local
uv run python manage.py makemigrations projetos
uv run python manage.py migrate
```
Expected: a new file `buildflow/projetos/migrations/0003_*.py` is created (exact name chosen by
Django, e.g. `0003_projeto_numero_contrato_projeto_status_and_more.py`), and `migrate` applies it
without error.

- [ ] **Step 5: Add the fields to the serializer**

In `backend/buildflow/projetos/serializers.py`, change:
```python
        fields = ["id", "nome", "descricao", "criado_por", "created_at", "updated_at"]
```
to:
```python
        fields = [
            "id",
            "nome",
            "descricao",
            "numero_contrato",
            "trecho",
            "engenheiro_responsavel",
            "status",
            "criado_por",
            "created_at",
            "updated_at",
        ]
```
(`read_only_fields` stays exactly as-is — the 4 new fields are meant to be writable on
create/update, same as `nome`/`descricao`.)

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_api.py -v
```
Expected: PASS, all tests in the file (including the 2 new ones and every pre-existing one — the
new fields being optional must not break `test_criar_projeto_atribui_empresa_e_criado_por_automaticamente`
or any other existing test).

- [ ] **Step 7: Commit**

```bash
git add backend/buildflow/projetos/models.py backend/buildflow/projetos/migrations backend/buildflow/projetos/serializers.py backend/buildflow/projetos/tests/test_api.py
git commit -m "feat: adiciona numero_contrato, trecho, engenheiro_responsavel e status ao Projeto"
```

---

### Task 2: Calcular `% execução` a partir de Metas x Produção

**Files:**
- Create: `backend/buildflow/projetos/services.py`
- Test: `backend/buildflow/projetos/tests/test_execucao.py`

**Interfaces:**
- Consumes: `Projeto` (Task 1), `MetaMensal`, `ProducaoDiaria` (existing models in
  `buildflow.configuracoes.models` / `buildflow.registros_diarios.models`).
- Produces: `calcular_execucao_percentual(projeto: Projeto) -> Decimal | None` — Task 3 imports and
  calls this exact function name/signature from `buildflow.projetos.services`.

- [ ] **Step 1: Write the failing tests**

Create `backend/buildflow/projetos/tests/test_execucao.py`:
```python
from decimal import Decimal

import pytest

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import MetaMensal
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto
from buildflow.projetos.services import calcular_execucao_percentual
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario

pytestmark = pytest.mark.django_db


def _criar_projeto() -> Projeto:
    usuario = UsuarioFactory()
    return Projeto.objects.create(
        empresa=usuario.empresa,
        nome="Projeto Teste",
        criado_por=usuario,
    )


def test_sem_metas_retorna_none():
    projeto = _criar_projeto()

    assert calcular_execucao_percentual(projeto) is None


def test_meta_sem_peso_percentual_nao_conta_e_retorna_none():
    projeto = _criar_projeto()
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disciplina,
        unidade=unidade,
        valor_alvo=Decimal("1000"),
        peso_percentual=None,
    )

    assert calcular_execucao_percentual(projeto) is None


def test_uma_disciplina_com_peso_calcula_percentual_direto():
    projeto = _criar_projeto()
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
        fiscal=projeto.criado_por,
        autor=projeto.criado_por,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("500"),
        unidade=unidade,
    )

    # 500 / 1000 = 50%, unica disciplina com peso 100 -> media ponderada = 50%
    assert calcular_execucao_percentual(projeto) == Decimal("50.00")


def test_producao_em_unidade_diferente_da_meta_nao_conta():
    projeto = _criar_projeto()
    unidade_m3 = Unidade.objects.create(sigla="m³", descricao="metro cúbico")
    unidade_m2 = Unidade.objects.create(sigla="m²", descricao="metro quadrado")
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade_m2,
    )
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disciplina,
        unidade=unidade_m3,
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
        fiscal=projeto.criado_por,
        autor=projeto.criado_por,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("500"),
        unidade=unidade_m2,  # unidade da producao != unidade da meta (m3)
    )

    # producao em m2 nao conta para meta em m3 -> 0 produzido / 1000 = 0%
    assert calcular_execucao_percentual(projeto) == Decimal("0.00")


def test_duas_disciplinas_pesos_diferentes_media_ponderada():
    projeto = _criar_projeto()
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")

    disc_a = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    serv_a = CatalogoServico.objects.create(disciplina=disc_a, nome="Corte", unidade=unidade)
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disc_a,
        unidade=unidade,
        valor_alvo=Decimal("1000"),
        peso_percentual=Decimal("75"),
    )

    disc_b = Disciplina.objects.create(projeto=projeto, nome="Pavimentação")
    serv_b = CatalogoServico.objects.create(disciplina=disc_b, nome="Base", unidade=unidade)
    MetaMensal.objects.create(
        projeto=projeto,
        disciplina=disc_b,
        unidade=unidade,
        valor_alvo=Decimal("200"),
        peso_percentual=Decimal("25"),
    )

    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    registro = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=projeto.criado_por,
        autor=projeto.criado_por,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disc_a,
        servico=serv_a,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("1000"),  # disc_a: 100% de 1000
        unidade=unidade,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disc_b,
        servico=serv_b,
        km_inicial="0.000",
        km_final="1.000",
        quantidade=Decimal("100"),  # disc_b: 50% de 200
        unidade=unidade,
    )

    # (100% * 75 + 50% * 25) / (75 + 25) = (75 + 12.5) / 100 = 87.5%
    assert calcular_execucao_percentual(projeto) == Decimal("87.50")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v
```
Expected: FAIL — `buildflow.projetos.services` doesn't exist yet (`ModuleNotFoundError` or
`ImportError`).

- [ ] **Step 3: Implement `calcular_execucao_percentual`**

Create `backend/buildflow/projetos/services.py`:
```python
from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum

from buildflow.configuracoes.models import MetaMensal
from buildflow.registros_diarios.models import ProducaoDiaria

from .models import Projeto


def calcular_execucao_percentual(projeto: Projeto) -> Decimal | None:
    """Media ponderada (por MetaMensal.peso_percentual) do avanco de cada
    disciplina do projeto: soma(ProducaoDiaria.quantidade) na mesma unidade
    da meta, dividido pelo valor_alvo. Retorna None quando nao ha base real
    para calcular (sem metas, ou nenhuma meta com peso definido) — nunca
    inventa um numero.
    """
    metas = MetaMensal.objects.filter(
        projeto=projeto,
        peso_percentual__isnull=False,
    ).select_related("disciplina", "unidade")

    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")

    for meta in metas:
        se_peso = meta.peso_percentual
        producao_total = ProducaoDiaria.objects.filter(
            registro_diario__projeto=projeto,
            disciplina=meta.disciplina,
            unidade=meta.unidade,
        ).aggregate(total=Sum("quantidade"))["total"] or Decimal("0")

        avanco_disciplina = (
            (producao_total / meta.valor_alvo * Decimal("100"))
            if meta.valor_alvo
            else Decimal("0")
        )

        soma_ponderada += avanco_disciplina * se_peso
        soma_pesos += se_peso

    if soma_pesos == 0:
        return None

    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v
```
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/buildflow/projetos/services.py backend/buildflow/projetos/tests/test_execucao.py
git commit -m "feat: calcula percentual de execucao do projeto a partir de metas e producao real"
```

---

### Task 3: Expor `execucao_percentual` no serializer

**Files:**
- Modify: `backend/buildflow/projetos/serializers.py`
- Test: `backend/buildflow/projetos/tests/test_api.py`

**Interfaces:**
- Consumes: `calcular_execucao_percentual` (Task 2).
- Produces: `ProjetoSerializer`'s output now includes `"execucao_percentual"` (string-serialized
  decimal, e.g. `"50.00"`, or `null`).

- [ ] **Step 1: Write the failing test**

Add to `backend/buildflow/projetos/tests/test_api.py`:
```python
def test_lista_projetos_inclui_execucao_percentual_calculada():
    from decimal import Decimal

    from buildflow.configuracoes.models import CatalogoServico
    from buildflow.configuracoes.models import Disciplina
    from buildflow.configuracoes.models import Equipe
    from buildflow.configuracoes.models import MetaMensal
    from buildflow.configuracoes.models import Unidade
    from buildflow.registros_diarios.models import ProducaoDiaria
    from buildflow.registros_diarios.models import RegistroDiario

    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(empresa=empresa, nome="Projeto Com Meta", criado_por=usuario)
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(disciplina=disciplina, nome="Corte", unidade=unidade)
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
    item = next(r for r in response.json()["results"] if r["nome"] == "Projeto Com Meta")
    assert item["execucao_percentual"] == "25.00"


def test_projeto_sem_meta_retorna_execucao_percentual_null():
    usuario = UsuarioFactory()
    Projeto.objects.create(empresa=usuario.empresa, nome="Projeto Sem Meta", criado_por=usuario)

    response = _authenticated_client(usuario).get(PROJETOS_URL)

    assert response.status_code == HTTPStatus.OK
    item = next(r for r in response.json()["results"] if r["nome"] == "Projeto Sem Meta")
    assert item["execucao_percentual"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_api.py -k execucao_percentual -v
```
Expected: FAIL — `KeyError: 'execucao_percentual'`, field doesn't exist in the response yet.

- [ ] **Step 3: Add the field to the serializer**

In `backend/buildflow/projetos/serializers.py`:
```python
from rest_framework import serializers

from .models import Projeto
from .services import calcular_execucao_percentual


class ProjetoSerializer(serializers.ModelSerializer):
    execucao_percentual = serializers.SerializerMethodField()

    class Meta:
        model = Projeto
        fields = [
            "id",
            "nome",
            "descricao",
            "numero_contrato",
            "trecho",
            "engenheiro_responsavel",
            "status",
            "execucao_percentual",
            "criado_por",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "criado_por", "created_at", "updated_at"]

    def get_execucao_percentual(self, obj: Projeto) -> str | None:
        valor = calcular_execucao_percentual(obj)
        return str(valor) if valor is not None else None

    def validate_nome(self, value: str) -> str:
        # FR-016: rejeitar nome vazio ou composto somente por espacos.
        if not value.strip():
            msg = "O nome do projeto não pode ser vazio."
            raise serializers.ValidationError(msg)
        return value.strip()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_api.py -v
```
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add backend/buildflow/projetos/serializers.py backend/buildflow/projetos/tests/test_api.py
git commit -m "feat: expoe execucao_percentual calculada na listagem de projetos"
```

---

### Task 4: Endpoint de dashboard

**Files:**
- Modify: `backend/buildflow/projetos/views.py`
- Modify: `backend/config/api_router.py`
- Test: `backend/buildflow/projetos/tests/test_dashboard.py`

**Interfaces:**
- Consumes: `Projeto.StatusChoices` (Task 1), `calcular_execucao_percentual` (Task 2),
  `IsAuthenticatedWithEmpresa` (`buildflow.core.permissions`, existing).
- Produces: `GET /api/v1/dashboard/` returning:
```json
{
  "projetos_ativos": 2,
  "projetos_pausados": 1,
  "projetos_concluidos": 0,
  "execucao_media": "62.50",
  "projetos": [
    {"id": "...", "nome": "...", "status": "ativo", "execucao_percentual": "50.00"}
  ],
  "alertas": [
    {"projeto_id": "...", "projeto_nome": "...", "dias_sem_rdo": 9}
  ]
}
```
  `execucao_media` is `null` when there are no active projects with a computable execução (same
  "never invent a number" rule as Task 2). `alertas` lists active projects with no `RegistroDiario`
  in the last 7 days (`DIAS_LIMITE_ALERTA_RDO = 7`, a named constant — not a magic number).

- [ ] **Step 1: Write the failing tests**

Create `backend/buildflow/projetos/tests/test_dashboard.py`:
```python
import datetime
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

DASHBOARD_URL = "/api/v1/dashboard/"


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def test_conta_projetos_por_status():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    Projeto.objects.create(empresa=empresa, nome="Ativo 1", criado_por=usuario, status="ativo")
    Projeto.objects.create(empresa=empresa, nome="Ativo 2", criado_por=usuario, status="ativo")
    Projeto.objects.create(empresa=empresa, nome="Pausado", criado_por=usuario, status="pausado")
    Projeto.objects.create(
        empresa=empresa,
        nome="Concluido",
        criado_por=usuario,
        status="concluido",
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["projetos_ativos"] == 2
    assert body["projetos_pausados"] == 1
    assert body["projetos_concluidos"] == 1


def test_isolamento_multitenant_no_dashboard():
    empresa_a = EmpresaFactory()
    usuario_a = UsuarioFactory(empresa=empresa_a)
    Projeto.objects.create(empresa=empresa_a, nome="Projeto A", criado_por=usuario_a)

    empresa_b = EmpresaFactory()
    usuario_b = UsuarioFactory(empresa=empresa_b)
    Projeto.objects.create(empresa=empresa_b, nome="Projeto B", criado_por=usuario_b)

    response = _authenticated_client(usuario_a).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["projetos_ativos"] == 1
    nomes = [p["nome"] for p in body["projetos"]]
    assert nomes == ["Projeto A"]


def test_execucao_media_null_quando_sem_metas():
    usuario = UsuarioFactory()
    Projeto.objects.create(empresa=usuario.empresa, nome="Sem Meta", criado_por=usuario)

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["execucao_media"] is None


def test_execucao_media_calculada_entre_projetos_ativos():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")

    projeto = Projeto.objects.create(empresa=empresa, nome="Com Meta", criado_por=usuario)
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(disciplina=disciplina, nome="Corte", unidade=unidade)
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
        quantidade=Decimal("400"),
        unidade=unidade,
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["execucao_media"] == "40.00"


def test_alerta_para_projeto_ativo_sem_rdo_recente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(empresa=empresa, nome="Atrasado", criado_por=usuario)
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=datetime.date.today() - datetime.timedelta(days=9),
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    alertas = response.json()["alertas"]
    assert len(alertas) == 1
    assert alertas[0]["projeto_nome"] == "Atrasado"
    assert alertas[0]["dias_sem_rdo"] == 9


def test_sem_alerta_para_projeto_com_rdo_recente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(empresa=empresa, nome="Em Dia", criado_por=usuario)
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=datetime.date.today() - datetime.timedelta(days=1),
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    assert response.json()["alertas"] == []


def test_anonimo_nao_acessa_dashboard():
    response = APIClient().get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.FORBIDDEN
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_dashboard.py -v
```
Expected: FAIL — `404 Not Found`, the URL doesn't exist yet.

- [ ] **Step 3: Implement `DashboardView`**

The current `backend/buildflow/projetos/views.py` reads:
```python
from rest_framework import mixins
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import TenantScopedViewSetMixin

from .models import Projeto
from .serializers import ProjetoSerializer


class ProjetoViewSet(
    TenantScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = ProjetoSerializer
    queryset = Projeto.objects.all()

    def perform_create(self, serializer):
        # Principio I: empresa e criado_por sempre derivados do usuario
        # autenticado, nunca aceitos do payload do cliente.
        serializer.save(empresa=self.request.user.empresa, criado_por=self.request.user)
```

Change the imports at the top to add the ones `DashboardView` needs, and append the new class after
`ProjetoViewSet`:
```python
import datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import TenantScopedViewSetMixin
from buildflow.registros_diarios.models import RegistroDiario

from .models import Projeto
from .serializers import ProjetoSerializer
from .services import calcular_execucao_percentual

DIAS_LIMITE_ALERTA_RDO = 7


class ProjetoViewSet(
    TenantScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = ProjetoSerializer
    queryset = Projeto.objects.all()

    def perform_create(self, serializer):
        # Principio I: empresa e criado_por sempre derivados do usuario
        # autenticado, nunca aceitos do payload do cliente.
        serializer.save(empresa=self.request.user.empresa, criado_por=self.request.user)


class DashboardView(APIView):
    permission_classes = (IsAuthenticatedWithEmpresa,)

    def get(self, request, *args, **kwargs):
        empresa = request.user.empresa
        projetos = Projeto.objects.for_empresa(empresa)

        projetos_ativos = projetos.filter(status=Projeto.StatusChoices.ATIVO)

        execucoes = []
        projetos_payload = []
        for projeto in projetos_ativos:
            execucao = calcular_execucao_percentual(projeto)
            if execucao is not None:
                execucoes.append(execucao)
            projetos_payload.append(
                {
                    "id": str(projeto.id),
                    "nome": projeto.nome,
                    "status": projeto.status,
                    "execucao_percentual": str(execucao) if execucao is not None else None,
                },
            )

        execucao_media = (
            (sum(execucoes) / len(execucoes)).quantize(Decimal("0.01"))
            if execucoes
            else None
        )

        hoje = timezone.now().date()
        limite = hoje - datetime.timedelta(days=DIAS_LIMITE_ALERTA_RDO)
        alertas = []
        for projeto in projetos_ativos:
            ultimo_rdo = (
                RegistroDiario.objects.filter(projeto=projeto)
                .order_by("-data_referencia")
                .first()
            )
            if ultimo_rdo is None or ultimo_rdo.data_referencia < limite:
                dias_sem_rdo = (
                    (hoje - ultimo_rdo.data_referencia).days
                    if ultimo_rdo is not None
                    else None
                )
                alertas.append(
                    {
                        "projeto_id": str(projeto.id),
                        "projeto_nome": projeto.nome,
                        "dias_sem_rdo": dias_sem_rdo,
                    },
                )

        return Response(
            {
                "projetos_ativos": projetos_ativos.count(),
                "projetos_pausados": projetos.filter(
                    status=Projeto.StatusChoices.PAUSADO,
                ).count(),
                "projetos_concluidos": projetos.filter(
                    status=Projeto.StatusChoices.CONCLUIDO,
                ).count(),
                "execucao_media": str(execucao_media) if execucao_media is not None else None,
                "projetos": projetos_payload,
                "alertas": alertas,
            },
        )
```

- [ ] **Step 4: Wire the URL**

In `backend/config/api_router.py`, change:
```python
from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from buildflow.projetos.views import ProjetoViewSet
from buildflow.usuarios.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("users", UserViewSet)
router.register("projetos", ProjetoViewSet, basename="projeto")


app_name = "api"
urlpatterns = router.urls
```
to:
```python
from django.conf import settings
from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from buildflow.projetos.views import DashboardView
from buildflow.projetos.views import ProjetoViewSet
from buildflow.usuarios.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("users", UserViewSet)
router.register("projetos", ProjetoViewSet, basename="projeto")


app_name = "api"
urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    *router.urls,
]
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_dashboard.py -v
```
Expected: PASS, all 7 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/projetos/views.py backend/config/api_router.py backend/buildflow/projetos/tests/test_dashboard.py
git commit -m "feat: adiciona endpoint de dashboard agregando projetos por status e alertas de RDO"
```

---

### Task 5: Verificação final

**Files:** none expected beyond possible small fixes found during verification.

- [ ] **Step 1: Suíte completa + lint**

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest --cov
uv run ruff check
uv run ruff format --check
```
Expected: every command exits 0. Coverage stays ≥ 80% (project convention) — the new
`services.py`/`views.py` code is fully exercised by Tasks 2-4's tests, so this should hold without
extra work.

- [ ] **Step 2: Atualizar `specs/001-mvp-gestao-diaria/tasks.md`**

Append an entry documenting this backend work, following the project's existing traceability
convention (see the "Refatoração do frontend..." entry added previously in the same file):
```markdown

**Backend do "Field OS" (2026-07-18)**: `Projeto` ganha `numero_contrato`, `trecho`,
`engenheiro_responsavel` e `status` (todos opcionais, migration `0003`). Novo
`calcular_execucao_percentual` (`buildflow/projetos/services.py`) computa `% execução` a partir de
`MetaMensal.peso_percentual` x `ProducaoDiaria.quantidade` real — nunca inventado, retorna `None`
quando não há base de cálculo. Novo endpoint `GET /api/v1/dashboard/` agrega projetos por status,
execução média e alertas de RDO atrasado (>7 dias). Frontend consumidor fica para um plano
separado (`docs/superpowers/plans/2026-07-18-field-os-frontend.md`, quando escrito).

**Verificado**: suíte pytest completa + ruff limpos.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra backend do Field OS em tasks.md"
```
