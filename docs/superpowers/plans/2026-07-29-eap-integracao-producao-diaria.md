# EAP — Integração com Produção Diária Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar `ProducaoDiaria` (lançamentos de RDO) ao `CatalogoServico` da EAP, para que a quantidade
executada some automaticamente, mantendo um ajuste manual visível separado para produção anterior ao
uso do sistema, e uma lista de rastreabilidade dos lançamentos que compõem o total.

**Architecture:** `CatalogoServico.quantidade_executada` (hoje editável) é renomeado para
`quantidade_executada_manual` (o ajuste). Uma nova função em `projetos/services.py` soma
`ProducaoDiaria.quantidade` filtrado por serviço + o ajuste manual — sempre recalculada em tempo de
leitura, nunca armazenada, mesmo padrão de `calcular_avanco_disciplina`/`calcular_execucao_percentual`.
O serializer expõe o total como campo computado (`quantidade_executada`) e uma lista de lançamentos
vinculados (`producoes_vinculadas`); o frontend mostra o total com o detalhamento e um toggle para ver
os lançamentos.

**Tech Stack:** Django 6 / DRF (backend), React + TanStack Query + TypeScript (frontend), pytest,
Playwright.

## Global Constraints

- Nunca inventa número: sem `quantidade_planejada`, `calcular_avanco_servico` continua retornando
  `None` — essa regra não muda.
- O total (`quantidade_executada`) é sempre `quantidade_executada_manual + soma(ProducaoDiaria.quantidade)`,
  recalculado a cada leitura — nunca um campo armazenado.
- Sem paginação em `producoes_vinculadas` (YAGNI na escala atual dos projetos) — mesma decisão já
  registrada na spec.
- Permissão de escrita inalterada: `IsAuthenticatedWithEmpresa` + `IsGerente` em
  `ServicoDetailViewSet` (já existe, não precisa de mudança).
- `seed_legacy_data.py` não muda (planilha legada não tem quantidade executada nem ajuste).

---

### Task 1: Camada de cálculo — renomear campo e somar Produção Diária

**Files:**
- Modify: `backend/buildflow/configuracoes/models.py:111-116`
- Create: `backend/buildflow/configuracoes/migrations/0009_rename_quantidade_executada_manual.py`
- Modify: `backend/buildflow/configuracoes/admin.py:33`
- Modify: `backend/buildflow/configuracoes/serializers.py:41` (só o nome do campo em `Meta.fields`, ainda como campo de escrita simples — o campo computado volta na Task 2)
- Modify: `backend/buildflow/projetos/services.py:1-29`
- Modify: `backend/buildflow/core/management/commands/seed_demo_data.py:91-98`
- Test: `backend/buildflow/projetos/tests/test_execucao.py`
- Modify: `backend/buildflow/projetos/tests/test_dashboard.py:114`
- Modify: `backend/buildflow/projetos/tests/test_api.py:160`
- Modify: `backend/buildflow/configuracoes/tests/test_models.py:39-69`
- Modify: `backend/buildflow/configuracoes/tests/test_api.py:149,162,189`

**Interfaces:**
- Produces: `calcular_quantidade_executada_total(servico: CatalogoServico) -> Decimal` em
  `buildflow/projetos/services.py` — usado pela Task 2 no serializer.
- Produces: campo `CatalogoServico.quantidade_executada_manual` (renomeado de `quantidade_executada`).

- [ ] **Step 1: Renomear o campo no model**

Em `backend/buildflow/configuracoes/models.py`, substitua (linhas 111-116):

```python
    quantidade_executada = models.DecimalField(
        _("quantidade executada"),
        max_digits=12,
        decimal_places=3,
        default=Decimal("0"),
    )
```

por:

```python
    quantidade_executada_manual = models.DecimalField(
        _("quantidade executada (ajuste manual)"),
        max_digits=12,
        decimal_places=3,
        default=Decimal("0"),
    )
```

