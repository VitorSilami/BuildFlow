# EAP — Estrutura, Peso e Quantidade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `MetaMensal` por uma EAP de 2 níveis (Disciplina → Serviço) com peso percentual em cada nível e quantidade planejada/executada por serviço, alimentando o cálculo de `execucao_percentual` do projeto por média ponderada.

**Architecture:** `Disciplina` e `CatalogoServico` ganham campos de peso/quantidade diretamente (sem tabela nova). `buildflow.projetos.services.calcular_execucao_percentual` passa a agregar em 2 passos (serviço → disciplina → projeto), sempre retornando `None` quando não há peso definido em vez de inventar número. Endpoints novos (`ServicoViewSet`/`ServicoDetailViewSet`) seguem o padrão já existente de `MaquinaViewSet`/`MaquinaDetailViewSet` aninhado. `MetaMensal` é removido via migração de dados (copia peso para `Disciplina`) seguida de `DeleteModel`. No frontend, a aba "Metas" de Configurações vira "EAP": disciplinas mostram peso/avanço e expandem para uma lista de serviços com peso/quantidade editáveis inline.

**Tech Stack:** Django REST Framework, pytest + factory_boy, React + TanStack Query, Playwright.

## Global Constraints

- Nunca inventar número: qualquer cálculo de avanço sem peso/quantidade definida retorna `None` (nunca `0` fabricado), igual à regra já usada em `calcular_execucao_percentual` hoje.
- `Disciplina.peso_percentual` e `CatalogoServico.peso_percentual`: `DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)`.
- `CatalogoServico.quantidade_planejada`: `DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)`.
- `CatalogoServico.quantidade_executada`: `DecimalField(max_digits=12, decimal_places=3, default=Decimal("0"))` (nunca nulo).
- Leitura de Configurações continua aberta a qualquer perfil autenticado da empresa. Escrita (criar/editar disciplina, criar/editar serviço) fica restrita a `IsGerente` — correção nova, antes não existia essa checagem em Configurações.
- `MetaMensal` é removido por completo (model, serializer, views, urls, rotas, admin) — nenhum código novo deve referenciá-lo.
- Toda alteração de schema via migração Django versionada (nunca editar dado direto em produção).

---

## Task 1: Peso e quantidade em Disciplina e CatalogoServico

**Files:**
- Modify: `backend/buildflow/configuracoes/models.py:1-99` (import `Decimal`, campos em `Disciplina` e `CatalogoServico`)
- Modify: `backend/buildflow/configuracoes/admin.py`
- Create: `backend/buildflow/configuracoes/migrations/0006_disciplina_peso_catalogoservico_peso_quantidade.py`
- Test: `backend/buildflow/configuracoes/tests/test_models.py` (novo arquivo)

**Interfaces:**
- Produces: `Disciplina.peso_percentual: Decimal | None`; `CatalogoServico.peso_percentual: Decimal | None`, `CatalogoServico.quantidade_planejada: Decimal | None`, `CatalogoServico.quantidade_executada: Decimal` (nunca `None`, default `Decimal("0")`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/buildflow/configuracoes/tests/test_models.py`:

```python
from decimal import Decimal

import pytest

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto

pytestmark = pytest.mark.django_db


def _criar_projeto() -> Projeto:
    usuario = UsuarioFactory()
    return Projeto.objects.create(empresa=usuario.empresa, nome="Projeto Teste", criado_por=usuario)


def test_disciplina_aceita_peso_percentual_opcional():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(
        projeto=projeto,
        nome="Terraplenagem",
        peso_percentual=Decimal("40.00"),
    )

    assert disciplina.peso_percentual == Decimal("40.00")


def test_disciplina_sem_peso_percentual_fica_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")

    assert disciplina.peso_percentual is None


def test_catalogo_servico_quantidade_executada_default_zero():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")

    servico = CatalogoServico.objects.create(disciplina=disciplina, nome="Corte", unidade=unidade)

    assert servico.quantidade_executada == Decimal("0")
    assert servico.quantidade_planejada is None
    assert servico.peso_percentual is None


def test_catalogo_servico_aceita_peso_e_quantidades():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = Unidade.objects.create(sigla="m³", descricao="metro cúbico")

    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        peso_percentual=Decimal("60.00"),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("250.000"),
    )

    assert servico.peso_percentual == Decimal("60.00")
    assert servico.quantidade_planejada == Decimal("1000.000")
    assert servico.quantidade_executada == Decimal("250.000")
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && python -m pytest buildflow/configuracoes/tests/test_models.py -v`
Expected: FAIL — `TypeError: Disciplina() got unexpected keyword arguments: 'peso_percentual'` (o campo ainda não existe).

- [ ] **Step 3: Adicionar os campos no model**

Em `backend/buildflow/configuracoes/models.py`, adicionar o import no topo do arquivo (linha 1):

```python
import uuid
from decimal import Decimal

from django.db import models
from django.utils.translation import gettext_lazy as _

from buildflow.core.querysets import TenantScopedManager
from buildflow.projetos.models import Projeto
```

Na classe `Disciplina`, logo após o campo `nome` (depois da linha `nome = models.CharField(_("nome"), max_length=255)`, antes de `tenant_path = "projeto__empresa"`):

```python
    nome = models.CharField(_("nome"), max_length=255)
    peso_percentual = models.DecimalField(
        _("peso percentual"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )

    tenant_path = "projeto__empresa"
```

Na classe `CatalogoServico`, logo após o campo `unidade` (antes de `tenant_path = "disciplina__projeto__empresa"`):

```python
    unidade = models.ForeignKey(
        Unidade,
        verbose_name=_("unidade"),
        on_delete=models.PROTECT,
    )
    peso_percentual = models.DecimalField(
        _("peso percentual"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
    quantidade_planejada = models.DecimalField(
        _("quantidade planejada"),
        max_digits=12,
        decimal_places=3,
        null=True,
        blank=True,
    )
    quantidade_executada = models.DecimalField(
        _("quantidade executada"),
        max_digits=12,
        decimal_places=3,
        default=Decimal("0"),
    )

    tenant_path = "disciplina__projeto__empresa"
```

- [ ] **Step 4: Criar a migração**

Criar `backend/buildflow/configuracoes/migrations/0006_disciplina_peso_catalogoservico_peso_quantidade.py`:

```python
from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configuracoes", "0005_valorcusto_funcao_valorcusto_maquina_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="disciplina",
            name="peso_percentual",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=5,
                null=True,
                verbose_name="peso percentual",
            ),
        ),
        migrations.AddField(
            model_name="catalogoservico",
            name="peso_percentual",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=5,
                null=True,
                verbose_name="peso percentual",
            ),
        ),
        migrations.AddField(
            model_name="catalogoservico",
            name="quantidade_planejada",
            field=models.DecimalField(
                blank=True,
                decimal_places=3,
                max_digits=12,
                null=True,
                verbose_name="quantidade planejada",
            ),
        ),
        migrations.AddField(
            model_name="catalogoservico",
            name="quantidade_executada",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("0"),
                max_digits=12,
                verbose_name="quantidade executada",
            ),
        ),
    ]
```

Run: `cd backend && python manage.py migrate configuracoes`
Expected: `Applying configuracoes.0006_disciplina_peso_catalogoservico_peso_quantidade... OK`

- [ ] **Step 5: Atualizar o admin**

Em `backend/buildflow/configuracoes/admin.py`, atualizar `DisciplinaAdmin` e `CatalogoServicoInline`:

```python
class CatalogoServicoInline(admin.TabularInline):
    model = CatalogoServico
    extra = 1
    fields = ["nome", "unidade", "peso_percentual", "quantidade_planejada", "quantidade_executada"]


@admin.register(Disciplina)
class DisciplinaAdmin(admin.ModelAdmin):
    list_display = ["nome", "projeto", "peso_percentual"]
    list_filter = ["projeto"]
    search_fields = ["nome"]
    inlines = [CatalogoServicoInline]
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `cd backend && python -m pytest buildflow/configuracoes/tests/test_models.py -v`
Expected: `4 passed`

- [ ] **Step 7: Commit**

```bash
git add backend/buildflow/configuracoes/models.py backend/buildflow/configuracoes/admin.py backend/buildflow/configuracoes/migrations/0006_disciplina_peso_catalogoservico_peso_quantidade.py backend/buildflow/configuracoes/tests/test_models.py
git commit -m "feat: adiciona peso e quantidade em Disciplina e CatalogoServico"
```

---

## Task 2: Cálculo de execução em 2 níveis

**Files:**
- Modify: `backend/buildflow/projetos/services.py:1-59`
- Test: `backend/buildflow/projetos/tests/test_execucao.py` (reescrita completa)

**Interfaces:**
- Consumes: `Disciplina.peso_percentual`, `CatalogoServico.peso_percentual`, `CatalogoServico.quantidade_planejada`, `CatalogoServico.quantidade_executada` (Task 1).
- Produces: `calcular_avanco_servico(servico: CatalogoServico) -> Decimal | None`; `calcular_avanco_disciplina(disciplina: Disciplina) -> Decimal | None`; `calcular_execucao_percentual(projeto: Projeto) -> Decimal | None` (assinatura inalterada, usada por `projetos/serializers.py` e `projetos/views.py`).

