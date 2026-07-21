# Field OS — Conclusão (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar os dois recursos de backend que o Dashboard-com-gráficos e o Calendário de
Registros Diários (frontend) vão consumir: contagem de RDOs por dia (últimos 7 dias) no endpoint
de dashboard, e filtro por mês (sem paginação) no endpoint de listagem de RDOs.

**Architecture:** Duas mudanças isoladas e independentes uma da outra: (1) nova função de serviço
`obter_atividade_rdo_semana` em `buildflow/projetos/services.py`, consumida por `DashboardView`;
(2) filtro `?mes=YYYY-MM` em `RegistroDiarioViewSet.get_queryset`/`list`, que desativa a paginação
só quando o parâmetro está presente. Nenhum endpoint novo, nenhuma migração.

**Tech Stack:** Django 6, DRF, pytest, factory_boy (mesma stack já usada no projeto).

## Global Constraints

- Nunca inventar dado: dia sem nenhum RDO aparece como `quantidade: 0` explícito (nunca omitido) —
  o gráfico de barras do frontend não pode "pular" um dia.
- Isolamento multi-tenant: toda query final é restrita à empresa do usuário autenticado (mesma
  regra já aplicada em `Projeto.objects.for_empresa()` e `TenantScopedViewSetMixin`); RDO de outra
  empresa nunca deve aparecer em `atividade_rdo` nem no filtro `?mes=`.
- Projeto de outra empresa (ou inexistente) → 404, nunca 403 (regra já documentada em
  `RegistroDiarioViewSet._get_projeto`, Principio I / FR-013 do spec).
- `?mes=` com formato inválido → `400 Bad Request` com mensagem clara, nunca `500`.
- Sem o parâmetro `?mes=`, o comportamento e formato de resposta atuais do endpoint de listagem de
  RDOs ficam 100% intactos (usado hoje por "duplicar dia anterior" no wizard de RDO).
- Nunca usar `--no-verify`; commits novos ao invés de amend.

---

### Task 1: Função de serviço `obter_atividade_rdo_semana`

**Files:**
- Modify: `backend/buildflow/projetos/services.py`
- Test: `backend/buildflow/projetos/tests/test_atividade_rdo.py` (novo)

**Interfaces:**
- Produces: `obter_atividade_rdo_semana(empresa: Empresa) -> list[dict[str, str | int]]` — lista de
  7 dicts `{"data": "YYYY-MM-DD", "quantidade": int}`, ordenados do dia mais antigo pro mais
  recente (hoje é o último item), cobrindo os projetos com `status=Projeto.StatusChoices.ATIVO` da
  empresa passada.

- [ ] **Step 1: Escrever os testes (devem falhar — função ainda não existe)**

Criar `backend/buildflow/projetos/tests/test_atividade_rdo.py`:

```python
import datetime

import pytest

from buildflow.configuracoes.models import Equipe
from buildflow.core.tests.factories import EmpresaFactory
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto
from buildflow.projetos.services import obter_atividade_rdo_semana
from buildflow.registros_diarios.models import RegistroDiario

pytestmark = pytest.mark.django_db


def _criar_rdo(projeto, equipe, usuario, data):
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=data,
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )


def test_sete_dias_preenchidos_mesmo_sem_rdo():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    Projeto.objects.create(empresa=empresa, nome="Sem RDO", criado_por=usuario, status="ativo")

    resultado = obter_atividade_rdo_semana(empresa)

    assert len(resultado) == 7  # noqa: PLR2004
    assert all(dia["quantidade"] == 0 for dia in resultado)


def test_ordenado_do_dia_mais_antigo_para_o_mais_recente():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    Projeto.objects.create(empresa=empresa, nome="Sem RDO", criado_por=usuario, status="ativo")

    resultado = obter_atividade_rdo_semana(empresa)

    datas = [dia["data"] for dia in resultado]
    assert datas == sorted(datas)
    assert datas[-1] == datetime.date.today().isoformat()  # noqa: DTZ011


def test_conta_rdos_do_dia_correto():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa, nome="Ativo", criado_por=usuario, status="ativo",
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")

    hoje = datetime.date.today()  # noqa: DTZ011
    _criar_rdo(projeto, equipe, usuario, hoje)
    _criar_rdo(projeto, equipe, usuario, hoje)  # segundo turno, mesmo dia
    _criar_rdo(projeto, equipe, usuario, hoje - datetime.timedelta(days=2))

    resultado = obter_atividade_rdo_semana(empresa)
    por_data = {dia["data"]: dia["quantidade"] for dia in resultado}

    assert por_data[hoje.isoformat()] == 2  # noqa: PLR2004
    assert por_data[(hoje - datetime.timedelta(days=2)).isoformat()] == 1


def test_ignora_rdo_de_projeto_pausado():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa, nome="Pausado", criado_por=usuario, status="pausado",
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    _criar_rdo(projeto, equipe, usuario, datetime.date.today())  # noqa: DTZ011

    resultado = obter_atividade_rdo_semana(empresa)

    assert all(dia["quantidade"] == 0 for dia in resultado)


def test_ignora_rdo_de_outra_empresa():
    empresa_a = EmpresaFactory()
    usuario_a = UsuarioFactory(empresa=empresa_a)
    Projeto.objects.create(empresa=empresa_a, nome="A", criado_por=usuario_a, status="ativo")

    empresa_b = EmpresaFactory()
    usuario_b = UsuarioFactory(empresa=empresa_b)
    projeto_b = Projeto.objects.create(
        empresa=empresa_b, nome="B", criado_por=usuario_b, status="ativo",
    )
    equipe_b = Equipe.objects.create(projeto=projeto_b, nome="Equipe B")
    _criar_rdo(projeto_b, equipe_b, usuario_b, datetime.date.today())  # noqa: DTZ011

    resultado = obter_atividade_rdo_semana(empresa_a)

    assert all(dia["quantidade"] == 0 for dia in resultado)
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_atividade_rdo.py -v`
Expected: FAIL — `ImportError: cannot import name 'obter_atividade_rdo_semana'`

- [ ] **Step 3: Implementar `obter_atividade_rdo_semana`**

Substituir o topo de `backend/buildflow/projetos/services.py` (imports) e adicionar a função no
final do arquivo:

```python
from __future__ import annotations

import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import Count
from django.db.models import Sum
from django.utils import timezone

from buildflow.configuracoes.models import MetaMensal
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario

from .models import Projeto

if TYPE_CHECKING:
    from buildflow.empresas.models import Empresa

DIAS_JANELA_ATIVIDADE = 7
```

(As funções `calcular_execucao_percentual`, `decimal_para_str_ou_none` e `obter_ultima_data_rdo`
continuam exatamente como estão hoje — só o bloco de imports acima muda, porque `Projeto` e
`datetime` deixam de ser TYPE_CHECKING-only: a nova função precisa deles em runtime.)

Adicionar ao final do arquivo:

```python
def obter_atividade_rdo_semana(empresa: Empresa) -> list[dict[str, str | int]]:
    """Contagem de RegistroDiario por dia, ultimos 7 dias (hoje inclusive), dos
    projetos ativos da empresa. Dias sem nenhum RDO aparecem com quantidade 0
    explicito — o grafico de barras do frontend nao pode "pular" um dia sem
    dado, senao a leitura do eixo X fica errada.
    """
    hoje = timezone.now().date()
    inicio = hoje - datetime.timedelta(days=DIAS_JANELA_ATIVIDADE - 1)

    linhas = (
        RegistroDiario.objects.filter(
            projeto__empresa=empresa,
            projeto__status=Projeto.StatusChoices.ATIVO,
            data_referencia__gte=inicio,
            data_referencia__lte=hoje,
        )
        .values("data_referencia")
        .annotate(quantidade=Count("id"))
    )
    contagem_por_dia = {linha["data_referencia"]: linha["quantidade"] for linha in linhas}

    return [
        {
            "data": (inicio + datetime.timedelta(days=offset)).isoformat(),
            "quantidade": contagem_por_dia.get(inicio + datetime.timedelta(days=offset), 0),
        }
        for offset in range(DIAS_JANELA_ATIVIDADE)
    ]
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_atividade_rdo.py -v`
Expected: PASS — 5/5

- [ ] **Step 5: Lint**