- [ ] **Step 2: Criar a migração manualmente**

Não use `manage.py makemigrations` interativo aqui — o autodetector pede confirmação por prompt pra
distinguir rename de remove+add, o que trava execução não-interativa. Crie o arquivo diretamente:

`backend/buildflow/configuracoes/migrations/0009_rename_quantidade_executada_manual.py`:

```python
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("configuracoes", "0008_remove_metamensal"),
    ]

    operations = [
        migrations.RenameField(
            model_name="catalogoservico",
            old_name="quantidade_executada",
            new_name="quantidade_executada_manual",
        ),
    ]
```

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run python manage.py makemigrations --check --dry-run`
Expected: `No changes detected` (confirma que a migração escrita à mão já cobre o rename).

- [ ] **Step 3: Atualizar `admin.py`**

Em `backend/buildflow/configuracoes/admin.py`, no `CatalogoServicoInline.fields` (linha 33), troque
`"quantidade_executada",` por `"quantidade_executada_manual",`.

- [ ] **Step 4: Atualizar `serializers.py` (só o nome do campo por enquanto)**

Em `backend/buildflow/configuracoes/serializers.py`, no `CatalogoServicoSerializer.Meta.fields`
(linha 41), troque `"quantidade_executada",` por `"quantidade_executada_manual",`. Não mexa em mais
nada neste arquivo agora — o campo computado `quantidade_executada` volta na Task 2.

- [ ] **Step 5: Rodar a suite completa e confirmar que agora falha**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/ -q`
Expected: várias falhas com `TypeError: ... got an unexpected keyword argument 'quantidade_executada'`
ou `AttributeError` — sinal de que o rename quebrou os fixtures/seed que ainda usam o nome antigo.

- [ ] **Step 6: Corrigir todos os usos quebrados (rename mecânico)**

Em `backend/buildflow/projetos/tests/test_execucao.py`: troque **toda** ocorrência do argumento
`quantidade_executada=` por `quantidade_executada_manual=` (8 ocorrências, uma em cada teste que cria
um `CatalogoServico` com esse argumento). Nenhuma outra mudança nesses testes existentes.

Em `backend/buildflow/projetos/tests/test_dashboard.py`, linha 114: troque
`quantidade_executada=Decimal("400"),` por `quantidade_executada_manual=Decimal("400"),`.

Em `backend/buildflow/projetos/tests/test_api.py`, linha 160: troque
`quantidade_executada=Decimal("250"),` por `quantidade_executada_manual=Decimal("250"),`.

Em `backend/buildflow/configuracoes/tests/test_models.py`:
- Linha 48: troque `assert servico.quantidade_executada == Decimal("0")` por
  `assert servico.quantidade_executada_manual == Decimal("0")`.
- Linha 64: troque `quantidade_executada=Decimal("250.000"),` por
  `quantidade_executada_manual=Decimal("250.000"),`.
- Linha 69: troque `assert servico.quantidade_executada == Decimal("250.000")` por
  `assert servico.quantidade_executada_manual == Decimal("250.000")`.

Em `backend/buildflow/configuracoes/tests/test_api.py`:
- Linha 149: troque `assert body["quantidade_executada"] == "0.000"` por
  `assert body["quantidade_executada_manual"] == "0.000"`.
- Linha 162: troque `{"quantidade_planejada": "1000.000", "quantidade_executada": "250.000"}` por
  `{"quantidade_planejada": "1000.000", "quantidade_executada_manual": "250.000"}`.
- Linha 189: troque `"quantidade_executada": "1000.000",` por
  `"quantidade_executada_manual": "1000.000",`.