- [ ] **Step 1: Escrever o teste que falha**

Substituir todo o conteúdo de `backend/buildflow/projetos/tests/test_execucao.py` por:

```python
from decimal import Decimal

import pytest

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Unidade
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto
from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import calcular_execucao_percentual

pytestmark = pytest.mark.django_db


def _criar_projeto() -> Projeto:
    usuario = UsuarioFactory()
    return Projeto.objects.create(
        empresa=usuario.empresa,
        nome="Projeto Teste",
        criado_por=usuario,
    )


def _criar_unidade() -> Unidade:
    return Unidade.objects.create(sigla="m³", descricao="metro cúbico")


def test_servico_sem_quantidade_planejada_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(disciplina=disciplina, nome="Corte", unidade=_criar_unidade())

    assert calcular_avanco_servico(servico) is None


def test_servico_com_quantidade_calcula_percentual():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("500.000"),
    )

    assert calcular_avanco_servico(servico) == Decimal("50.00")


def test_sem_disciplinas_retorna_none():
    projeto = _criar_projeto()

    assert calcular_execucao_percentual(projeto) is None


def test_disciplina_sem_peso_percentual_nao_conta_e_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem", peso_percentual=None)
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("500.000"),
        peso_percentual=Decimal("100.00"),
    )

    assert calcular_execucao_percentual(projeto) is None


def test_servico_sem_peso_nao_conta_na_disciplina():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"))
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("500.000"),
        peso_percentual=None,
    )

    assert calcular_avanco_disciplina(disciplina) is None
    assert calcular_execucao_percentual(projeto) is None


def test_uma_disciplina_um_servico_com_peso_calcula_percentual_direto():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"))
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("500.000"),
        peso_percentual=Decimal("100.00"),
    )

    assert calcular_avanco_disciplina(disciplina) == Decimal("50.00")
    assert calcular_execucao_percentual(projeto) == Decimal("50.00")


def test_duas_disciplinas_pesos_diferentes_media_ponderada():
    projeto = _criar_projeto()
    unidade = _criar_unidade()

    disc_a = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("75.00"))
    CatalogoServico.objects.create(
        disciplina=disc_a,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("1000.000"),
        peso_percentual=Decimal("100.00"),
    )

    disc_b = Disciplina.objects.create(projeto=projeto, nome="Pavimentação", peso_percentual=Decimal("25.00"))
    CatalogoServico.objects.create(
        disciplina=disc_b,
        nome="Base",
        unidade=unidade,
        quantidade_planejada=Decimal("200.000"),
        quantidade_executada=Decimal("100.000"),
        peso_percentual=Decimal("100.00"),
    )

    # (100% * 75 + 50% * 25) / (75 + 25) = 87.5%
    assert calcular_execucao_percentual(projeto) == Decimal("87.50")


def test_dois_servicos_pesos_diferentes_dentro_da_disciplina():
    projeto = _criar_projeto()
    unidade = _criar_unidade()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"))

    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada=Decimal("1000.000"),
        peso_percentual=Decimal("60.00"),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
        quantidade_planejada=Decimal("500.000"),
        quantidade_executada=Decimal("0.000"),
        peso_percentual=Decimal("40.00"),
    )

    # (100% * 60 + 0% * 40) / (60 + 40) = 60%
    assert calcular_avanco_disciplina(disciplina) == Decimal("60.00")
    assert calcular_execucao_percentual(projeto) == Decimal("60.00")
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && python -m pytest buildflow/projetos/tests/test_execucao.py -v`
Expected: FAIL — `ImportError: cannot import name 'calcular_avanco_servico'`.

- [ ] **Step 3: Reescrever `calcular_execucao_percentual`**

Substituir as linhas 1-58 de `backend/buildflow/projetos/services.py` (do início do arquivo até o fim da função `calcular_execucao_percentual`, mantendo `decimal_para_str_ou_none`, `obter_ultima_data_rdo` e `obter_atividade_rdo_semana` como estão hoje, sem alteração):

```python
from __future__ import annotations

import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db.models import Count
from django.utils import timezone

from buildflow.registros_diarios.models import RegistroDiario

from .models import Projeto

if TYPE_CHECKING:
    from buildflow.configuracoes.models import CatalogoServico
    from buildflow.configuracoes.models import Disciplina
    from buildflow.empresas.models import Empresa

DIAS_JANELA_ATIVIDADE = 7


def calcular_avanco_servico(servico: CatalogoServico) -> Decimal | None:
    """Percentual executado de um servico: quantidade_executada / quantidade_planejada.
    Retorna None quando nao ha quantidade planejada — nunca inventa um numero.
    """
    if not servico.quantidade_planejada:
        return None
    proporcao = servico.quantidade_executada / servico.quantidade_planejada
    return (proporcao * Decimal("100")).quantize(Decimal("0.01"))


def calcular_avanco_disciplina(disciplina: Disciplina) -> Decimal | None:
    """Media ponderada (por CatalogoServico.peso_percentual) do avanco dos
    servicos de uma disciplina. Servico sem peso definido, ou cujo avanco nao
    pode ser calculado (None), nao conta. Retorna None quando nenhum servico
    contribui com peso e avanco definidos.
    """
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")

    for servico in disciplina.servicos.all():
        if servico.peso_percentual is None:
            continue
        avanco = calcular_avanco_servico(servico)
        if avanco is None:
            continue
        soma_ponderada += avanco * servico.peso_percentual
        soma_pesos += servico.peso_percentual

    if soma_pesos == 0:
        return None

    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))


def calcular_execucao_percentual(projeto: Projeto) -> Decimal | None:
    """Media ponderada (por Disciplina.peso_percentual) do avanco de cada
    disciplina do projeto. Disciplina sem peso definido, ou cujo avanco nao
    pode ser calculado (None), nao conta — uma disciplina com peso mas sem
    avanco calculavel tem progresso desconhecido, nao zero, entao NAO deve
    ser contada com avanco 0 na media do projeto (isso seria inventar um
    numero). Retorna None quando nao ha base real para calcular.
    """
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")

    for disciplina in projeto.disciplinas.all():
        if disciplina.peso_percentual is None:
            continue
        avanco = calcular_avanco_disciplina(disciplina)
        if avanco is None:
            continue
        soma_ponderada += avanco * disciplina.peso_percentual
        soma_pesos += disciplina.peso_percentual

    if soma_pesos == 0:
        return None

    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))


def decimal_para_str_ou_none(valor: Decimal | None) -> str | None:
    return str(valor) if valor is not None else None
```

**Nota pós-implementação:** a versão original deste passo usava `avanco = calcular_avanco_disciplina(disciplina) or Decimal("0")` (e o equivalente em `calcular_avanco_disciplina`), o que fazia um filho com avanço indefinido (`None`) contar como 0% na média do pai — violando a própria regra "nunca inventa número" do filho para cima. Corrigido durante a execução da Task 2 (`test_servico_sem_peso_nao_conta_na_disciplina` pegou o caso) para excluir explicitamente filhos com avanço `None`, igual ao tratamento já dado a peso `None`. O código acima já reflete a versão corrigida.

O restante do arquivo (`obter_ultima_data_rdo` e `obter_atividade_rdo_semana`, hoje nas linhas 65-111) permanece exatamente como está — apenas os imports não usados (`Sum`, `MetaMensal`, `ProducaoDiaria`) somem porque já não aparecem no bloco acima.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && python -m pytest buildflow/projetos/tests/test_execucao.py -v`
Expected: `9 passed`

Run: `cd backend && python -m pytest buildflow/projetos/tests/test_atividade_rdo.py -v`
Expected: `passed` (garante que `obter_atividade_rdo_semana` não quebrou com a reescrita do arquivo).

- [ ] **Step 5: Commit**

```bash
git add backend/buildflow/projetos/services.py backend/buildflow/projetos/tests/test_execucao.py
git commit -m "feat: calcula execucao do projeto em 2 niveis (servico -> disciplina -> projeto)"
```

---

## Task 3: Serializers, endpoints de Serviço e permissão Gerente

**Files:**
- Modify: `backend/buildflow/configuracoes/serializers.py` (arquivo inteiro)
- Modify: `backend/buildflow/configuracoes/views.py` (arquivo inteiro)
- Modify: `backend/buildflow/configuracoes/urls.py` (arquivo inteiro)
- Modify: `backend/buildflow/configuracoes/services.py` (arquivo inteiro)
- Modify: `backend/buildflow/configuracoes/tests/test_api.py:1-19` e `:93-152`

**Interfaces:**
- Consumes: `calcular_avanco_servico`, `calcular_avanco_disciplina`, `decimal_para_str_ou_none` de `buildflow.projetos.services` (Task 2); `IsGerente` de `buildflow.core.permissions` (já existe, usado em `buildflow/rnc/views.py`).
- Produces: `POST /api/v1/configuracoes/disciplinas/<disciplina_pk>/servicos/` (cria `CatalogoServico`); `PATCH /api/v1/configuracoes/servicos/<pk>/` (edita peso/quantidade); `DisciplinaSerializer` e `CatalogoServicoSerializer` com campos `peso_percentual`/`avanco_percentual` (e `quantidade_planejada`/`quantidade_executada` no serviço); `ConfiguracaoProjetoView` retorna `soma_pesos_disciplinas` (não mais `metas`/`soma_pesos_metas`).

- [ ] **Step 1: Escrever os testes que falham**

Em `backend/buildflow/configuracoes/tests/test_api.py`, substituir as linhas 1-19 (imports e constante) por:

```python
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
from buildflow.usuarios.models import PerfilChoices

