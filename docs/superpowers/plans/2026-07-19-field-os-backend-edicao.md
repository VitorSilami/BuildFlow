# Field OS Backend — Edição de Projetos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real `PATCH`/`PUT` update endpoint for `Projeto` (a capability that has been an
explicit, documented gap since the first Field OS backend plan) and a new `ultimo_rdo_data` field
so the frontend can show "last RDO date" per project — the backend half of
`docs/superpowers/specs/2026-07-19-field-os-projetos-edicao-design.md`.

**Architecture:** No new model fields, no migration — `ProjetoViewSet` gains
`mixins.UpdateModelMixin`, and the same fields already writable on create become writable on
update (protected by the same `read_only_fields` that already exist). The "most recent RDO date"
logic currently lives inline inside `DashboardView`; it's extracted into a shared
`obter_ultima_data_rdo()` function in `services.py` so both the dashboard and the new serializer
field use one implementation.

**Tech Stack:** Django 6, DRF, `pytest`/`pytest-django`, `factory_boy`.

## Global Constraints

- Empresa/tenant isolation (Princípio I): editing a project belonging to another empresa must
  return 404 — never 403, never a partial/silent no-op — matching the existing `retrieve` behavior
  exactly (`TenantScopedViewSetMixin.get_queryset()` already scopes by empresa, so this is
  automatic as long as no view code bypasses it).
- `empresa`, `criado_por`, `execucao_percentual`, and the new `ultimo_rdo_data` must never be
  writable — never trust a client-supplied value for any of them, on create OR on update.
- `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest --cov` and
  `uv run ruff check && uv run ruff format --check` must pass after every task.
- Commit messages in Portuguese, imperative, explaining why.
- No new migration in this plan — every change here is view/serializer/service logic only.

---

### Task 1: Endpoint de edição (`PATCH`/`PUT /api/v1/projetos/{id}/`)

**Files:**
- Modify: `backend/buildflow/projetos/views.py`
- Test: `backend/buildflow/projetos/tests/test_api.py`

**Interfaces:**
- Produces: `PATCH`/`PUT /api/v1/projetos/{id}/` accepting the same writable fields as `POST`
  (`nome`, `descricao`, `numero_contrato`, `trecho`, `engenheiro_responsavel`, `status`).

- [ ] **Step 1: Write the failing tests**