Em `backend/buildflow/core/management/commands/seed_demo_data.py`, dentro de
`_seed_configuracao_e_rdo` (linhas 91-98), remova a linha `quantidade_executada=500,` do
`CatalogoServico.objects.create(...)` (deixe o default `0`). A mesma função já cria, logo abaixo, um
`ProducaoDiaria` de quantidade `500` vinculado a esse serviço (linhas 136-144) — depois do Step 10
deste task, esse RDO já soma sozinho no total, então o valor manual duplicado não é mais necessário
para manter a demonstração de 50% de avanço.

- [ ] **Step 7: Rodar a suite completa e confirmar que volta a passar**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/ -q`
Expected: `182 passed` (mesmo número de antes — comportamento idêntico, só renomeado).

- [ ] **Step 8: Escrever os testes novos (TDD) para a soma automática de RDO**

Em `backend/buildflow/projetos/tests/test_execucao.py`, adicione no topo do arquivo (junto aos
imports existentes):

```python
from buildflow.configuracoes.models import Equipe
from buildflow.projetos.services import calcular_quantidade_executada_total
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario
```

E no final do arquivo, adicione:

```python
def test_quantidade_executada_total_soma_producoes_diarias_do_servico():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    registro_1 = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )
    registro_2 = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-02",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_1,
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
        registro_diario=registro_2,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("1.000"),
        km_final=Decimal("2.000"),
        quantidade=Decimal("150.000"),
        unidade=unidade,
    )

    assert calcular_quantidade_executada_total(servico) == Decimal("250.000")


def test_quantidade_executada_total_soma_ajuste_manual_e_producoes_diarias():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("300.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
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
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("100.000"),
        unidade=unidade,
    )

    assert calcular_quantidade_executada_total(servico) == Decimal("400.000")


def test_quantidade_executada_total_sem_producoes_usa_so_ajuste_manual():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("500.000"),
    )

    assert calcular_quantidade_executada_total(servico) == Decimal("500.000")


def test_avanco_servico_usa_soma_de_producoes_diarias():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
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
        km_inicial=Decimal("0.000"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("400.000"),
        unidade=unidade,
    )

    assert calcular_avanco_servico(servico) == Decimal("40.00")
```

- [ ] **Step 9: Rodar e confirmar que os 4 testes novos falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v -k "quantidade_executada_total or test_avanco_servico_usa_soma"`
Expected: `FAIL` com `ImportError: cannot import name 'calcular_quantidade_executada_total'`.

- [ ] **Step 10: Implementar `calcular_quantidade_executada_total` e usar em `calcular_avanco_servico`**

Em `backend/buildflow/projetos/services.py`, troque a linha de import (linha 7):

```python
from django.db.models import Count
```

por:

```python
from django.db.models import Count
from django.db.models import Sum
```

Adicione o import do model real (não só em `TYPE_CHECKING`, já que a função nova usa em tempo de
execução), logo abaixo do import de `RegistroDiario` (linha 10):

```python
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.registros_diarios.models import ProducaoDiaria
```

Substitua `calcular_avanco_servico` (linhas 22-29) por:

```python
def calcular_quantidade_executada_total(servico: CatalogoServico) -> Decimal:
    """Quantidade executada de um servico: soma dos lancamentos de ProducaoDiaria
    vinculados a ele, mais o ajuste manual (producao anterior ao uso do sistema
    ou correcoes pontuais). Sempre recalculada, nunca armazenada.
    """
    soma_rdo = (
        ProducaoDiaria.objects.filter(servico=servico)
        .aggregate(total=Sum("quantidade"))["total"]
        or Decimal("0")
    )
    return servico.quantidade_executada_manual + soma_rdo


def calcular_avanco_servico(servico: CatalogoServico) -> Decimal | None:
    """Percentual executado de um servico: quantidade_executada / quantidade_planejada.
    Retorna None quando nao ha quantidade planejada — nunca inventa um numero.
    """
    if not servico.quantidade_planejada:
        return None
    quantidade_executada = calcular_quantidade_executada_total(servico)
    proporcao = quantidade_executada / servico.quantidade_planejada
    return (proporcao * Decimal("100")).quantize(Decimal("0.01"))
```