pytestmark = pytest.mark.django_db

SOMA_PESOS_ESPERADA = 25.0


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client
```

Substituir as linhas 93-152 (as duas funções `test_criar_meta_e_valor_de_custo` e `test_editar_meta_existente`) pelo bloco abaixo:

```python
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
    assert body["quantidade_executada"] == "0.000"
    assert body["avanco_percentual"] == "0.00"


def test_patch_servico_atualiza_peso_quantidade_e_recalcula_avanco():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=UnidadeFactory())
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/servicos/{servico.id}/",
        {"quantidade_planejada": "1000.000", "quantidade_executada": "250.000"},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["avanco_percentual"] == "25.00"


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
            "quantidade_executada": "1000.000",
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
```

As demais funções do arquivo (`test_configuracao_rdo_...`, `test_criar_equipe_com_pessoa_e_maquina`, `test_ignora_projeto_enviado_no_payload_de_equipe`, `test_valor_custo_*`) continuam exatamente como estão — não fazem parte deste diff.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && python -m pytest buildflow/configuracoes/tests/test_api.py -v`
Expected: FAIL — `django.urls.exceptions.NoReverseMatch` / 404 nas rotas de `servicos/`, e `AssertionError` nas asserções de `avanco_percentual`/`soma_pesos_disciplinas` (campos ainda não existem).

- [ ] **Step 3: Reescrever `configuracoes/services.py`**

```python
from decimal import Decimal

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError


def soma_pesos_disciplinas(projeto) -> Decimal:
    """Soma dos pesos percentuais das disciplinas de um projeto.

    Validacao informativa (nao bloqueante): o frontend usa isso so para
    alertar visualmente quando a soma nao fica proxima de 100%, sem impedir
    o salvamento (H: a planilha de EAP do prototipo so validava
    visualmente, nunca travava o cadastro).
    """
    total = Decimal("0")
    for disciplina in projeto.disciplinas.all():
        if disciplina.peso_percentual is not None:
            total += disciplina.peso_percentual
    return total


def soma_pesos_servicos(disciplina) -> Decimal:
    """Soma dos pesos percentuais dos servicos de uma disciplina (mesma
    regra informativa/nao bloqueante de soma_pesos_disciplinas)."""
    total = Decimal("0")
    for servico in disciplina.servicos.all():
        if servico.peso_percentual is not None:
            total += servico.peso_percentual
    return total


def validar_valor_custo(*, tipo: str, funcao: str, maquina) -> None:
    if tipo == "mao_de_obra" and maquina is not None:
        msg = _("Máquina só pode ser informada quando o tipo é Equipamento.")
        raise ValidationError(msg)
    if tipo == "equipamento" and funcao:
        msg = _("Função só pode ser informada quando o tipo é Mão de obra.")
        raise ValidationError(msg)
```

- [ ] **Step 4: Reescrever `configuracoes/serializers.py`**

```python
from rest_framework import serializers

from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import decimal_para_str_ou_none

from . import services
from .models import CatalogoServico
from .models import Disciplina
from .models import Equipe
from .models import Maquina
from .models import MotivoParada
from .models import Pessoa
from .models import Unidade
from .models import ValorCusto


class UnidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidade
        fields = ["id", "sigla", "descricao"]


class MotivoParadaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MotivoParada
        fields = ["id", "descricao"]


class CatalogoServicoSerializer(serializers.ModelSerializer):
    avanco_percentual = serializers.SerializerMethodField()

    class Meta:
        model = CatalogoServico
        fields = [
            "id",
            "nome",
            "unidade",
            "peso_percentual",
            "quantidade_planejada",
            "quantidade_executada",
            "avanco_percentual",
        ]

    def get_avanco_percentual(self, obj: CatalogoServico) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_servico(obj))


class DisciplinaSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoSerializer(many=True, read_only=True)
    avanco_percentual = serializers.SerializerMethodField()

    class Meta:
        model = Disciplina
        fields = ["id", "nome", "peso_percentual", "servicos", "avanco_percentual"]

    def get_avanco_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_disciplina(obj))


class PessoaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pessoa
        fields = ["id", "nome", "funcao"]


class MaquinaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Maquina
        fields = ["id", "codigo", "nome"]


class EquipeSerializer(serializers.ModelSerializer):
    pessoas = PessoaSerializer(many=True, read_only=True)
    maquinas = MaquinaSerializer(many=True, read_only=True)

    class Meta:
        model = Equipe
        fields = ["id", "nome", "encarregado", "pessoas", "maquinas"]


class ValorCustoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValorCusto
        fields = ["id", "tipo", "descricao", "valor", "funcao", "maquina"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        services.validar_valor_custo(
            tipo=attrs.get("tipo"),
            funcao=attrs.get("funcao", ""),
            maquina=attrs.get("maquina"),
        )
        return attrs
```

- [ ] **Step 5: Reescrever `configuracoes/views.py`**

```python
from django.shortcuts import get_object_or_404
from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import IsGerente
from buildflow.core.permissions import TenantScopedViewSetMixin
from buildflow.projetos.models import Projeto
from buildflow.usuarios.api.serializers import UserSerializer
from buildflow.usuarios.models import User

from . import services
from .models import CatalogoServico
from .models import Disciplina
from .models import Equipe
from .models import Maquina
from .models import MotivoParada
from .models import Pessoa
from .models import Unidade
from .models import ValorCusto
from .serializers import CatalogoServicoSerializer
from .serializers import DisciplinaSerializer
from .serializers import EquipeSerializer
from .serializers import MaquinaSerializer
from .serializers import MotivoParadaSerializer
from .serializers import PessoaSerializer
from .serializers import UnidadeSerializer
from .serializers import ValorCustoSerializer


class ConfiguracaoRdoView(APIView):
    """Bootstrap somente-leitura para o formulário de RDO: disciplinas (com
    serviços), unidades, equipes (com pessoas/máquinas) e motivos de parada
    do projeto — usado para popular os seletores da etapa de produção/equipe/
    máquinas (FR-020).
    """

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def get(self, request, projeto_pk):
        projeto = get_object_or_404(
            Projeto.objects.for_empresa(request.user.empresa),
            pk=projeto_pk,
        )

        disciplinas = Disciplina.objects.filter(projeto=projeto).prefetch_related(
            "servicos",
        )
        equipes = Equipe.objects.filter(projeto=projeto).prefetch_related(
            "pessoas",
            "maquinas",
        )

        fiscais = User.objects.filter(empresa=request.user.empresa, is_active=True)

        return Response(
            {
                "disciplinas": DisciplinaSerializer(disciplinas, many=True).data,
                "unidades": UnidadeSerializer(Unidade.objects.all(), many=True).data,
                "equipes": EquipeSerializer(equipes, many=True).data,
                "motivos_parada": MotivoParadaSerializer(
                    MotivoParada.objects.all(),
                    many=True,
                ).data,
                "fiscais": UserSerializer(fiscais, many=True).data,
            },
        )


class ConfiguracaoProjetoView(APIView):
    """Visão completa da Configuração de um projeto (FR-023): EAP
    (disciplinas com peso/avanço), equipes (com pessoas/máquinas) e valores
    de custo.
    """

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def get(self, request, projeto_pk):
        projeto = get_object_or_404(
            Projeto.objects.for_empresa(request.user.empresa),
            pk=projeto_pk,
        )

        equipes = Equipe.objects.filter(projeto=projeto).prefetch_related(
            "pessoas",
            "maquinas",
        )
        valores = ValorCusto.objects.filter(projeto=projeto)
        disciplinas = Disciplina.objects.filter(projeto=projeto).prefetch_related("servicos")

        return Response(
            {
                "disciplinas": DisciplinaSerializer(disciplinas, many=True).data,
                "equipes": EquipeSerializer(equipes, many=True).data,
                "valores_custo": ValorCustoSerializer(valores, many=True).data,
                "soma_pesos_disciplinas": services.soma_pesos_disciplinas(projeto),
            },
        )


class ProjetoNestedMixin:
    """Views aninhadas sob `/projetos/{projeto_pk}/...` — deriva `projeto` do
    usuario autenticado (Principio I), nunca do payload."""

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def _get_projeto(self) -> Projeto:
        return get_object_or_404(
            Projeto.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["projeto_pk"],
        )


class DisciplinaViewSet(
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = DisciplinaSerializer
    queryset = Disciplina.objects.all().prefetch_related("servicos")

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticatedWithEmpresa(), IsGerente()]
        return [IsAuthenticatedWithEmpresa()]

    def get_queryset(self):
        return super().get_queryset().filter(projeto_id=self.kwargs["projeto_pk"])

    def perform_create(self, serializer):
        serializer.save(projeto=self._get_projeto())


class DisciplinaDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = DisciplinaSerializer
    queryset = Disciplina.objects.all()
    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)


class DisciplinaNestedMixin:
    """Views aninhadas sob `/configuracoes/disciplinas/{disciplina_pk}/...`."""

    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)

    def _get_disciplina(self) -> Disciplina:
        return get_object_or_404(
            Disciplina.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["disciplina_pk"],
        )


class ServicoViewSet(DisciplinaNestedMixin, mixins.CreateModelMixin, GenericViewSet):
    serializer_class = CatalogoServicoSerializer
    queryset = CatalogoServico.objects.all()

    def perform_create(self, serializer):
        serializer.save(disciplina=self._get_disciplina())


class ServicoDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = CatalogoServicoSerializer
    queryset = CatalogoServico.objects.all()
    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)


class EquipeViewSet(
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = EquipeSerializer
    queryset = Equipe.objects.all().prefetch_related("pessoas", "maquinas")

    def get_queryset(self):
        return super().get_queryset().filter(projeto_id=self.kwargs["projeto_pk"])

    def perform_create(self, serializer):
        serializer.save(projeto=self._get_projeto())


class EquipeDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = EquipeSerializer
    queryset = Equipe.objects.all()


class EquipeNestedMixin:
    """Views aninhadas sob `/configuracao/equipes/{equipe_pk}/...`."""

    permission_classes = (IsAuthenticatedWithEmpresa,)

    def _get_equipe(self) -> Equipe:
        return get_object_or_404(
            Equipe.objects.for_empresa(self.request.user.empresa),
            pk=self.kwargs["equipe_pk"],
        )


class PessoaViewSet(EquipeNestedMixin, mixins.CreateModelMixin, GenericViewSet):
    serializer_class = PessoaSerializer
    queryset = Pessoa.objects.all()

    def perform_create(self, serializer):
        serializer.save(equipe=self._get_equipe())


class PessoaDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = PessoaSerializer
    queryset = Pessoa.objects.all()


class MaquinaViewSet(EquipeNestedMixin, mixins.CreateModelMixin, GenericViewSet):
    serializer_class = MaquinaSerializer
    queryset = Maquina.objects.all()

    def perform_create(self, serializer):
        serializer.save(equipe=self._get_equipe())


class MaquinaDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = MaquinaSerializer
    queryset = Maquina.objects.all()


class ValorCustoViewSet(
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = ValorCustoSerializer
    queryset = ValorCusto.objects.all()

    def get_queryset(self):
        return super().get_queryset().filter(projeto_id=self.kwargs["projeto_pk"])

    def perform_create(self, serializer):
        serializer.save(projeto=self._get_projeto())


class ValorCustoDetailViewSet(
    TenantScopedViewSetMixin,
    mixins.UpdateModelMixin,
    GenericViewSet,
):
    serializer_class = ValorCustoSerializer
    queryset = ValorCusto.objects.all()
```