Run: `cd backend && uv run ruff check && uv run ruff format --check`
Expected: sem erros (ajustar imports/formatação se necessário antes de commitar)

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/projetos/services.py backend/buildflow/projetos/tests/test_atividade_rdo.py
git commit -m "feat: adiciona obter_atividade_rdo_semana para contagem de RDOs por dia"
```

---

### Task 2: Expor `atividade_rdo` no `GET /api/v1/dashboard/`

**Files:**
- Modify: `backend/buildflow/projetos/views.py`
- Test: `backend/buildflow/projetos/tests/test_dashboard.py`

**Interfaces:**
- Consumes: `obter_atividade_rdo_semana(empresa)` (Task 1)
- Produces: campo `atividade_rdo` na resposta de `GET /api/v1/dashboard/` — mesma lista de 7 dicts
  do Task 1.

- [ ] **Step 1: Escrever o teste (deve falhar — campo ainda não existe na resposta)**

Adicionar ao final de `backend/buildflow/projetos/tests/test_dashboard.py` (já importa `Equipe`,
`RegistroDiario`, `datetime` no topo do arquivo — reaproveitar):

```python
def test_atividade_rdo_aparece_no_dashboard():
    empresa = EmpresaFactory()
    usuario = UsuarioFactory(empresa=empresa)
    projeto = Projeto.objects.create(
        empresa=empresa, nome="Ativo", criado_por=usuario, status="ativo",
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=datetime.date.today(),  # noqa: DTZ011
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )

    response = _authenticated_client(usuario).get(DASHBOARD_URL)

    assert response.status_code == HTTPStatus.OK
    atividade = response.json()["atividade_rdo"]
    assert len(atividade) == 7  # noqa: PLR2004
    assert atividade[-1]["quantidade"] == 1
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_dashboard.py::test_atividade_rdo_aparece_no_dashboard -v`
Expected: FAIL — `KeyError: 'atividade_rdo'`

- [ ] **Step 3: Implementar**

Em `backend/buildflow/projetos/views.py`, adicionar o import e o campo na resposta:

```python
from .services import calcular_execucao_percentual
from .services import decimal_para_str_ou_none
from .services import obter_atividade_rdo_semana
from .services import obter_ultima_data_rdo
```

E no `Response(...)` de `DashboardView.get`, adicionar a chave (mantendo todas as existentes):

```python
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
                "atividade_rdo": obter_atividade_rdo_semana(empresa),
            },
        )
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_dashboard.py -v`
Expected: PASS — todos os testes do arquivo, incluindo o novo

- [ ] **Step 5: Lint**

Run: `cd backend && uv run ruff check && uv run ruff format --check`
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/projetos/views.py backend/buildflow/projetos/tests/test_dashboard.py
git commit -m "feat: expoe atividade_rdo no endpoint de dashboard"
```

---

### Task 3: Filtro `?mes=YYYY-MM` na listagem de RDOs

**Files:**
- Modify: `backend/buildflow/registros_diarios/views.py`
- Test: `backend/buildflow/registros_diarios/tests/test_api.py`

**Interfaces:**
- Produces: `GET /api/v1/projetos/{id}/registros-diarios/?mes=YYYY-MM` — filtra por mês, resposta
  vira uma lista JSON simples (`[...]`, sem envelope de paginação) só quando o parâmetro está
  presente. Sem o parâmetro, resposta continua paginada (`{count, next, previous, results}`), igual
  hoje.

- [ ] **Step 1: Escrever os testes (devem falhar — filtro ainda não existe)**

Adicionar ao final de `backend/buildflow/registros_diarios/tests/test_api.py` (já tem a fixture
`cenario` e o helper `_payload` reaproveitados):

```python
def test_filtro_mes_retorna_apenas_rdos_do_mes(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
    client = _authenticated_client(cenario["usuario"])
    client.post(url, _payload(cenario, data_referencia="2026-07-17"), format="json")
    client.post(url, _payload(cenario, data_referencia="2026-08-01"), format="json")

    response = client.get(url, {"mes": "2026-07"})

    assert response.status_code == HTTPStatus.OK
    corpo = response.json()
    assert isinstance(corpo, list)
    assert len(corpo) == 1
    assert corpo[0]["data_referencia"] == "2026-07-17"


def test_filtro_mes_sem_resultado_retorna_lista_vazia(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"

    response = _authenticated_client(cenario["usuario"]).get(url, {"mes": "2026-01"})

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


def test_filtro_mes_formato_invalido_retorna_400(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"

    response = _authenticated_client(cenario["usuario"]).get(url, {"mes": "invalido"})

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_sem_filtro_mes_mantem_paginacao(cenario):
    url = f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
    client = _authenticated_client(cenario["usuario"])
    client.post(url, _payload(cenario), format="json")

    response = client.get(url)

    assert response.status_code == HTTPStatus.OK
    corpo = response.json()
    assert "results" in corpo
    assert corpo["count"] == 1
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/registros_diarios/tests/test_api.py -v -k filtro_mes`
Expected: FAIL — `test_filtro_mes_retorna_apenas_rdos_do_mes` retorna todos os RDOs (filtro
ignorado), `test_filtro_mes_formato_invalido_retorna_400` retorna 200 em vez de 400