- [ ] **Step 11: Rodar os testes novos e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v`
Expected: todos os testes do arquivo `PASSED`.

- [ ] **Step 12: Rodar a suite completa do backend**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/ -q`
Expected: `186 passed` (182 de antes + 4 novos).

- [ ] **Step 13: Ruff e commit**

Run: `cd backend && uv run ruff format buildflow/projetos/services.py buildflow/projetos/tests/test_execucao.py buildflow/configuracoes/models.py buildflow/configuracoes/admin.py buildflow/configuracoes/serializers.py buildflow/core/management/commands/seed_demo_data.py && uv run ruff check buildflow/projetos/services.py buildflow/projetos/tests/test_execucao.py buildflow/configuracoes/models.py buildflow/configuracoes/admin.py buildflow/configuracoes/serializers.py buildflow/core/management/commands/seed_demo_data.py`
Expected: `All checks passed!`

```bash
git add backend/buildflow/configuracoes/models.py \
  backend/buildflow/configuracoes/migrations/0009_rename_quantidade_executada_manual.py \
  backend/buildflow/configuracoes/admin.py \
  backend/buildflow/configuracoes/serializers.py \
  backend/buildflow/projetos/services.py \
  backend/buildflow/core/management/commands/seed_demo_data.py \
  backend/buildflow/projetos/tests/test_execucao.py \
  backend/buildflow/projetos/tests/test_dashboard.py \
  backend/buildflow/projetos/tests/test_api.py \
  backend/buildflow/configuracoes/tests/test_models.py \
  backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: soma automatica de Producao Diaria na quantidade executada da EAP"
```

---

### Task 2: API — total computado, campo de ajuste e rastreabilidade de lançamentos

**Files:**
- Modify: `backend/buildflow/projetos/services.py`
- Modify: `backend/buildflow/configuracoes/serializers.py`
- Modify: `backend/buildflow/configuracoes/tests/test_api.py`

**Interfaces:**
- Consumes: `calcular_quantidade_executada_total(servico: CatalogoServico) -> Decimal` (Task 1).
- Produces: `listar_producoes_vinculadas(servico: CatalogoServico) -> list[ProducaoDiaria]` em
  `buildflow/projetos/services.py` — usado só pelo serializer nesta task.
- Produces: campos JSON `quantidade_executada` (computado, read-only) e `producoes_vinculadas`
  (`[{data_referencia, quantidade}]`, read-only) no `CatalogoServicoSerializer`.

Nota de escala: `producoes_vinculadas` faz uma query por serviço (sem prefetch) — aceitável na escala
atual dos projetos (mesma decisão de "sem paginação" já registrada na spec); não otimizar agora.

- [ ] **Step 1: Escrever o teste falho para `listar_producoes_vinculadas`**

Em `backend/buildflow/projetos/tests/test_execucao.py`, adicione o import (junto aos demais no topo):

```python
from buildflow.projetos.services import listar_producoes_vinculadas
```

E no final do arquivo:

```python
def test_listar_producoes_vinculadas_ordena_do_mais_recente_para_o_mais_antigo():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("1000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    registro_antigo = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-01",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
    )
    registro_recente = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-10",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
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

    resultado = listar_producoes_vinculadas(servico)

    assert [str(p.quantidade) for p in resultado] == ["150.000", "100.000"]
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v -k listar_producoes_vinculadas`
Expected: `FAIL` com `ImportError: cannot import name 'listar_producoes_vinculadas'`.

- [ ] **Step 3: Implementar `listar_producoes_vinculadas`**

Em `backend/buildflow/projetos/services.py`, adicione logo depois de
`calcular_quantidade_executada_total`:

```python
def listar_producoes_vinculadas(servico: CatalogoServico) -> list[ProducaoDiaria]:
    """Lancamentos de RDO vinculados a um servico, do mais recente para o mais
    antigo — usado para exibir rastreabilidade do total executado."""
    return list(
        ProducaoDiaria.objects.filter(servico=servico)
        .select_related("registro_diario")
        .order_by("-registro_diario__data_referencia"),
    )
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v`
Expected: todos `PASSED`.

- [ ] **Step 5: Atualizar o serializer**

Em `backend/buildflow/configuracoes/serializers.py`, troque o import (linhas 3-5):

```python
from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import decimal_para_str_ou_none
```

por:

```python
from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import calcular_quantidade_executada_total
from buildflow.projetos.services import decimal_para_str_ou_none
from buildflow.projetos.services import listar_producoes_vinculadas
```

Substitua a classe `CatalogoServicoSerializer` inteira por:

```python
class CatalogoServicoSerializer(serializers.ModelSerializer):
    avanco_percentual = serializers.SerializerMethodField()
    quantidade_executada = serializers.SerializerMethodField()
    producoes_vinculadas = serializers.SerializerMethodField()

    class Meta:
        model = CatalogoServico
        fields = [
            "id",
            "nome",
            "unidade",
            "peso_percentual",
            "quantidade_planejada",
            "quantidade_executada_manual",
            "quantidade_executada",
            "producoes_vinculadas",
            "avanco_percentual",
        ]

    def get_avanco_percentual(self, obj: CatalogoServico) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_servico(obj))

    def get_quantidade_executada(self, obj: CatalogoServico) -> str:
        return str(calcular_quantidade_executada_total(obj))

    def get_producoes_vinculadas(self, obj: CatalogoServico) -> list[dict]:
        return [
            {
                "data_referencia": producao.registro_diario.data_referencia.isoformat(),
                "quantidade": str(producao.quantidade),
            }
            for producao in listar_producoes_vinculadas(obj)
        ]
```

- [ ] **Step 6: Atualizar os testes de API existentes que dependem do campo computado**

Em `backend/buildflow/configuracoes/tests/test_api.py`:

- Linha 149 (`test_criar_servico_no_catalogo_da_disciplina`): logo abaixo de
  `assert body["quantidade_executada_manual"] == "0.000"`, adicione
  `assert body["quantidade_executada"] == "0.000"` e `assert body["producoes_vinculadas"] == []`.

- `test_patch_servico_atualiza_peso_quantidade_e_recalcula_avanco` (em torno da linha 167): logo
  abaixo de `assert response.json()["avanco_percentual"] == "25.00"`, adicione
  `assert response.json()["quantidade_executada"] == "250.000"`.

- [ ] **Step 7: Escrever os testes novos de API (TDD)**

No topo de `backend/buildflow/configuracoes/tests/test_api.py`, adicione os imports:

```python
from decimal import Decimal

from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario
```

E adicione, no final do arquivo:

```python
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
    )
    registro_recente = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-10",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
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
```

- [ ] **Step 8: Rodar e confirmar que tudo passa**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/configuracoes/ buildflow/projetos/ -q`
Expected: `80 passed` (73 de antes desta feature + 4 novos da Task 1 + 3 novos desta task, todos dentro
de `configuracoes/`+`projetos/`).

- [ ] **Step 9: Ruff e commit**

Run: `cd backend && uv run ruff format buildflow/projetos/services.py buildflow/configuracoes/serializers.py buildflow/configuracoes/tests/test_api.py buildflow/projetos/tests/test_execucao.py && uv run ruff check buildflow/projetos/services.py buildflow/configuracoes/serializers.py buildflow/configuracoes/tests/test_api.py buildflow/projetos/tests/test_execucao.py`
Expected: `All checks passed!`

```bash
git add backend/buildflow/projetos/services.py backend/buildflow/configuracoes/serializers.py \
  backend/buildflow/configuracoes/tests/test_api.py backend/buildflow/projetos/tests/test_execucao.py