Add to `backend/buildflow/projetos/tests/test_api.py`:
```python
def test_atualizar_projeto_altera_campos_editaveis():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(empresa=empresa, nome="Projeto Original", criado_por=usuario)

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
    projeto = Projeto.objects.create(empresa=empresa, nome="Projeto X", criado_por=usuario)

    response = _authenticated_client(usuario).patch(
        f"{PROJETOS_URL}{projeto.id}/",
        {"empresa": str(outra_empresa.id)},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK
    projeto.refresh_from_db()
    assert projeto.empresa_id == empresa.id  # nunca a empresa enviada no payload


def test_atualizar_projeto_de_outra_empresa_retorna_404():
    empresa_a = EmpresaFactory()
    usuario_a = UsuarioFactory(empresa=empresa_a)
    empresa_b = EmpresaFactory()
    usuario_b = UsuarioFactory(empresa=empresa_b)
    projeto_b = Projeto.objects.create(empresa=empresa_b, nome="Projeto B", criado_por=usuario_b)

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_api.py -k atualizar -v
```
Expected: FAIL — all 4 with `405 Method Not Allowed` (`PATCH` isn't wired to any handler yet).

- [ ] **Step 3: Add `UpdateModelMixin`**

The current `backend/buildflow/projetos/views.py` reads (relevant part):
```python
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
Change the class's base list to add `mixins.UpdateModelMixin` (no other change needed — the
existing `get_queryset()` override from `TenantScopedViewSetMixin` already scopes both `retrieve`
and `update`/`partial_update` to the requesting user's empresa, and `empresa`/`criado_por` are
already `read_only_fields` on `ProjetoSerializer`, so they're already protected from being
overwritten via `PATCH`):
```python
class ProjetoViewSet(
    TenantScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = ProjetoSerializer
    queryset = Projeto.objects.all()

    def perform_create(self, serializer):
        # Principio I: empresa e criado_por sempre derivados do usuario
        # autenticado, nunca aceitos do payload do cliente.
        serializer.save(empresa=self.request.user.empresa, criado_por=self.request.user)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_api.py -v
```
Expected: PASS, all tests in the file (the 4 new ones plus every pre-existing test — adding
`UpdateModelMixin` must not change any create/list/retrieve behavior).

- [ ] **Step 5: Commit**

```bash
git add backend/buildflow/projetos/views.py backend/buildflow/projetos/tests/test_api.py
git commit -m "feat: adiciona endpoint de edicao (PATCH) para Projeto"
```

---

### Task 2: Campo `ultimo_rdo_data`

**Files:**
- Modify: `backend/buildflow/projetos/services.py`
- Modify: `backend/buildflow/projetos/views.py`
- Modify: `backend/buildflow/projetos/serializers.py`
- Test: `backend/buildflow/projetos/tests/test_api.py`

**Interfaces:**
- Produces: `obter_ultima_data_rdo(projeto: Projeto) -> date | None` in
  `buildflow.projetos.services` — consumed by both `DashboardView` and `ProjetoSerializer`.
  `ProjetoSerializer`'s output gains `"ultimo_rdo_data"` (ISO date string or `null`).

- [ ] **Step 1: Write the failing tests**

Add to `backend/buildflow/projetos/tests/test_api.py`:
```python
def test_ultimo_rdo_data_reflete_registro_mais_recente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(empresa=empresa, nome="Projeto Com RDO", criado_por=usuario)
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
    item = next(
        r for r in response.json()["results"] if r["nome"] == "Projeto Com RDO"
    )
    assert item["ultimo_rdo_data"] == "2026-07-10"


def test_ultimo_rdo_data_e_null_sem_nenhum_rdo():
    usuario = UsuarioFactory()
    Projeto.objects.create(empresa=usuario.empresa, nome="Projeto Sem RDO", criado_por=usuario)

    response = _authenticated_client(usuario).get(PROJETOS_URL)

    assert response.status_code == HTTPStatus.OK
    item = next(
        r for r in response.json()["results"] if r["nome"] == "Projeto Sem RDO"
    )
    assert item["ultimo_rdo_data"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_api.py -k ultimo_rdo -v
```
Expected: FAIL — `KeyError: 'ultimo_rdo_data'`, field doesn't exist in the response yet.

- [ ] **Step 3: Extract `obter_ultima_data_rdo` in `services.py`**

The current `backend/buildflow/projetos/services.py` reads:
```python
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import Sum

from buildflow.configuracoes.models import MetaMensal
from buildflow.registros_diarios.models import ProducaoDiaria

if TYPE_CHECKING:
    from .models import Projeto


def calcular_execucao_percentual(projeto: Projeto) -> Decimal | None:
    ...


def decimal_para_str_ou_none(valor: Decimal | None) -> str | None:
    return str(valor) if valor is not None else None
```

Add a `date` import and the new function at the end of the file:
```python
from __future__ import annotations

import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import Sum

from buildflow.configuracoes.models import MetaMensal
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario

if TYPE_CHECKING:
    from .models import Projeto


def calcular_execucao_percentual(projeto: Projeto) -> Decimal | None:
    ...
    (unchanged — keep the existing function body exactly as-is)


def decimal_para_str_ou_none(valor: Decimal | None) -> str | None:
    return str(valor) if valor is not None else None


def obter_ultima_data_rdo(projeto: Projeto) -> datetime.date | None:
    """Data do RegistroDiario mais recente do projeto, ou None se nunca houve
    nenhum — mesma regra de nunca inventar dado: ausencia de RDO e ausencia
    de valor, nao uma data arbitraria.
    """
    ultimo = (
        RegistroDiario.objects.filter(projeto=projeto)
        .order_by("-data_referencia")
        .first()
    )
    return ultimo.data_referencia if ultimo is not None else None
```
(Only the import block and the new function at the bottom change — do not touch the body of
`calcular_execucao_percentual` or `decimal_para_str_ou_none`.)

- [ ] **Step 4: Use the shared function in `DashboardView` and add the serializer field**

The current `backend/buildflow/projetos/views.py` reads:
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
from .services import decimal_para_str_ou_none

DIAS_LIMITE_ALERTA_RDO = 7


class ProjetoViewSet(
    ...
):
    ...


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
                    "execucao_percentual": decimal_para_str_ou_none(execucao),
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
                "execucao_media": decimal_para_str_ou_none(execucao_media),
                "projetos": projetos_payload,
                "alertas": alertas,
            },
        )
```

Change the imports (drop the now-unused direct `RegistroDiario` import, add
`obter_ultima_data_rdo`) and the alertas loop:
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

from .models import Projeto
from .serializers import ProjetoSerializer
from .services import calcular_execucao_percentual
from .services import decimal_para_str_ou_none
from .services import obter_ultima_data_rdo

DIAS_LIMITE_ALERTA_RDO = 7


class ProjetoViewSet(
    ...
):
    ...


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
                    "execucao_percentual": decimal_para_str_ou_none(execucao),
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
            ultima_data = obter_ultima_data_rdo(projeto)
            if ultima_data is None or ultima_data < limite:
                dias_sem_rdo = (hoje - ultima_data).days if ultima_data is not None else None
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
                "execucao_media": decimal_para_str_ou_none(execucao_media),
                "projetos": projetos_payload,
                "alertas": alertas,
            },
        )
```
(`ProjetoViewSet`'s body is unchanged from Task 1 — keep it exactly as it is, only the imports and
`DashboardView` change here.)

Now edit `backend/buildflow/projetos/serializers.py`, which currently reads:
```python
from rest_framework import serializers

from .models import Projeto
from .services import calcular_execucao_percentual
from .services import decimal_para_str_ou_none


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
        return decimal_para_str_ou_none(valor)

    def validate_nome(self, value: str) -> str:
        # FR-016: rejeitar nome vazio ou composto somente por espacos.
        if not value.strip():
            msg = "O nome do projeto não pode ser vazio."
            raise serializers.ValidationError(msg)
        return value.strip()
```

Change it to:
```python
from rest_framework import serializers

from .models import Projeto
from .services import calcular_execucao_percentual
from .services import decimal_para_str_ou_none
from .services import obter_ultima_data_rdo


class ProjetoSerializer(serializers.ModelSerializer):
    execucao_percentual = serializers.SerializerMethodField()
    ultimo_rdo_data = serializers.SerializerMethodField()

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
            "ultimo_rdo_data",
            "criado_por",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "criado_por", "created_at", "updated_at"]

    def get_execucao_percentual(self, obj: Projeto) -> str | None:
        valor = calcular_execucao_percentual(obj)
        return decimal_para_str_ou_none(valor)

    def get_ultimo_rdo_data(self, obj: Projeto) -> str | None:
        data = obter_ultima_data_rdo(obj)
        return data.isoformat() if data is not None else None

    def validate_nome(self, value: str) -> str:
        # FR-016: rejeitar nome vazio ou composto somente por espacos.
        if not value.strip():
            msg = "O nome do projeto não pode ser vazio."
            raise serializers.ValidationError(msg)
        return value.strip()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/ -v