- [ ] **Step 3: Implementar**

Substituir `RegistroDiarioViewSet` inteira em `backend/buildflow/registros_diarios/views.py`:

```python
class RegistroDiarioViewSet(
    TenantScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = RegistroDiarioSerializer
    queryset = RegistroDiario.objects.all().prefetch_related(
        "producoes",
        "presencas",
        "maquinas",
        "ocorrencias",
        "fotos",
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = queryset.filter(projeto_id=self.kwargs["projeto_pk"])

        mes = self.request.query_params.get("mes")
        if mes:
            ano, mes_numero = self._parse_filtro_mes(mes)
            queryset = queryset.filter(
                data_referencia__year=ano,
                data_referencia__month=mes_numero,
            )
        return queryset

    @staticmethod
    def _parse_filtro_mes(mes: str) -> tuple[int, int]:
        try:
            ano_str, mes_str = mes.split("-")
            return int(ano_str), int(mes_str)
        except ValueError as erro:
            raise ValidationError({"mes": "Use o formato YYYY-MM."}) from erro

    def _get_projeto(self) -> Projeto:
        # Principio I: o projeto so e valido se pertencer a empresa do
        # usuario autenticado — senao, 404 (nunca 403, FR-013).
        return get_object_or_404(
            Projeto.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["projeto_pk"],
        )

    def perform_create(self, serializer):
        projeto = self._get_projeto()
        serializer.save(projeto=projeto, autor=self.request.user)

    def list(self, request, *args, **kwargs):
        self._get_projeto()  # 404 antecipado se o projeto nao existe/nao e da empresa
        if request.query_params.get("mes"):
            self.pagination_class = None
        return super().list(request, *args, **kwargs)
```

(`RegistroDiarioDetailView`, abaixo dessa classe no mesmo arquivo, não muda.)

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/registros_diarios/tests/test_api.py -v`
Expected: PASS — todos os testes do arquivo, incluindo os 4 novos

- [ ] **Step 5: Lint**

Run: `cd backend && uv run ruff check && uv run ruff format --check`
Expected: sem erros

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/registros_diarios/views.py backend/buildflow/registros_diarios/tests/test_api.py
git commit -m "feat: adiciona filtro por mes na listagem de registros diarios"
```

---

### Task 4: Verificação final

**Files:** none esperado além de possíveis pequenos ajustes achados na verificação.

- [ ] **Step 1: Suíte completa**

```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest
uv run ruff check
uv run ruff format --check
```
Expected: todos os testes passam (suíte completa, não só os arquivos tocados neste plano), ruff
limpo.

- [ ] **Step 2: Atualizar `specs/001-mvp-gestao-diaria/tasks.md`**

Adicionar ao final do arquivo:

```markdown

**Backend do "Field OS" — Conclusão (2026-07-21)**: `GET /api/v1/dashboard/` ganha `atividade_rdo`
(contagem de RDOs por dia, últimos 7 dias, dias sem registro aparecem com `quantidade: 0` — o
gráfico de barras do frontend não pode "pular" dia). `GET /api/v1/projetos/{id}/registros-diarios/`
ganha filtro opcional `?mes=YYYY-MM`: quando presente, filtra por mês e retorna uma lista plana sem
paginação (formato de resposta muda de `{count, next, previous, results}` para um array simples só
nesse caso — usado pelo calendário de RDOs do frontend); formato inválido retorna 400. Sem o
parâmetro, comportamento e formato de resposta atuais ficam intactos.

**Verificado**: suíte pytest completa + ruff limpos.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra backend da conclusao do Field OS em tasks.md"
```