- [ ] **Step 6: Reescrever `configuracoes/urls.py`**

```python
from django.urls import path

from .views import ConfiguracaoProjetoView
from .views import ConfiguracaoRdoView
from .views import DisciplinaDetailViewSet
from .views import DisciplinaViewSet
from .views import EquipeDetailViewSet
from .views import EquipeViewSet
from .views import MaquinaDetailViewSet
from .views import MaquinaViewSet
from .views import PessoaDetailViewSet
from .views import PessoaViewSet
from .views import ServicoDetailViewSet
from .views import ServicoViewSet
from .views import ValorCustoDetailViewSet
from .views import ValorCustoViewSet

app_name = "configuracoes"

urlpatterns = [
    path(
        "projetos/<uuid:projeto_pk>/configuracao-rdo/",
        ConfiguracaoRdoView.as_view(),
        name="configuracao-rdo",
    ),
    path(
        "projetos/<uuid:projeto_pk>/configuracao/",
        ConfiguracaoProjetoView.as_view(),
        name="configuracao",
    ),
    path(
        "projetos/<uuid:projeto_pk>/configuracao/disciplinas/",
        DisciplinaViewSet.as_view({"get": "list", "post": "create"}),
        name="configuracao-disciplinas",
    ),
    path(
        "configuracoes/disciplinas/<uuid:pk>/",
        DisciplinaDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-disciplina-detail",
    ),
    path(
        "configuracoes/disciplinas/<uuid:disciplina_pk>/servicos/",
        ServicoViewSet.as_view({"post": "create"}),
        name="configuracao-disciplina-servicos",
    ),
    path(
        "configuracoes/servicos/<uuid:pk>/",
        ServicoDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-servico-detail",
    ),
    path(
        "projetos/<uuid:projeto_pk>/configuracao/equipes/",
        EquipeViewSet.as_view({"get": "list", "post": "create"}),
        name="configuracao-equipes",
    ),
    path(
        "configuracoes/equipes/<uuid:pk>/",
        EquipeDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-equipe-detail",
    ),
    path(
        "configuracoes/equipes/<uuid:equipe_pk>/pessoas/",
        PessoaViewSet.as_view({"post": "create"}),
        name="configuracao-equipe-pessoas",
    ),
    path(
        "configuracoes/pessoas/<uuid:pk>/",
        PessoaDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-pessoa-detail",
    ),
    path(
        "configuracoes/equipes/<uuid:equipe_pk>/maquinas/",
        MaquinaViewSet.as_view({"post": "create"}),
        name="configuracao-equipe-maquinas",
    ),
    path(
        "configuracoes/maquinas/<uuid:pk>/",
        MaquinaDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-maquina-detail",
    ),
    path(
        "projetos/<uuid:projeto_pk>/configuracao/valores/",
        ValorCustoViewSet.as_view({"get": "list", "post": "create"}),
        name="configuracao-valores",
    ),
    path(
        "configuracoes/valores/<uuid:pk>/",
        ValorCustoDetailViewSet.as_view({"patch": "partial_update"}),
        name="configuracao-valor-detail",
    ),
]
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd backend && python -m pytest buildflow/configuracoes/tests/test_api.py -v`
Expected: todos os testes `passed` (as funções não tocadas neste diff continuam passando sem alteração).

- [ ] **Step 8: Commit**

```bash
git add backend/buildflow/configuracoes/serializers.py backend/buildflow/configuracoes/views.py backend/buildflow/configuracoes/urls.py backend/buildflow/configuracoes/services.py backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: endpoints de Servico e peso/avanco em Disciplina, escrita restrita a Gerente"
```

---

## Task 4: Remoção do MetaMensal

**Files:**
- Modify: `backend/buildflow/configuracoes/models.py` (remove classe `MetaMensal`)
- Modify: `backend/buildflow/configuracoes/admin.py` (remove `MetaMensalAdmin`)
- Create: `backend/buildflow/configuracoes/migrations/0007_copiar_peso_metamensal_para_disciplina.py`
- Create: `backend/buildflow/configuracoes/migrations/0008_remove_metamensal.py`
- (`backend/buildflow/projetos/tests/test_dashboard.py` e `test_api.py` já foram atualizados durante a Task 2 — ver Step 4)

**Interfaces:**
- Consumes: nada de tasks futuras — esta task fecha o ciclo de vida do `MetaMensal` (o serializer/views/urls já pararam de referenciá-lo na Task 3).

- [ ] **Step 1: Migração de dados (copia peso de MetaMensal para Disciplina)**

Criar `backend/buildflow/configuracoes/migrations/0007_copiar_peso_metamensal_para_disciplina.py`:

```python
from django.db import migrations


def copiar_peso_percentual_para_disciplina(apps, schema_editor):
    MetaMensal = apps.get_model("configuracoes", "MetaMensal")
    for meta in MetaMensal.objects.select_related("disciplina").all():
        if meta.peso_percentual is not None:
            disciplina = meta.disciplina
            disciplina.peso_percentual = meta.peso_percentual
            disciplina.save(update_fields=["peso_percentual"])


class Migration(migrations.Migration):

    dependencies = [
        ("configuracoes", "0006_disciplina_peso_catalogoservico_peso_quantidade"),
    ]

    operations = [
        migrations.RunPython(
            copiar_peso_percentual_para_disciplina,
            migrations.RunPython.noop,
        ),
    ]
```

Run: `cd backend && python manage.py migrate configuracoes`
Expected: `Applying configuracoes.0007_copiar_peso_metamensal_para_disciplina... OK`

- [ ] **Step 2: Remover o model `MetaMensal`**

Em `backend/buildflow/configuracoes/models.py`, remover por completo a classe `MetaMensal` (do `class MetaMensal(models.Model):` até o fim do seu método `__str__`, logo antes de `class ValorCusto(models.Model):`). O restante do arquivo (`TipoValorCustoChoices`, `ValorCusto`) permanece inalterado.

Em `backend/buildflow/configuracoes/admin.py`, remover o import `from .models import MetaMensal` e a classe:

```python
@admin.register(MetaMensal)
class MetaMensalAdmin(admin.ModelAdmin):
    list_display = ["disciplina", "projeto", "valor_alvo", "unidade", "peso_percentual"]
    list_filter = ["projeto"]
```

- [ ] **Step 3: Gerar a migração de remoção**

Criar `backend/buildflow/configuracoes/migrations/0008_remove_metamensal.py`:

```python
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("configuracoes", "0007_copiar_peso_metamensal_para_disciplina"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="metamensal",
            name="meta_unica_por_disciplina_e_projeto",
        ),
        migrations.DeleteModel(
            name="MetaMensal",
        ),
    ]
```

Run: `cd backend && python manage.py migrate configuracoes`
Expected: `Applying configuracoes.0008_remove_metamensal... OK`

Run: `cd backend && python manage.py makemigrations --check --dry-run`
Expected: `No changes detected` (confirma que o model e a migração ficaram consistentes).

- [x] **Step 4 (já feito na Task 2): fixtures de `projetos/tests` que criavam `MetaMensal`**

Este passo foi antecipado durante a execução da Task 2: a reescrita de `calcular_execucao_percentual` já quebrava `test_dashboard.py::test_execucao_media_calculada_entre_projetos_ativos` e `test_api.py::test_lista_projetos_inclui_execucao_percentual_calculada` (ambos criavam `MetaMensal` + `ProducaoDiaria` para popular a execução), então as duas fixtures já foram atualizadas para usar `Disciplina.peso_percentual`/`CatalogoServico.peso_percentual/quantidade_planejada/quantidade_executada` diretamente, sem esperar por esta task. Nada a fazer aqui — pular para o Step 5.

- [ ] **Step 5: Rodar a suíte completa do backend**

Run: `cd backend && python -m pytest buildflow/ -v`
Expected: todos os testes `passed`, nenhum erro de import (`MetaMensal` não existe mais em lugar nenhum).

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/configuracoes/models.py backend/buildflow/configuracoes/admin.py backend/buildflow/configuracoes/migrations/0007_copiar_peso_metamensal_para_disciplina.py backend/buildflow/configuracoes/migrations/0008_remove_metamensal.py backend/buildflow/projetos/tests/test_dashboard.py backend/buildflow/projetos/tests/test_api.py
git commit -m "refactor: remove MetaMensal, peso e quantidade agora vivem em Disciplina/CatalogoServico"
```

---

## Task 5: Atualizar seeds

**Files:**
- Modify: `backend/buildflow/core/management/commands/seed_demo_data.py`
- Modify: `backend/buildflow/core/management/commands/seed_legacy_data.py`

**Interfaces:**
- Consumes: `Disciplina.peso_percentual`, `CatalogoServico.peso_percentual/quantidade_planejada/quantidade_executada` (Task 1); `MetaMensal` já removido (Task 4) — estes comandos são os últimos dois lugares do código que ainda o referenciavam.

- [ ] **Step 1: Atualizar `seed_demo_data.py`**

Remover a linha `from buildflow.configuracoes.models import MetaMensal` do topo do arquivo.

Substituir o trecho (dentro de `_seed_configuracao_e_rdo`):

```python
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
            valor_alvo=1000,
            peso_percentual=100,
        )
```

por:

```python
        disciplina = Disciplina.objects.create(
            projeto=projeto,
            nome="Terraplenagem",
            peso_percentual=100,
        )
        servico = CatalogoServico.objects.create(
            disciplina=disciplina,
            nome="Corte",
            unidade=unidade,
            peso_percentual=100,
            quantidade_planejada=1000,
            quantidade_executada=500,
        )
```

(500 casa com a `quantidade=500.000` do `ProducaoDiaria` criado logo abaixo no mesmo método — mantém o dado de demonstração em 50% de avanço, igual ao comportamento anterior.)

- [ ] **Step 2: Atualizar `seed_legacy_data.py`**

Remover os imports `from collections import defaultdict` e `from buildflow.configuracoes.models import MetaMensal`.

Atualizar o texto de `help` do comando (linha com "CatalogoServico/MetaMensal"):

```python
    help = (
        "Importa BASE_QTD_L2 da planilha MODELO IMPORT SOFT como Disciplina/"
        "CatalogoServico (com peso/quantidade) de um projeto de demonstracao "
        "(dado legado usado so para carga inicial — ver decisao registrada em "
        "memoria de projeto, nao define schema)."
    )
```

Atualizar a chamada em `handle`:

```python
        with transaction.atomic():
            projeto = self._get_or_create_projeto_legado()
            linhas = self._ler_linhas(workbook[ABA_QUANTIDADES])
            self._importar_disciplinas_e_servicos(projeto, linhas)
```

Substituir o método `_importar_disciplinas_e_metas` inteiro por:

```python
    def _importar_disciplinas_e_servicos(
        self,
        projeto: Projeto,
        linhas: list[dict],
    ) -> None:
        for linha in linhas:
            unidade, _ = Unidade.objects.get_or_create(sigla=linha["unidade"])
            disciplina, _ = Disciplina.objects.get_or_create(
                projeto=projeto,
                nome=linha["disciplina"],
            )
            CatalogoServico.objects.update_or_create(
                disciplina=disciplina,
                nome=linha["atividade"],
                defaults={
                    "unidade": unidade,
                    "quantidade_planejada": linha["total"],
                },
            )
```

- [ ] **Step 3: Rodar manualmente e conferir**

Run: `cd backend && python manage.py seed_demo_data`
Expected: `Dados de demonstração criados com sucesso.` (sem `NameError`/`ImportError`).

Run: `cd backend && python manage.py shell -c "from buildflow.configuracoes.models import Disciplina; d = Disciplina.objects.filter(nome='Terraplenagem').first(); print(d.peso_percentual, d.servicos.first().quantidade_planejada, d.servicos.first().quantidade_executada)"`
Expected: `100 1000.000 500.000`

- [ ] **Step 4: Commit**

```bash
git add backend/buildflow/core/management/commands/seed_demo_data.py backend/buildflow/core/management/commands/seed_legacy_data.py
git commit -m "chore: seeds populam peso/quantidade em Disciplina/CatalogoServico em vez de MetaMensal"
```

---

## Task 6: Tipos TypeScript

**Files:**
- Modify: `frontend/src/types/configuracao.ts` (arquivo inteiro)

**Interfaces:**
- Produces: `CatalogoServico` (novo tipo exportado), `Disciplina` (ganha `peso_percentual`/`avanco_percentual`, `servicos: CatalogoServico[]`), `ConfiguracaoProjeto` (perde `metas`, `soma_pesos_metas` vira `soma_pesos_disciplinas`).

- [ ] **Step 1: Reescrever o arquivo**

```typescript
import type { Equipe } from './registroDiario'

export interface CatalogoServico {
  id: string
  nome: string
  unidade: number
  peso_percentual: string | null
  quantidade_planejada: string | null
  quantidade_executada: string
  avanco_percentual: string | null
}

export interface Disciplina {
  id: string
  nome: string
  peso_percentual: string | null
  servicos: CatalogoServico[]
  avanco_percentual: string | null
}

export interface ValorCusto {
  id: string
  tipo: 'mao_de_obra' | 'equipamento'
  descricao: string
  valor: string
  funcao: string
  maquina: string | null
}

export interface ConfiguracaoProjeto {
  disciplinas: Disciplina[]
  equipes: Equipe[]
  valores_custo: ValorCusto[]
  soma_pesos_disciplinas: number
}
```

- [ ] **Step 2: Verificar erros de tipo (esperado haver, corrigidos nas próximas tasks)**

Run: `cd frontend && npx tsc --noEmit`
Expected: erros em `configuracaoApi.ts` e `ConfiguracaoPage.tsx` referenciando `MetaMensal`/`metas`/`soma_pesos_metas` — serão corrigidos nas Tasks 7 e 8. Não corrigir esses arquivos aqui.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/configuracao.ts
git commit -m "feat: tipos de EAP (Disciplina/CatalogoServico com peso e quantidade)"
```

---

## Task 7: Hooks de API (configuracaoApi.ts)

**Files:**
- Modify: `frontend/src/features/configuracoes/configuracaoApi.ts` (arquivo inteiro)

**Interfaces:**
- Consumes: `CatalogoServico`, `Disciplina`, `ConfiguracaoProjeto`, `ValorCusto` de `types/configuracao.ts` (Task 6).
- Produces: `useCriarDisciplina(projetoId)` (assinatura muda: agora recebe `{ nome, peso_percentual? }`); `useAtualizarDisciplina(projetoId)`; `useCriarServico(projetoId)`; `useAtualizarServico(projetoId)` — usados por `EapDisciplinaCard` (Task 8).

- [ ] **Step 1: Reescrever o arquivo**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { CatalogoServico, ConfiguracaoProjeto, Disciplina, ValorCusto } from '../../types/configuracao'
import type { Equipe, Maquina, Pessoa } from '../../types/registroDiario'

export function useConfiguracaoProjeto(projetoId: string) {
  return useQuery({
    queryKey: ['configuracao', projetoId],
    queryFn: () => apiClient.get<ConfiguracaoProjeto>(`/api/v1/projetos/${projetoId}/configuracao/`),
  })
}

function useInvalidarConfiguracao(projetoId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['configuracao', projetoId] })
    void queryClient.invalidateQueries({ queryKey: ['configuracao-rdo', projetoId] })
  }
}

export function useCriarDisciplina(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (values: { nome: string; peso_percentual?: string }) =>
      apiClient.post<Disciplina>(`/api/v1/projetos/${projetoId}/configuracao/disciplinas/`, values),
    onSuccess: invalidar,
  })
}