```
Expected: PASS, every test in `buildflow/projetos/` — including `test_dashboard.py`'s existing
tests (the alertas logic changed internally but must produce identical results, since
`obter_ultima_data_rdo` returns the exact same date the old inline query did).

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/projetos/services.py backend/buildflow/projetos/views.py backend/buildflow/projetos/serializers.py backend/buildflow/projetos/tests/test_api.py
git commit -m "feat: adiciona ultimo_rdo_data ao Projeto e extrai busca de ultimo RDO para services.py"
```

---

### Task 3: Verificação final

**Files:** none expected beyond possible small fixes found during verification.

- [ ] **Step 1: Suíte completa + lint**

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest --cov
uv run ruff check
uv run ruff format --check
```
Expected: every command exits 0, no regressions in any other app's tests (this plan only touches
`projetos/`, but `registros_diarios` tests exercise the same `RegistroDiario` model — confirm they
still pass unaffected).

- [ ] **Step 2: Atualizar `specs/001-mvp-gestao-diaria/tasks.md`**

Append an entry documenting this backend work:
```markdown

**Backend do "Field OS" — Edição de Projetos (2026-07-19)**: `ProjetoViewSet` ganha
`UpdateModelMixin` (`PATCH`/`PUT /api/v1/projetos/{id}/`), aceitando os mesmos campos já graváveis
na criação (`empresa`/`criado_por` continuam protegidos via `read_only_fields`, isolamento
multitenant automático via `TenantScopedViewSetMixin`). Novo campo `ultimo_rdo_data` no
`ProjetoSerializer` (data do RDO mais recente do projeto, ou `null`) — a busca de "último RDO",
antes inline em `DashboardView`, foi extraída para `obter_ultima_data_rdo()` em
`projetos/services.py` e reaproveitada nos dois lugares. Sem migration nova. Frontend consumidor
fica para um plano separado (`docs/superpowers/plans/2026-07-19-field-os-frontend-projetos-v2.md`,
quando escrito).

**Verificado**: suíte pytest completa + ruff limpos.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra edicao de projetos do Field OS backend em tasks.md"
```