git commit -m "feat: expoe total executado computado e lancamentos de RDO vinculados na API da EAP"
```

---

### Task 3: Frontend — total, ajuste manual e lançamentos vinculados na aba EAP

**Files:**
- Modify: `frontend/src/types/configuracao.ts`
- Modify: `frontend/src/features/configuracoes/configuracaoApi.ts:65-79`
- Modify: `frontend/src/features/configuracoes/EapDisciplinaCard.tsx:165-220`
- Modify: `frontend/tests/e2e/config.spec.ts`

**Interfaces:**
- Consumes: campos JSON `quantidade_executada_manual`, `quantidade_executada`, `producoes_vinculadas`
  do `CatalogoServico` (Task 2).

- [ ] **Step 1: Atualizar os tipos**

Em `frontend/src/types/configuracao.ts`, substitua o `CatalogoServico` por:

```typescript
export interface ProducaoVinculada {
  data_referencia: string
  quantidade: string
}

export interface CatalogoServico {
  id: string
  nome: string
  unidade: number
  peso_percentual: string | null
  quantidade_planejada: string | null
  quantidade_executada: string
  quantidade_executada_manual: string
  producoes_vinculadas: ProducaoVinculada[]
  avanco_percentual: string | null
}
```

- [ ] **Step 2: Atualizar o hook de mutação**

Em `frontend/src/features/configuracoes/configuracaoApi.ts`, na função `useAtualizarServico`
(linhas 65-79), troque `quantidade_executada?: string` por `quantidade_executada_manual?: string` na
assinatura do `mutationFn`:

```typescript
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
      quantidade_executada_manual?: string
    }) => apiClient.patch<CatalogoServico>(`/api/v1/configuracoes/servicos/${servicoId}/`, values),
    onSuccess: invalidar,
  })
}
```

- [ ] **Step 3: Atualizar `EapServicoRow`**

Em `frontend/src/features/configuracoes/EapDisciplinaCard.tsx`, troque o import de `lib/format`
(linha 4) para incluir `formatData`:

```typescript
import { execucaoCorClasse, formatData, formatExecucao } from '../../lib/format'
```

Substitua a função `EapServicoRow` inteira (linhas 165-220) por:

```typescript
function EapServicoRow({ projetoId, servico }: EapServicoRowProps) {
  const [peso, setPeso] = useState(servico.peso_percentual ?? '')
  const [quantidadePlanejada, setQuantidadePlanejada] = useState(servico.quantidade_planejada ?? '')
  const [quantidadeExecutadaManual, setQuantidadeExecutadaManual] = useState(servico.quantidade_executada_manual)
  const [lancamentosVisiveis, setLancamentosVisiveis] = useState(false)

  const atualizarServico = useAtualizarServico(projetoId)

  function salvar(
    campo: 'peso_percentual' | 'quantidade_planejada' | 'quantidade_executada_manual',
    valor: string,
    valorOriginal: string,
  ) {
    if (valor === valorOriginal) return
    atualizarServico.mutate(
      { servicoId: servico.id, [campo]: valor },
      { onError: () => toast({ title: 'Não foi possível atualizar o serviço.', variant: 'destructive' }) },
    )
  }

  const somaRdo = (Number(servico.quantidade_executada) - Number(servico.quantidade_executada_manual)).toFixed(3)

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
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
        <FormField id={`servico-ajuste-${servico.id}`} label="Ajuste manual" className="mb-0 w-24">
          <Input
            id={`servico-ajuste-${servico.id}`}
            value={quantidadeExecutadaManual}
            onChange={(event) => setQuantidadeExecutadaManual(event.target.value)}
            onBlur={() =>
              salvar('quantidade_executada_manual', quantidadeExecutadaManual, servico.quantidade_executada_manual)
            }
          />
        </FormField>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-1 text-muted-foreground">
        <span>
          Executado: <span className="font-semibold text-ink">{servico.quantidade_executada}</span> (RDO: {somaRdo}
          {' + ajuste manual: '}
          {servico.quantidade_executada_manual})
        </span>
        {servico.producoes_vinculadas.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setLancamentosVisiveis((valor) => !valor)}>
            {lancamentosVisiveis ? 'Ocultar lançamentos' : `Ver lançamentos (${servico.producoes_vinculadas.length})`}
          </Button>
        )}
      </div>
      {lancamentosVisiveis && (
        <ul className="flex flex-col gap-1 pl-1 text-muted-foreground">
          {servico.producoes_vinculadas.map((producao, indice) => (
            <li key={`${producao.data_referencia}-${producao.quantidade}-${indice}`}>
              {formatData(producao.data_referencia)} — {producao.quantidade}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
```

- [ ] **Step 4: Rodar o typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros (lembrete: `npx tsc --noEmit` sozinho é um no-op silencioso neste repo por causa
de project references — sempre use `-b`).

- [ ] **Step 5: Corrigir os mocks existentes que quebram com os campos novos obrigatórios**

Em `frontend/tests/e2e/config.spec.ts`, no teste `'define peso da disciplina e adiciona serviço na
aba EAP'`, o objeto `disciplina.servicos` mockado dentro de `page.route(CONFIG_URL, ...)` (por volta
da linha 188-197) e o objeto retornado por `page.route('**/api/v1/configuracoes/disciplinas/disc-1/servicos/', ...)`
(por volta da linha 231-240) precisam dos dois campos novos, senão o componente quebra em runtime ao
ler `.length` de `producoes_vinculadas` undefined. Em ambos os objetos, adicione logo após
`quantidade_executada: '0.000',`:

```typescript
                quantidade_executada_manual: '0.000',
                producoes_vinculadas: [],
```

- [ ] **Step 6: Escrever o novo teste e2e**

Em `frontend/tests/e2e/config.spec.ts`, adicione ao final do arquivo:

```typescript
test('mostra total executado combinando RDO e ajuste manual, com lançamentos vinculados', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: '25.00',
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: '100.00',
                quantidade_planejada: '1000.000',
                quantidade_executada_manual: '100.000',
                quantidade_executada: '250.000',
                producoes_vinculadas: [
                  { data_referencia: '2026-07-10', quantidade: '150.000' },
                  { data_referencia: '2026-07-01', quantidade: '100.000' },
                ],
                avanco_percentual: '25.00',
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await expect(page.getByText(/Executado:\s*250\.000/)).toBeVisible()

  await page.getByRole('button', { name: 'Ver lançamentos (2)' }).click()
  await expect(page.getByText('10/07/2026 — 150.000')).toBeVisible()
  await expect(page.getByText('01/07/2026 — 100.000')).toBeVisible()
})
```

- [ ] **Step 7: Rodar os testes e2e da aba de configuração**

Run: `cd frontend && npx playwright test tests/e2e/config.spec.ts`
Expected: todos os testes do arquivo `passed`.

- [ ] **Step 8: Rodar a suite e2e completa**

Run: `cd frontend && npx playwright test`
Expected: nenhuma regressão nos outros arquivos (`custos-ociosidade.spec.ts` etc. continuam
passando).

- [ ] **Step 9: Lint e commit**

Run: `cd frontend && npx eslint src/types/configuracao.ts src/features/configuracoes/configuracaoApi.ts src/features/configuracoes/EapDisciplinaCard.tsx tests/e2e/config.spec.ts`
Expected: sem erros.

```bash
git add frontend/src/types/configuracao.ts frontend/src/features/configuracoes/configuracaoApi.ts \
  frontend/src/features/configuracoes/EapDisciplinaCard.tsx frontend/tests/e2e/config.spec.ts
git commit -m "feat: mostra total executado (RDO + ajuste manual) e lancamentos vinculados na aba EAP"
```