export function useAtualizarDisciplina(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({ disciplinaId, peso_percentual }: { disciplinaId: string; peso_percentual: string }) =>
      apiClient.patch<Disciplina>(`/api/v1/configuracoes/disciplinas/${disciplinaId}/`, { peso_percentual }),
    onSuccess: invalidar,
  })
}

export function useCriarServico(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({
      disciplinaId,
      nome,
      unidade,
      peso_percentual,
      quantidade_planejada,
    }: {
      disciplinaId: string
      nome: string
      unidade: number
      peso_percentual?: string
      quantidade_planejada?: string
    }) =>
      apiClient.post<CatalogoServico>(`/api/v1/configuracoes/disciplinas/${disciplinaId}/servicos/`, {
        nome,
        unidade,
        peso_percentual,
        quantidade_planejada,
      }),
    onSuccess: invalidar,
  })
}

export function useAtualizarServico(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({
      servicoId,
      ...values
    }: {
      servicoId: string
      peso_percentual?: string
      quantidade_planejada?: string
      quantidade_executada?: string
    }) => apiClient.patch<CatalogoServico>(`/api/v1/configuracoes/servicos/${servicoId}/`, values),
    onSuccess: invalidar,
  })
}

export function useCriarEquipe(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (nome: string) =>
      apiClient.post<Equipe>(`/api/v1/projetos/${projetoId}/configuracao/equipes/`, { nome }),
    onSuccess: invalidar,
  })
}

export function useCriarPessoa(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({ equipeId, nome, funcao }: { equipeId: string; nome: string; funcao: string }) =>
      apiClient.post<Pessoa>(`/api/v1/configuracoes/equipes/${equipeId}/pessoas/`, { nome, funcao }),
    onSuccess: invalidar,
  })
}

export function useCriarMaquina(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: ({ equipeId, codigo, nome }: { equipeId: string; codigo: string; nome: string }) =>
      apiClient.post<Maquina>(`/api/v1/configuracoes/equipes/${equipeId}/maquinas/`, { codigo, nome }),
    onSuccess: invalidar,
  })
}

export function useCriarValorCusto(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (values: {
      tipo: string
      descricao: string
      valor: string
      funcao?: string
      maquina?: string
    }) => apiClient.post<ValorCusto>(`/api/v1/projetos/${projetoId}/configuracao/valores/`, values),
    onSuccess: invalidar,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/configuracoes/configuracaoApi.ts
git commit -m "feat: hooks de peso/quantidade para Disciplina e Servico (EAP)"
```

---

## Task 8: Aba EAP em ConfiguracaoPage

**Files:**
- Modify: `frontend/src/components/ui/form-field.tsx` (arquivo inteiro — adiciona `className`)
- Create: `frontend/src/features/configuracoes/EapDisciplinaCard.tsx`
- Modify: `frontend/src/pages/ConfiguracaoPage.tsx:1-29` (imports e estado), `:47-99` (destructuring e `TabsList`), `:136-204` (troca do bloco "Metas" por "EAP")

**Interfaces:**
- Consumes: `useAtualizarDisciplina`, `useCriarServico`, `useAtualizarServico` de `configuracaoApi.ts` (Task 7); `useConfiguracaoRdo` (já existe em `features/registros-diarios/registrosDiariosApi.ts`, usado só para a lista de `unidades` no formulário de novo serviço); `execucaoCorClasse`/`formatExecucao` de `lib/format.ts` (já existem).
- Produces: `EapDisciplinaCard` (componente exportado, usado por `ConfiguracaoPage`).

- [ ] **Step 1: `FormField` ganha `className` (mesmo padrão já usado em `Card`)**

Reescrever `frontend/src/components/ui/form-field.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FormFieldProps {
  id: string
  label: string
  error?: string | null
  className?: string
  children: ReactNode
}

export function FormField({ id, label, error, className, children }: FormFieldProps) {
  return (
    <div className={cn('mb-4 flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-erro`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar `EapDisciplinaCard.tsx`**

```tsx
import { ChevronDown, ChevronRight, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { toast } from '../../hooks/use-toast'
import { execucaoCorClasse, formatExecucao } from '../../lib/format'
import type { CatalogoServico, Disciplina } from '../../types/configuracao'
import type { Unidade } from '../../types/registroDiario'
import { Button, FormField, Input, Progress, SelectField } from '../../components/ui'
import { useAtualizarDisciplina, useAtualizarServico, useCriarServico } from './configuracaoApi'

const TOLERANCIA_SOMA_PESOS = 0.01

function somaPesosServicos(disciplina: Disciplina): number {
  return disciplina.servicos.reduce(
    (total, servico) => total + (servico.peso_percentual ? Number(servico.peso_percentual) : 0),
    0,
  )
}

interface EapDisciplinaCardProps {
  projetoId: string
  disciplina: Disciplina
  unidades: Unidade[]
}

export function EapDisciplinaCard({ projetoId, disciplina, unidades }: EapDisciplinaCardProps) {
  const [expandido, setExpandido] = useState(false)
  const [peso, setPeso] = useState(disciplina.peso_percentual ?? '')
  const [novoServicoNome, setNovoServicoNome] = useState('')
  const [novoServicoUnidade, setNovoServicoUnidade] = useState('')
  const [novoServicoPeso, setNovoServicoPeso] = useState('')
  const [novoServicoQuantidade, setNovoServicoQuantidade] = useState('')

  const atualizarDisciplina = useAtualizarDisciplina(projetoId)
  const criarServico = useCriarServico(projetoId)

  const somaServicos = somaPesosServicos(disciplina)
  const somaServicosForaDoAlvo =
    disciplina.servicos.length > 0 && Math.abs(somaServicos - 100) > TOLERANCIA_SOMA_PESOS

  function salvarPesoDisciplina() {
    if (peso === (disciplina.peso_percentual ?? '')) return
    atualizarDisciplina.mutate(
      { disciplinaId: disciplina.id, peso_percentual: peso },
      { onError: () => toast({ title: 'Não foi possível atualizar o peso da disciplina.', variant: 'destructive' }) },
    )
  }

  return (
    <li className="rounded-lg border border-border p-3 text-sm text-ink">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setExpandido((valor) => !valor)}
          aria-expanded={expandido}
          aria-label={expandido ? `Recolher ${disciplina.nome}` : `Expandir ${disciplina.nome}`}
          className="text-muted-foreground hover:text-ink"
        >
          {expandido ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>
        <ListChecks size={14} className="text-primary" aria-hidden="true" />
        <span className="flex-1 font-display font-semibold">{disciplina.nome}</span>
        <div className="flex w-40 items-center gap-2">
          <Progress
            value={disciplina.avanco_percentual ? Number(disciplina.avanco_percentual) : 0}
            indicatorClassName={execucaoCorClasse(disciplina.avanco_percentual)}
          />
          <span className="w-12 text-right text-xs text-muted-foreground">
            {formatExecucao(disciplina.avanco_percentual)}
          </span>
        </div>
        <FormField id={`peso-disciplina-${disciplina.id}`} label="Peso (%)" className="mb-0 w-24">
          <Input
            id={`peso-disciplina-${disciplina.id}`}
            value={peso}
            onChange={(event) => setPeso(event.target.value)}
            onBlur={salvarPesoDisciplina}
          />
        </FormField>
      </div>

      {expandido && (
        <div className="mt-3 pl-7">
          {disciplina.servicos.length === 0 && (
            <p className="mb-3 text-xs text-muted-foreground">Nenhum serviço cadastrado nesta disciplina ainda.</p>
          )}
          <ul className="mb-3 flex flex-col gap-2">
            {disciplina.servicos.map((servico) => (
              <EapServicoRow key={servico.id} projetoId={projetoId} servico={servico} />
            ))}
          </ul>
          {somaServicosForaDoAlvo && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700">
              Atenção: a soma dos pesos dos serviços desta disciplina não fecha 100% ({somaServicos}%).
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <SelectField
              id={`novo-servico-unidade-${disciplina.id}`}
              label="Unidade"
              value={novoServicoUnidade}
              onChange={setNovoServicoUnidade}
              options={unidades.map((unidade) => ({ value: String(unidade.id), label: unidade.sigla }))}
            />
            <FormField id={`novo-servico-nome-${disciplina.id}`} label="Novo serviço">
              <Input
                id={`novo-servico-nome-${disciplina.id}`}
                value={novoServicoNome}
                onChange={(event) => setNovoServicoNome(event.target.value)}
              />
            </FormField>
            <FormField id={`novo-servico-peso-${disciplina.id}`} label="Peso (%)">
              <Input
                id={`novo-servico-peso-${disciplina.id}`}
                value={novoServicoPeso}
                onChange={(event) => setNovoServicoPeso(event.target.value)}
              />
            </FormField>
            <FormField id={`novo-servico-quantidade-${disciplina.id}`} label="Quantidade planejada">
              <Input
                id={`novo-servico-quantidade-${disciplina.id}`}
                value={novoServicoQuantidade}
                onChange={(event) => setNovoServicoQuantidade(event.target.value)}
              />
            </FormField>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!novoServicoNome.trim() || !novoServicoUnidade || criarServico.isPending}
                onClick={() =>
                  criarServico.mutate(
                    {
                      disciplinaId: disciplina.id,
                      nome: novoServicoNome,
                      unidade: Number(novoServicoUnidade),
                      peso_percentual: novoServicoPeso || undefined,
                      quantidade_planejada: novoServicoQuantidade || undefined,
                    },
                    {
                      onSuccess: () => {
                        setNovoServicoNome('')
                        setNovoServicoPeso('')
                        setNovoServicoQuantidade('')
                      },
                      onError: () => toast({ title: 'Não foi possível adicionar o serviço.', variant: 'destructive' }),
                    },
                  )
                }
              >
                Adicionar serviço
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

interface EapServicoRowProps {
  projetoId: string
  servico: CatalogoServico
}

function EapServicoRow({ projetoId, servico }: EapServicoRowProps) {
  const [peso, setPeso] = useState(servico.peso_percentual ?? '')
  const [quantidadePlanejada, setQuantidadePlanejada] = useState(servico.quantidade_planejada ?? '')
  const [quantidadeExecutada, setQuantidadeExecutada] = useState(servico.quantidade_executada)

  const atualizarServico = useAtualizarServico(projetoId)

  function salvar(
    campo: 'peso_percentual' | 'quantidade_planejada' | 'quantidade_executada',
    valor: string,
    valorOriginal: string,
  ) {
    if (valor === valorOriginal) return
    atualizarServico.mutate(
      { servicoId: servico.id, [campo]: valor },
      { onError: () => toast({ title: 'Não foi possível atualizar o serviço.', variant: 'destructive' }) },
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2 text-xs">
      <span className="flex-1 font-medium text-ink">{servico.nome}</span>
      <div className="flex w-32 items-center gap-2">
        <Progress
          value={servico.avanco_percentual ? Number(servico.avanco_percentual) : 0}
          indicatorClassName={execucaoCorClasse(servico.avanco_percentual)}
        />
        <span className="w-10 text-right text-muted-foreground">{formatExecucao(servico.avanco_percentual)}</span>
      </div>
      <FormField id={`servico-peso-${servico.id}`} label="Peso (%)" className="mb-0 w-20">
        <Input
          id={`servico-peso-${servico.id}`}
          value={peso}
          onChange={(event) => setPeso(event.target.value)}
          onBlur={() => salvar('peso_percentual', peso, servico.peso_percentual ?? '')}
        />
      </FormField>
      <FormField id={`servico-planejada-${servico.id}`} label="Planejada" className="mb-0 w-24">
        <Input
          id={`servico-planejada-${servico.id}`}
          value={quantidadePlanejada}
          onChange={(event) => setQuantidadePlanejada(event.target.value)}
          onBlur={() => salvar('quantidade_planejada', quantidadePlanejada, servico.quantidade_planejada ?? '')}
        />
      </FormField>
      <FormField id={`servico-executada-${servico.id}`} label="Executada" className="mb-0 w-24">
        <Input
          id={`servico-executada-${servico.id}`}
          value={quantidadeExecutada}
          onChange={(event) => setQuantidadeExecutada(event.target.value)}
          onBlur={() => salvar('quantidade_executada', quantidadeExecutada, servico.quantidade_executada)}
        />
      </FormField>
    </li>
  )
}
```

- [ ] **Step 3: Atualizar `ConfiguracaoPage.tsx`**

Substituir as linhas 1-29 (imports) por:

```tsx
import { BookOpen, DollarSign, HardHat, Truck, Users } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useConfiguracaoRdo } from '../features/registros-diarios/registrosDiariosApi'
import {
  useConfiguracaoProjeto,
  useCriarDisciplina,
  useCriarEquipe,
  useCriarMaquina,
  useCriarPessoa,
  useCriarValorCusto,
} from '../features/configuracoes/configuracaoApi'
import { EapDisciplinaCard } from '../features/configuracoes/EapDisciplinaCard'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import {
  Button,
  Card,
  EmptyState,
  ErrorRetry,
  FormField,
  Input,
  PageHeader,
  SelectField,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui'
import { toast } from '../hooks/use-toast'
```

Nas linhas 47-74 (corpo da função, hooks e estado), remover `criarMeta` e os três estados `metaDisciplinaId`/`metaValorAlvo`/`metaPeso`, e adicionar `useConfiguracaoRdo`:

```tsx
export function ConfiguracaoPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const configuracao = useConfiguracaoProjeto(projetoId ?? '')
  const configuracaoRdo = useConfiguracaoRdo(projetoId ?? '')
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Configurações' }])

  const criarDisciplina = useCriarDisciplina(projetoId ?? '')
  const criarEquipe = useCriarEquipe(projetoId ?? '')
  const criarPessoa = useCriarPessoa(projetoId ?? '')
  const criarMaquina = useCriarMaquina(projetoId ?? '')
  const criarValorCusto = useCriarValorCusto(projetoId ?? '')

  const [nomeDisciplina, setNomeDisciplina] = useState('')
  const [nomeEquipe, setNomeEquipe] = useState('')
  const [pessoaNome, setPessoaNome] = useState('')
  const [pessoaFuncao, setPessoaFuncao] = useState('')
  const [pessoaEquipeId, setPessoaEquipeId] = useState('')
  const [maquinaCodigo, setMaquinaCodigo] = useState('')
  const [maquinaNome, setMaquinaNome] = useState('')
  const [maquinaEquipeId, setMaquinaEquipeId] = useState('')
  const [valorTipo, setValorTipo] = useState<'mao_de_obra' | 'equipamento'>('mao_de_obra')
  const [valorDescricao, setValorDescricao] = useState('')
  const [valorValor, setValorValor] = useState('')
  const [valorFuncao, setValorFuncao] = useState('')
  const [valorMaquinaId, setValorMaquinaId] = useState('')
```

Atualizar a chamada de criação de disciplina (dentro do bloco `TabsContent value="disciplinas"`, no `onClick` do botão "Adicionar disciplina"):

```tsx
                <Button
                  onClick={() =>
                    criarDisciplina.mutate(
                      { nome: nomeDisciplina },
                      {
                        onSuccess: () => setNomeDisciplina(''),
                        onError: () => toast({ title: 'Não foi possível criar a disciplina.', variant: 'destructive' }),
                      },
                    )
                  }
                  disabled={!nomeDisciplina.trim() || criarDisciplina.isPending}
                >
                  Adicionar disciplina
                </Button>
```

Alterar o destructuring dos dados (era `const { disciplinas, equipes, metas, valores_custo: valoresCusto, soma_pesos_metas: somaPesos } = configuracao.data`):

```tsx
  const { disciplinas, equipes, valores_custo: valoresCusto, soma_pesos_disciplinas: somaPesos } =
    configuracao.data
```

Trocar o `TabsTrigger` (era `<TabsTrigger value="metas">Metas</TabsTrigger>`):

```tsx
          <TabsTrigger value="eap">EAP</TabsTrigger>
```

Substituir todo o bloco `<TabsContent value="metas">...</TabsContent>` (linhas 136-204 do arquivo original) por:

```tsx
        <TabsContent value="eap">
          <Card title="EAP">
            <div aria-label="EAP">
              {disciplinas.length === 0 && (
                <EmptyState>Cadastre uma disciplina na aba Disciplinas para começar a EAP.</EmptyState>
              )}
              <ul className="mb-4 flex flex-col gap-3">
                {disciplinas.map((disciplina) => (
                  <EapDisciplinaCard
                    key={disciplina.id}
                    projetoId={projetoId ?? ''}
                    disciplina={disciplina}
                    unidades={configuracaoRdo.data?.unidades ?? []}
                  />
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">Soma dos pesos das disciplinas: {somaPesos}%</p>
              {Math.abs(somaPesos - 100) > 0.01 && somaPesos > 0 && (
                <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
                  Atenção: a soma dos pesos das disciplinas não fecha 100%.
                </p>
              )}
            </div>
          </Card>
        </TabsContent>
```

- [ ] **Step 4: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Testar manualmente no navegador**

Run: `cd frontend && npm run dev` (e `cd backend && python manage.py runserver` em outro terminal)
Abrir `/projetos/<id>/configuracoes`, aba EAP: cadastrar peso em uma disciplina (blur salva), expandir, adicionar um serviço com peso/quantidade planejada, editar quantidade executada de um serviço existente (blur salva) e confirmar que a barra de avanço atualiza.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/form-field.tsx frontend/src/features/configuracoes/EapDisciplinaCard.tsx frontend/src/pages/ConfiguracaoPage.tsx
git commit -m "feat: aba EAP em Configuracoes (peso e quantidade por disciplina/servico)"
```

---

## Task 9: Reescrever e2e de Configurações

**Files:**
- Modify: `frontend/tests/e2e/config.spec.ts` (arquivo inteiro)

**Interfaces:**
- Consumes: rotas `POST /api/v1/configuracoes/disciplinas/<pk>/servicos/`, `PATCH /api/v1/configuracoes/disciplinas/<pk>/`, `GET /api/v1/projetos/<pk>/configuracao-rdo/` (Task 3).

- [ ] **Step 1: Reescrever o arquivo**

```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const CONFIG_URL = '**/api/v1/projetos/*/configuracao/'
const CONFIG_RDO_URL = '**/api/v1/projetos/*/configuracao-rdo/'
const DISCIPLINAS_URL = '**/api/v1/projetos/*/configuracao/disciplinas/'
const EQUIPES_URL = '**/api/v1/projetos/*/configuracao/equipes/'

const USUARIO = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const PROJETO_DETALHE_URL = '**/api/v1/projetos/*/'
const PROJETO_MOCK = {
  id: 'projeto-1',
  nome: 'Duplicação BR-365',
  descricao: '',
  numero_contrato: '',
  trecho: '',
  engenheiro_responsavel: '',
  status: 'ativo',
  execucao_percentual: '52',
  ultimo_rdo_data: '2026-07-17',
  criado_por: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

test.beforeEach(async ({ page }) => {
  await page.route(PROJETO_DETALHE_URL, (route) => route.fulfill({ json: PROJETO_MOCK }))
  await page.route(CONFIG_RDO_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [],
        unidades: [{ id: 1, sigla: 'm³', descricao: 'metro cúbico' }],
        equipes: [],
        motivos_parada: [],
        fiscais: [],
      },
    }),
  )
})

test('criar disciplina e equipe na configuração do projeto', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  let disciplinaCriada = false
  let equipeCriada = false

  await page.route(CONFIG_URL, (route) => {
    const disciplinas = disciplinaCriada
      ? [{ id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, servicos: [] }]
      : []
    const equipes = equipeCriada
      ? [{ id: 'equipe-1', nome: 'Equipe A', pessoas: [], maquinas: [] }]
      : []
    return route.fulfill({
      json: { disciplinas, equipes, valores_custo: [], soma_pesos_disciplinas: 0 },
    })
  })

  await page.route(DISCIPLINAS_URL, (route) => {
    disciplinaCriada = true
    return route.fulfill({
      status: 201,
      json: { id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, servicos: [] },
    })
  })

  await page.route(EQUIPES_URL, (route) => {
    equipeCriada = true
    return route.fulfill({
      status: 201,
      json: { id: 'equipe-1', nome: 'Equipe A', pessoas: [], maquinas: [] },
    })
  })

  await page.goto('/projetos/projeto-1/configuracoes')

  await expect(page.getByText('Nenhuma disciplina cadastrada ainda.')).toBeVisible()

  await page.getByLabel('Nova disciplina').fill('Terraplenagem')
  await page.getByRole('button', { name: 'Adicionar disciplina' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()

  await page.getByRole('tab', { name: 'Equipes' }).click()

  await page.getByLabel('Nova equipe').fill('Equipe A')
  await page.getByRole('button', { name: 'Adicionar equipe' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Equipe A' })).toBeVisible()
})

test('trocar de aba mantém a seção anterior preenchida ao voltar', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          { id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, servicos: [] },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 0,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')

  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()

  await page.getByLabel('Nova disciplina').fill('Rascunho')

  await page.getByRole('tab', { name: 'Valores' }).click()
  await expect(page.getByLabel('Descrição')).toBeVisible()

  await page.getByRole('tab', { name: 'Disciplinas' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Terraplenagem' })).toBeVisible()
  await expect(page.getByLabel('Nova disciplina')).toHaveValue('Rascunho')
})

test('tipo equipamento mostra seletor de máquina cadastrada em vez de função', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [],
        equipes: [
          {
            id: 'equipe-1',
            nome: 'Equipe A',
            pessoas: [],
            maquinas: [{ id: 'maquina-1', codigo: 'ESC-01', nome: 'Escavadeira 320D' }],
          },
        ],
        valores_custo: [],
        soma_pesos_disciplinas: 0,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'Valores' }).click()

  await expect(page.getByLabel('Função')).toBeVisible()
  await expect(page.getByLabel('Valor (R$/dia)')).toBeVisible()

  await page.getByLabel('Tipo').click()
  await page.getByRole('option', { name: 'Equipamento' }).click()

  await expect(page.getByLabel('Função')).not.toBeVisible()
  await expect(page.getByLabel('Máquina')).toBeVisible()
  await expect(page.getByLabel('Valor (R$/hora)')).toBeVisible()

  await page.getByLabel('Máquina').click()
  await expect(page.getByRole('option', { name: 'Escavadeira 320D (ESC-01)' })).toBeVisible()
})

test('define peso da disciplina e adiciona serviço na aba EAP', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  let pesoDisciplina: string | null = null
  let servicoCriado = false

  await page.route(CONFIG_URL, (route) => {
    const disciplina = {
      id: 'disc-1',
      nome: 'Terraplenagem',
      peso_percentual: pesoDisciplina,
      avanco_percentual: null,
      servicos: servicoCriado
        ? [
            {
              id: 'serv-1',
              nome: 'Corte',
              unidade: 1,
              peso_percentual: null,
              quantidade_planejada: null,
              quantidade_executada: '0.000',
              avanco_percentual: null,
            },
          ]
        : [],
    }
    return route.fulfill({
      json: {
        disciplinas: [disciplina],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: pesoDisciplina ? Number(pesoDisciplina) : 0,
      },
    })
  })

  await page.route('**/api/v1/configuracoes/disciplinas/disc-1/', (route) => {
    pesoDisciplina = '100.00'
    return route.fulfill({
      json: {
        id: 'disc-1',
        nome: 'Terraplenagem',
        peso_percentual: '100.00',
        avanco_percentual: null,
        servicos: [],
      },
    })
  })

  await page.route('**/api/v1/configuracoes/disciplinas/disc-1/servicos/', (route) => {
    servicoCriado = true
    return route.fulfill({
      status: 201,
      json: {
        id: 'serv-1',
        nome: 'Corte',
        unidade: 1,
        peso_percentual: null,
        quantidade_planejada: null,
        quantidade_executada: '0.000',
        avanco_percentual: null,
      },
    })
  })

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()

  await page.getByLabel('Peso (%)').first().fill('100')
  await page.getByLabel('Peso (%)').first().blur()
  await expect.poll(() => pesoDisciplina).toBe('100.00')

  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await page.getByLabel('Unidade').click()
  await page.getByRole('option', { name: 'm³' }).click()
  await page.getByLabel('Novo serviço').fill('Corte')
  await page.getByRole('button', { name: 'Adicionar serviço' }).click()

  await expect(page.getByText('Corte')).toBeVisible()
})
```

- [ ] **Step 2: Rodar a suíte e2e**

Run: `cd frontend && npx playwright test tests/e2e/config.spec.ts`
Expected: `4 passed`

- [ ] **Step 3: Rodar a suíte e2e completa**

Run: `cd frontend && npx playwright test`
Expected: nenhuma regressão em outros specs (nenhum outro arquivo referenciava `metas`/`soma_pesos_metas`, confirmado por busca prévia no repositório).

- [ ] **Step 4: Commit**

```bash
git add frontend/tests/e2e/config.spec.ts
git commit -m "test: e2e da aba EAP (peso de disciplina e criacao de servico)"
```

---

## Self-Review

**Cobertura da spec:**
- Estrutura de 2 níveis com peso em cada nível → Task 1 (model) + Task 3 (API) + Task 8 (UI).
- Quantidade planejada/executada manual → Task 1 (model) + Task 3 (serializer/endpoint) + Task 8 (input inline).
- `calcular_execucao_percentual` reescrito em 2 passos, nunca inventa número → Task 2.
- `MetaMensal` removido (model, serializer, views, urls, admin, migração de dados) → Task 4.
- Endpoints novos de `CatalogoServico` (antes inexistentes) → Task 3.
- Permissão `IsGerente` para escrita em Disciplina/Serviço, leitura continua aberta → Task 3 (`get_permissions` por ação em `DisciplinaViewSet`, tupla fixa nos demais).
- Seeds (`seed_demo_data.py`, `seed_legacy_data.py`) → Task 5.
- Frontend: aba "Metas" vira "EAP", tipos, hooks, componente, e2e → Tasks 6-9.

**Placeholders:** nenhum `TBD`/`TODO` — toda task tem código completo e comandos exatos com saída esperada.

**Consistência de tipos:** `calcular_avanco_servico`/`calcular_avanco_disciplina`/`calcular_execucao_percentual` usados com a mesma assinatura em `services.py` (Task 2), `configuracoes/serializers.py` (Task 3) e testes (Tasks 2-4). `CatalogoServicoSerializer`/`DisciplinaSerializer` (Task 3) e os tipos `CatalogoServico`/`Disciplina` do frontend (Task 6) têm os mesmos campos (`peso_percentual`, `quantidade_planejada`, `quantidade_executada`, `avanco_percentual`). Hooks `useAtualizarDisciplina`/`useCriarServico`/`useAtualizarServico` (Task 7) usados com os mesmos nomes de parâmetro em `EapDisciplinaCard` (Task 8).

**Escopo:** cada task termina em um estado testável e committável isoladamente; nenhuma task depende de código de uma task posterior (dependências são estritamente Task 1 → 2 → 3 → 4 → 5 no backend, e Task 6 → 7 → 8 → 9 no frontend, com Task 3 sendo pré-requisito das tasks de frontend).
