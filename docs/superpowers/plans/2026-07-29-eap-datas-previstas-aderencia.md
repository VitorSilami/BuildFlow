# EAP — Datas Previstas e Aderência Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar datas previstas (início/fim) por serviço da EAP, calcular avanço previsto por
interpolação linear e classificar um status (Não iniciado / No prazo / Atenção / Crítico /
Concluído / Planejado) comparando avanço real com avanço previsto — pré-requisito para o Gantt.

**Architecture:** Dois campos nuláveis novos em `CatalogoServico` (`data_inicio_prevista`,
`data_fim_prevista`). Duas funções puras em `buildflow/projetos/services.py`
(`calcular_avanco_previsto_servico`, `calcular_avanco_previsto_disciplina`) seguindo exatamente o
padrão de `calcular_avanco_servico`/`calcular_avanco_disciplina` já existentes (rollup ponderado por
peso, `None` quando falta base real). Uma função de classificação (`classificar_status_eap`) usando
um enum `StatusEapChoices`. Os serializers da EAP expõem os campos de data (graváveis) e os dois
computados (`avanco_previsto_percentual`, `status_eap`) tanto no serviço quanto na disciplina.
Frontend ganha inputs de data e um badge de status ao lado da barra de progresso já existente.

**Tech Stack:** Django REST Framework (serializers, `SerializerMethodField`), Decimal para todo
cálculo numérico, React + TypeScript, Recharts não é usado nesta peça (sem gráfico novo).

## Global Constraints

- Nenhum campo novo tem `default` numérico "inventado" — ausência de dado é sempre `None`/`null`,
  nunca 0 ou uma data arbitrária (princípio "nunca inventa número" do projeto).
- Limiares de classificação de status são exatamente os do protótipo de referência:
  `LIMIAR_CONCLUIDO = Decimal("99.95")`, `LIMIAR_NAO_INICIADO = Decimal("0.01")`,
  `DESVIO_CRITICO = Decimal("-8")`, `DESVIO_ATENCAO = Decimal("-3")`.
- `Disciplina` não ganha nenhum campo de data próprio — sua janela é sempre derivada dos serviços
  filhos via rollup ponderado por peso, nunca um dado digitado diretamente nela.
- `CatalogoServicoResumoSerializer`/`DisciplinaResumoSerializer` (bootstrap do RDO,
  `configuracao-rdo/`) nunca expõem os campos novos — mesma exclusão já aplicada a
  `avanco_percentual`/`carta_controle`.
- Todo valor numérico devolvido pela API é `str(Decimal)`, nunca `float` (evita erro de ponto
  flutuante no JSON).
- Este projeto usa `oxlint`, não `eslint` — não referenciar eslint em nenhum lugar.

---

### Task 1: Datas previstas, cálculo de avanço previsto e classificação de status

**Files:**
- Modify: `backend/buildflow/configuracoes/models.py:81-127` (classe `CatalogoServico`)
- Create: `backend/buildflow/configuracoes/migrations/0010_catalogoservico_datas_previstas.py`
- Modify: `backend/buildflow/projetos/services.py` (imports no topo, novo enum e 3 funções)
- Test: `backend/buildflow/projetos/tests/test_execucao.py`

**Interfaces:**
- Consumes: `CatalogoServico` (model, `backend/buildflow/configuracoes/models.py`), `Disciplina`
  (model, mesmo arquivo), `calcular_avanco_servico(servico) -> Decimal | None` e
  `calcular_avanco_disciplina(disciplina) -> Decimal | None` (já existentes em
  `buildflow/projetos/services.py`, não mudam).
- Produces:
  - `CatalogoServico.data_inicio_prevista: date | None`, `CatalogoServico.data_fim_prevista: date | None`
    — usados pela Task 2.
  - `StatusEapChoices` (enum `models.TextChoices` com membros `CONCLUIDO`, `NO_PRAZO`, `ATENCAO`,
    `CRITICO`, `NAO_INICIADO`, `PLANEJADO`) — usado pela Task 2.
  - `calcular_avanco_previsto_servico(servico: CatalogoServico, hoje: datetime.date | None = None) -> Decimal | None`
    — usado pela Task 2.
  - `calcular_avanco_previsto_disciplina(disciplina: Disciplina, hoje: datetime.date | None = None) -> Decimal | None`
    — usado pela Task 2.
  - `classificar_status_eap(real: Decimal | None, previsto: Decimal | None) -> str | None` — usado
    pela Task 2.

- [ ] **Step 1: Escrever os testes que falham (funções e campos ainda não existem)**

Adicionar ao final de `backend/buildflow/projetos/tests/test_execucao.py`:

```python
from buildflow.projetos.services import StatusEapChoices
from buildflow.projetos.services import calcular_avanco_previsto_disciplina
from buildflow.projetos.services import calcular_avanco_previsto_servico
from buildflow.projetos.services import classificar_status_eap


def test_avanco_previsto_servico_sem_datas_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
    )

    assert calcular_avanco_previsto_servico(servico) is None


def test_avanco_previsto_servico_antes_do_inicio_retorna_zero():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        data_inicio_prevista=datetime.date(2026, 8, 1),
        data_fim_prevista=datetime.date(2026, 8, 31),
    )

    previsto = calcular_avanco_previsto_servico(servico, hoje=datetime.date(2026, 7, 15))

    assert previsto == Decimal("0")


def test_avanco_previsto_servico_depois_do_fim_retorna_cem():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 1, 31),
    )

    previsto = calcular_avanco_previsto_servico(servico, hoje=datetime.date(2026, 3, 1))

    assert previsto == Decimal("100")


def test_avanco_previsto_servico_no_meio_interpola_linearmente():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 1, 11),
    )

    # 3 de 10 dias decorridos = 30%
    previsto = calcular_avanco_previsto_servico(servico, hoje=datetime.date(2026, 1, 4))

    assert previsto == Decimal("30.00")


def test_avanco_previsto_disciplina_ignora_servico_sem_data():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        peso_percentual=Decimal("60.00"),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 2, 1),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
        peso_percentual=Decimal("40.00"),
    )

    # Aterro nao tem data, entao nao entra na conta — sobra so o Corte (100% previsto)
    previsto = calcular_avanco_previsto_disciplina(disciplina, hoje=datetime.date(2026, 6, 1))

    assert previsto == Decimal("100.00")


def test_avanco_previsto_disciplina_pondera_por_peso():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        peso_percentual=Decimal("60.00"),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 2, 1),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
        peso_percentual=Decimal("40.00"),
        data_inicio_prevista=datetime.date(2026, 12, 1),
        data_fim_prevista=datetime.date(2027, 1, 1),
    )

    # Corte: hoje depois do fim => 100% previsto. Aterro: hoje antes do inicio => 0% previsto.
    # (100*60 + 0*40) / 100 = 60.00
    previsto = calcular_avanco_previsto_disciplina(disciplina, hoje=datetime.date(2026, 6, 1))

    assert previsto == Decimal("60.00")


def test_status_eap_concluido_quando_real_maior_ou_igual_ao_limiar():
    assert classificar_status_eap(Decimal("99.95"), Decimal("10.00")) == StatusEapChoices.CONCLUIDO
    assert classificar_status_eap(Decimal("100.00"), None) == StatusEapChoices.CONCLUIDO


def test_status_eap_sem_previsto_retorna_planejado():
    assert classificar_status_eap(Decimal("40.00"), None) == StatusEapChoices.PLANEJADO


def test_status_eap_nao_iniciado_quando_real_e_previsto_proximos_de_zero():
    assert classificar_status_eap(Decimal("0.00"), Decimal("0.01")) == StatusEapChoices.NAO_INICIADO
    assert classificar_status_eap(Decimal("0.01"), Decimal("0.00")) == StatusEapChoices.NAO_INICIADO


def test_status_eap_critico_no_limiar_exato_de_desvio():
    # desvio = 10 - 18 = -8.00 (limiar exato, inclusivo)
    assert classificar_status_eap(Decimal("10.00"), Decimal("18.00")) == StatusEapChoices.CRITICO


def test_status_eap_atencao_entre_os_dois_limiares():
    # desvio = 10 - 17.99 = -7.99 (nao chega no critico)
    assert classificar_status_eap(Decimal("10.00"), Decimal("17.99")) == StatusEapChoices.ATENCAO
    # desvio = 10 - 13 = -3.00 (limiar exato do atencao, inclusivo)
    assert classificar_status_eap(Decimal("10.00"), Decimal("13.00")) == StatusEapChoices.ATENCAO


def test_status_eap_no_prazo_quando_desvio_acima_do_limiar_de_atencao():
    # desvio = 10 - 12.99 = -2.99 (nao chega no atencao)
    assert classificar_status_eap(Decimal("10.00"), Decimal("12.99")) == StatusEapChoices.NO_PRAZO
    # real acima do previsto tambem e No prazo
    assert classificar_status_eap(Decimal("50.00"), Decimal("40.00")) == StatusEapChoices.NO_PRAZO


def test_status_eap_sem_avanco_real_retorna_none():
    assert classificar_status_eap(None, Decimal("50.00")) is None
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v`
Expected: FAIL — `TypeError: 'data_inicio_prevista' is an invalid keyword argument` (o campo ainda
não existe) e/ou `ImportError: cannot import name 'calcular_avanco_previsto_servico'`.

- [ ] **Step 3: Adicionar os campos de data ao modelo**

Em `backend/buildflow/configuracoes/models.py`, dentro da classe `CatalogoServico` (depois do campo
`quantidade_executada_manual`, antes de `tenant_path`):

```python
    data_inicio_prevista = models.DateField(
        _("data de início prevista"),
        null=True,
        blank=True,
    )
    data_fim_prevista = models.DateField(
        _("data de fim prevista"),
        null=True,
        blank=True,
    )
```

- [ ] **Step 4: Gerar e revisar a migração**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run python manage.py makemigrations configuracoes`

Expected output: cria `buildflow/configuracoes/migrations/0010_catalogoservico_datas_previstas.py`
(ou nome similar gerado pelo Django — renomeie o arquivo para
`0010_catalogoservico_datas_previstas.py` se o nome gerado for diferente). Conferir que o conteúdo
gerado é equivalente a:

```python
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configuracoes", "0009_rename_quantidade_executada_manual"),
    ]

    operations = [
        migrations.AddField(
            model_name="catalogoservico",
            name="data_inicio_prevista",
            field=models.DateField(blank=True, null=True, verbose_name="data de início prevista"),
        ),
        migrations.AddField(
            model_name="catalogoservico",
            name="data_fim_prevista",
            field=models.DateField(blank=True, null=True, verbose_name="data de fim prevista"),
        ),
    ]
```

- [ ] **Step 5: Implementar as funções de cálculo em `services.py`**

No topo de `backend/buildflow/projetos/services.py`, ajustar os imports (ordem alfabética, mesma
convenção já usada no arquivo):

```python
from __future__ import annotations

import datetime
from dataclasses import dataclass
from decimal import Decimal
from statistics import stdev
from typing import TYPE_CHECKING

from django.db import models
from django.db.models import Count
from django.db.models import Sum
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.registros_diarios.models import StatusRegistroChoices

from .models import Projeto
```

Depois da constante `AMOSTRA_MINIMA_CARTA_CONTROLE = 5` já existente, adicionar:

```python
LIMIAR_CONCLUIDO = Decimal("99.95")
LIMIAR_NAO_INICIADO = Decimal("0.01")
DESVIO_CRITICO = Decimal("-8")
DESVIO_ATENCAO = Decimal("-3")


class StatusEapChoices(models.TextChoices):
    CONCLUIDO = "concluido", _("Concluído")
    NO_PRAZO = "no_prazo", _("No prazo")
    ATENCAO = "atencao", _("Atenção")
    CRITICO = "critico", _("Crítico")
    NAO_INICIADO = "nao_iniciado", _("Não iniciado")
    PLANEJADO = "planejado", _("Planejado")
```

E, depois de `calcular_avanco_disciplina` (antes de `calcular_execucao_percentual`), adicionar:

```python
def calcular_avanco_previsto_servico(
    servico: CatalogoServico,
    hoje: datetime.date | None = None,
) -> Decimal | None:
    """Avanco previsto de um servico por interpolacao linear entre
    data_inicio_prevista e data_fim_prevista ate hoje. Sem as duas datas
    definidas, retorna None — nao ha base pra prever nada.
    """
    if servico.data_inicio_prevista is None or servico.data_fim_prevista is None:
        return None
    hoje = hoje or timezone.now().date()
    inicio, fim = servico.data_inicio_prevista, servico.data_fim_prevista
    if hoje <= inicio:
        return Decimal("0")
    if hoje >= fim:
        return Decimal("100")
    dias_totais = (fim - inicio).days
    dias_decorridos = (hoje - inicio).days
    return (Decimal(dias_decorridos) / Decimal(dias_totais) * Decimal("100")).quantize(Decimal("0.01"))


def calcular_avanco_previsto_disciplina(
    disciplina: Disciplina,
    hoje: datetime.date | None = None,
) -> Decimal | None:
    """Media ponderada (por peso_percentual) do avanco previsto dos servicos
    da disciplina. Servico sem peso ou sem previsto (datas ausentes) nao conta.
    """
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")
    for servico in disciplina.servicos.all():
        if servico.peso_percentual is None:
            continue
        previsto = calcular_avanco_previsto_servico(servico, hoje)
        if previsto is None:
            continue
        soma_ponderada += previsto * servico.peso_percentual
        soma_pesos += servico.peso_percentual
    if soma_pesos == 0:
        return None
    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))


def classificar_status_eap(real: Decimal | None, previsto: Decimal | None) -> str | None:
    """Status do item (servico ou disciplina) a partir do avanco real vs
    previsto. Sem avanco real (sem quantidade_planejada), nao ha o que
    classificar — retorna None.
    """
    if real is None:
        return None
    if real >= LIMIAR_CONCLUIDO:
        return StatusEapChoices.CONCLUIDO
    if previsto is None:
        return StatusEapChoices.PLANEJADO
    if previsto <= LIMIAR_NAO_INICIADO and real <= LIMIAR_NAO_INICIADO:
        return StatusEapChoices.NAO_INICIADO
    desvio = real - previsto
    if desvio <= DESVIO_CRITICO:
        return StatusEapChoices.CRITICO
    if desvio <= DESVIO_ATENCAO:
        return StatusEapChoices.ATENCAO
    return StatusEapChoices.NO_PRAZO
```

`CatalogoServico` e `Disciplina` já estão importados em `TYPE_CHECKING` no topo do arquivo — não
precisa adicionar de novo.

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v`
Expected: todos os testes (existentes + os 12 novos desta task) PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/buildflow/configuracoes/models.py backend/buildflow/configuracoes/migrations/0010_catalogoservico_datas_previstas.py backend/buildflow/projetos/services.py backend/buildflow/projetos/tests/test_execucao.py
git commit -m "feat: calcula avanco previsto e status da EAP a partir de datas previstas"
```

---

### Task 2: Expor datas, avanço previsto e status na API

**Files:**
- Modify: `backend/buildflow/configuracoes/serializers.py`
- Test: `backend/buildflow/configuracoes/tests/test_api.py`

**Interfaces:**
- Consumes: `CatalogoServico.data_inicio_prevista`/`data_fim_prevista` (Task 1),
  `calcular_avanco_previsto_servico`/`calcular_avanco_previsto_disciplina`/`classificar_status_eap`
  (Task 1), `decimal_para_str_ou_none` (já existente em `buildflow/projetos/services.py`).
- Produces: `CatalogoServicoSerializer` com os campos `data_inicio_prevista`, `data_fim_prevista`
  (graváveis), `avanco_previsto_percentual`, `status_eap` (computados); `DisciplinaSerializer` com
  `avanco_previsto_percentual`, `status_eap` (computados) — usado pela Task 3 via
  `/api/v1/projetos/<id>/configuracao/`.

- [ ] **Step 1: Escrever os testes de API que falham**

Adicionar ao final de `backend/buildflow/configuracoes/tests/test_api.py`:

```python
def test_criar_servico_aceita_datas_previstas_e_calcula_avanco_previsto():
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
            "data_inicio_prevista": "2026-01-01",
            "data_fim_prevista": "2026-01-31",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    body = response.json()
    assert body["data_inicio_prevista"] == "2026-01-01"
    assert body["data_fim_prevista"] == "2026-01-31"
    assert body["avanco_previsto_percentual"] is not None
    assert body["status_eap"] is not None


def test_patch_servico_atualiza_datas_previstas():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=UnidadeFactory())
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/servicos/{servico.id}/",
        {"data_inicio_prevista": "2026-02-01", "data_fim_prevista": "2026-03-01"},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["data_inicio_prevista"] == "2026-02-01"
    assert response.json()["data_fim_prevista"] == "2026-03-01"


def test_patch_servico_com_fim_previsto_anterior_ao_inicio_retorna_400():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(
        disciplina=disciplina,
        unidade=UnidadeFactory(),
        data_inicio_prevista=datetime.date(2026, 2, 1),
        data_fim_prevista=datetime.date(2026, 3, 1),
    )
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/servicos/{servico.id}/",
        {"data_fim_prevista": "2026-01-01"},
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_servico_sem_datas_previstas_expoe_avanco_previsto_e_status_nulos():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    CatalogoServicoFactory(disciplina=disciplina, unidade=UnidadeFactory())
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")

    servico_body = response.json()["disciplinas"][0]["servicos"][0]
    assert servico_body["avanco_previsto_percentual"] is None
    assert servico_body["status_eap"] is None


def test_disciplina_expoe_avanco_previsto_e_status_calculados_dos_servicos():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto, peso_percentual=Decimal("100.00"))
    CatalogoServicoFactory(
        disciplina=disciplina,
        unidade=UnidadeFactory(),
        peso_percentual=Decimal("100.00"),
        quantidade_planejada="1000.000",
        quantidade_executada_manual="1000.000",
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 1, 31),
    )
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")

    disciplina_body = response.json()["disciplinas"][0]
    assert disciplina_body["avanco_previsto_percentual"] is not None
    assert disciplina_body["status_eap"] is not None


def test_configuracao_rdo_servico_nao_expoe_campos_de_datas_previstas():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    CatalogoServicoFactory(disciplina=disciplina, unidade=UnidadeFactory())
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao-rdo/")

    servico_body = response.json()["disciplinas"][0]["servicos"][0]
    assert "data_inicio_prevista" not in servico_body
    assert "avanco_previsto_percentual" not in servico_body
    assert "status_eap" not in servico_body
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/configuracoes/tests/test_api.py -v -k "previsto or datas_previstas"`
Expected: FAIL — `KeyError: 'data_inicio_prevista'` ou o campo aparece como `None`/ausente onde o
teste espera um valor (os campos ainda não estão no serializer).

- [ ] **Step 3: Adicionar os campos ao `CatalogoServicoSerializer`**

Em `backend/buildflow/configuracoes/serializers.py`, ajustar os imports no topo (ordem alfabética):

```python
from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_previsto_disciplina
from buildflow.projetos.services import calcular_avanco_previsto_servico
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import calcular_carta_controle
from buildflow.projetos.services import calcular_quantidade_executada_total
from buildflow.projetos.services import classificar_status_eap
from buildflow.projetos.services import decimal_para_str_ou_none
from buildflow.projetos.services import listar_producoes_vinculadas
```

Substituir a classe `CatalogoServicoSerializer` inteira (linhas 49-103 do arquivo atual) por:

```python
class CatalogoServicoSerializer(serializers.ModelSerializer):
    avanco_percentual = serializers.SerializerMethodField()
    quantidade_executada = serializers.SerializerMethodField()
    producoes_vinculadas = serializers.SerializerMethodField()
    carta_controle = serializers.SerializerMethodField()
    avanco_previsto_percentual = serializers.SerializerMethodField()
    status_eap = serializers.SerializerMethodField()

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
            "carta_controle",
            "avanco_percentual",
            "data_inicio_prevista",
            "data_fim_prevista",
            "avanco_previsto_percentual",
            "status_eap",
        ]

    def get_avanco_percentual(self, obj: CatalogoServico) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_servico(obj))

    def get_quantidade_executada(self, obj: CatalogoServico) -> str:
        total = calcular_quantidade_executada_total(obj)
        return str(total.quantize(Decimal("0.001")))

    def get_producoes_vinculadas(self, obj: CatalogoServico) -> list[dict]:
        return [
            {
                "data_referencia": producao.registro_diario.data_referencia.isoformat(),
                "quantidade": str(producao.quantidade),
            }
            for producao in listar_producoes_vinculadas(obj)
        ]

    def get_carta_controle(self, obj: CatalogoServico) -> dict | None:
        cc = calcular_carta_controle(obj)
        if cc is None:
            return None
        return {
            "media": str(cc.media),
            "desvio_padrao": str(cc.desvio_padrao),
            "lsc": str(cc.lsc),
            "lic": str(cc.lic),
            "pontos": [
                {
                    "data_referencia": p.data_referencia.isoformat(),
                    "quantidade": str(p.quantidade),
                    "fora_de_controle": p.fora_de_controle,
                }
                for p in cc.pontos
            ],
        }

    def get_avanco_previsto_percentual(self, obj: CatalogoServico) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_previsto_servico(obj))

    def get_status_eap(self, obj: CatalogoServico) -> str | None:
        return classificar_status_eap(
            calcular_avanco_servico(obj),
            calcular_avanco_previsto_servico(obj),
        )

    def validate(self, attrs):
        inicio = attrs.get(
            "data_inicio_prevista",
            getattr(self.instance, "data_inicio_prevista", None),
        )
        fim = attrs.get(
            "data_fim_prevista",
            getattr(self.instance, "data_fim_prevista", None),
        )
        if inicio and fim and fim < inicio:
            raise serializers.ValidationError(
                {
                    "data_fim_prevista": (
                        "Data de fim prevista não pode ser anterior à data de início prevista."
                    ),
                },
            )
        return attrs
```

- [ ] **Step 4: Adicionar os campos computados ao `DisciplinaSerializer`**

Substituir a classe `DisciplinaSerializer` inteira (linhas 106-115 do arquivo atual) por:

```python
class DisciplinaSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoSerializer(many=True, read_only=True)
    avanco_percentual = serializers.SerializerMethodField()
    avanco_previsto_percentual = serializers.SerializerMethodField()
    status_eap = serializers.SerializerMethodField()

    class Meta:
        model = Disciplina
        fields = [
            "id",
            "nome",
            "peso_percentual",
            "servicos",
            "avanco_percentual",
            "avanco_previsto_percentual",
            "status_eap",
        ]

    def get_avanco_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_disciplina(obj))

    def get_avanco_previsto_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_previsto_disciplina(obj))

    def get_status_eap(self, obj: Disciplina) -> str | None:
        return classificar_status_eap(
            calcular_avanco_disciplina(obj),
            calcular_avanco_previsto_disciplina(obj),
        )
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/configuracoes/ buildflow/projetos/ -v`
Expected: todos PASS (baseline + 6 testes novos desta task).

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/configuracoes/serializers.py backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: expoe datas previstas, avanco previsto e status na API da EAP"
```

---

### Task 3: Frontend — datas previstas, badge de status e avanço previsto na aba EAP

**Files:**
- Modify: `frontend/src/types/configuracao.ts`
- Modify: `frontend/src/lib/format.ts`
- Modify: `frontend/src/features/configuracoes/configuracaoApi.ts`
- Modify: `frontend/src/features/configuracoes/EapDisciplinaCard.tsx`
- Test: `frontend/tests/e2e/config.spec.ts`

**Interfaces:**
- Consumes: API de `CatalogoServico`/`Disciplina` da Task 2 (`data_inicio_prevista`,
  `data_fim_prevista`, `avanco_previsto_percentual`, `status_eap`).
- Produces: nada consumido por tasks futuras desta spec (última task).

- [ ] **Step 1: Adicionar os tipos novos**

Em `frontend/src/types/configuracao.ts`, adicionar antes da interface `CatalogoServico`:

```typescript
export type StatusEap = 'concluido' | 'no_prazo' | 'atencao' | 'critico' | 'nao_iniciado' | 'planejado'
```

E atualizar `CatalogoServico` e `Disciplina` (arquivo completo após a mudança):

```typescript
import type { Equipe } from './registroDiario'

export interface ProducaoVinculada {
  data_referencia: string
  quantidade: string
}

export interface PontoCartaControle {
  data_referencia: string
  quantidade: string
  fora_de_controle: boolean
}

export interface CartaControle {
  media: string
  desvio_padrao: string
  lsc: string
  lic: string
  pontos: PontoCartaControle[]
}

export type StatusEap = 'concluido' | 'no_prazo' | 'atencao' | 'critico' | 'nao_iniciado' | 'planejado'

export interface CatalogoServico {
  id: string
  nome: string
  unidade: number
  peso_percentual: string | null
  quantidade_planejada: string | null
  quantidade_executada: string
  quantidade_executada_manual: string
  producoes_vinculadas: ProducaoVinculada[]
  carta_controle: CartaControle | null
  avanco_percentual: string | null
  data_inicio_prevista: string | null
  data_fim_prevista: string | null
  avanco_previsto_percentual: string | null
  status_eap: StatusEap | null
}

export interface Disciplina {
  id: string
  nome: string
  peso_percentual: string | null
  servicos: CatalogoServico[]
  avanco_percentual: string | null
  avanco_previsto_percentual: string | null
  status_eap: StatusEap | null
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

- [ ] **Step 2: Adicionar `statusEapLabel`/`statusEapCorClasse` em `format.ts`**

Substituir o conteúdo inteiro de `frontend/src/lib/format.ts` por:

```typescript
import type { StatusEap } from '../types/configuracao'

export function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}

export function formatData(iso: string | null): string {
  if (iso === null) return 'Nunca registrado'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const LIMITE_EXECUCAO_BAIXA = 30
const LIMITE_EXECUCAO_MEDIA = 70

export function execucaoCorClasse(valor: string | null): string {
  if (valor === null) return 'bg-muted-foreground'
  const numero = Number(valor)
  if (numero < LIMITE_EXECUCAO_BAIXA) return 'bg-red-500'
  if (numero < LIMITE_EXECUCAO_MEDIA) return 'bg-amber-500'
  return 'bg-emerald-500'
}

const FORMATADOR_MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoeda(valor: string): string {
  return FORMATADOR_MOEDA.format(Number(valor))
}

export function formatDataHora(iso: string | null): string {
  if (iso === null) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_EAP_LABELS: Record<StatusEap, string> = {
  concluido: 'Concluído',
  no_prazo: 'No prazo',
  atencao: 'Atenção',
  critico: 'Crítico',
  nao_iniciado: 'Não iniciado',
  planejado: 'Planejado',
}

const STATUS_EAP_CORES: Record<StatusEap, string> = {
  concluido: 'bg-emerald-500',
  no_prazo: 'bg-emerald-500',
  atencao: 'bg-amber-500',
  critico: 'bg-red-500',
  nao_iniciado: 'bg-muted-foreground',
  planejado: 'bg-cyan-500',
}

export function statusEapLabel(status: StatusEap | null): string | null {
  return status === null ? null : STATUS_EAP_LABELS[status]
}

export function statusEapCorClasse(status: StatusEap | null): string {
  return status === null ? 'bg-muted-foreground' : STATUS_EAP_CORES[status]
}
```

- [ ] **Step 3: Adicionar `data_inicio_prevista`/`data_fim_prevista` ao payload de `useAtualizarServico`**

Em `frontend/src/features/configuracoes/configuracaoApi.ts`, substituir a função
`useAtualizarServico` (linhas 65-79 do arquivo atual) por:

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
      data_inicio_prevista?: string
      data_fim_prevista?: string
    }) => apiClient.patch<CatalogoServico>(`/api/v1/configuracoes/servicos/${servicoId}/`, values),
    onSuccess: invalidar,
  })
}
```

- [ ] **Step 4: Escrever o teste e2e que falha**

Adicionar ao final de `frontend/tests/e2e/config.spec.ts`:

```typescript
test('mostra badge de status e avanco previsto quando o servico tem datas previstas', async ({ page }) => {
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
            avanco_previsto_percentual: '60.00',
            status_eap: 'atencao',
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: '100.00',
                quantidade_planejada: '1000.000',
                quantidade_executada_manual: '250.000',
                quantidade_executada: '250.000',
                producoes_vinculadas: [],
                carta_controle: null,
                avanco_percentual: '25.00',
                data_inicio_prevista: '2026-01-01',
                data_fim_prevista: '2026-01-31',
                avanco_previsto_percentual: '60.00',
                status_eap: 'atencao',
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

  await expect(page.getByText('Atenção').first()).toBeVisible()
  await expect(page.getByText(/Previsto:\s*60\.00%/).first()).toBeVisible()
})

test('nao mostra badge nem previsto quando o servico nao tem datas previstas', async ({ page }) => {
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
            avanco_previsto_percentual: null,
            status_eap: null,
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: '100.00',
                quantidade_planejada: '1000.000',
                quantidade_executada_manual: '250.000',
                quantidade_executada: '250.000',
                producoes_vinculadas: [],
                carta_controle: null,
                avanco_percentual: '25.00',
                data_inicio_prevista: null,
                data_fim_prevista: null,
                avanco_previsto_percentual: null,
                status_eap: null,
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

  await expect(page.getByText(/Previsto:/)).toHaveCount(0)
})
```

- [ ] **Step 5: Rodar o teste e2e e confirmar que falha**

Run: `cd frontend && npx playwright test config.spec.ts -g "badge de status|nao mostra badge"`
Expected: FAIL — nem o badge nem o texto "Previsto:" existem ainda no componente.

- [ ] **Step 6: Adicionar os inputs de data, o badge de status e o texto de previsto em `EapDisciplinaCard.tsx`**

Em `frontend/src/features/configuracoes/EapDisciplinaCard.tsx`, ajustar o import no topo (linha 4)
para incluir as novas funções de formatação:

```typescript
import { execucaoCorClasse, formatData, formatExecucao, statusEapCorClasse, statusEapLabel } from '../../lib/format'
```

No cabeçalho da disciplina (dentro de `EapDisciplinaCard`, no `<div className="flex w-40 items-center gap-2">` que já existe, linhas 63-71 do arquivo atual), adicionar o badge logo depois do `<span>` de percentual:

```tsx
        <div className="flex w-40 items-center gap-2">
          <Progress
            value={disciplina.avanco_percentual ? Number(disciplina.avanco_percentual) : 0}
            indicatorClassName={execucaoCorClasse(disciplina.avanco_percentual)}
          />
          <span className="w-12 text-right text-xs text-muted-foreground">
            {formatExecucao(disciplina.avanco_percentual)}
          </span>
          {disciplina.status_eap !== null && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${statusEapCorClasse(disciplina.status_eap)}`}
            >
              {statusEapLabel(disciplina.status_eap)}
            </span>
          )}
        </div>
```

Na função `EapServicoRow`, adicionar dois novos estados logo depois de `quantidadeExecutadaManual`
(linha 169 do arquivo atual):

```typescript
  const [dataInicioPrevista, setDataInicioPrevista] = useState(servico.data_inicio_prevista ?? '')
  const [dataFimPrevista, setDataFimPrevista] = useState(servico.data_fim_prevista ?? '')
```

Ajustar a assinatura de `salvar` (linha 174-184 do arquivo atual) para aceitar os novos campos:

```typescript
  function salvar(
    campo:
      | 'peso_percentual'
      | 'quantidade_planejada'
      | 'quantidade_executada_manual'
      | 'data_inicio_prevista'
      | 'data_fim_prevista',
    valor: string,
    valorOriginal: string,
  ) {
    if (valor === valorOriginal) return
    atualizarServico.mutate(
      { servicoId: servico.id, [campo]: valor },
      { onError: () => toast({ title: 'Não foi possível atualizar o serviço.', variant: 'destructive' }) },
    )
  }
```

Adicionar os dois inputs de data e o badge de status na linha do serviço (dentro do
`<div className="flex flex-wrap items-center gap-3">` que já existe, logo depois do `FormField` de
"Ajuste manual", linha 224 do arquivo atual):

```tsx
        <FormField id={`servico-inicio-${servico.id}`} label="Início previsto" className="mb-0 w-32">
          <Input
            id={`servico-inicio-${servico.id}`}
            type="date"
            value={dataInicioPrevista}
            onChange={(event) => setDataInicioPrevista(event.target.value)}
            onBlur={() => salvar('data_inicio_prevista', dataInicioPrevista, servico.data_inicio_prevista ?? '')}
          />
        </FormField>
        <FormField id={`servico-fim-${servico.id}`} label="Fim previsto" className="mb-0 w-32">
          <Input
            id={`servico-fim-${servico.id}`}
            type="date"
            value={dataFimPrevista}
            onChange={(event) => setDataFimPrevista(event.target.value)}
            onBlur={() => salvar('data_fim_prevista', dataFimPrevista, servico.data_fim_prevista ?? '')}
          />
        </FormField>
        {servico.status_eap !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${statusEapCorClasse(servico.status_eap)}`}
          >
            {statusEapLabel(servico.status_eap)}
          </span>
        )}
```

E adicionar o texto de "Previsto:" ao lado do "Executado:" já existente (linhas 226-231 do arquivo
atual):

```tsx
      <div className="flex flex-wrap items-center gap-2 pl-1 text-muted-foreground">
        <span>
          Executado: <span className="font-semibold text-ink">{servico.quantidade_executada}</span> (RDO: {somaRdo}
          {' + ajuste manual: '}
          {servico.quantidade_executada_manual})
        </span>
        {servico.avanco_previsto_percentual !== null && <span>Previsto: {servico.avanco_previsto_percentual}%</span>}
        {servico.producoes_vinculadas.length > 0 && (
```

(o restante do bloco, a partir do `<Button type="button" variant="ghost"...`, continua igual — só a
linha do `<span>Previsto:...` é inserida entre o `<span>Executado:...` e o `producoes_vinculadas.length > 0`.)

- [ ] **Step 7: Rodar o teste e2e e confirmar que passa**

Run: `cd frontend && npx playwright test config.spec.ts`
Expected: todos os testes do arquivo PASS, incluindo os 2 novos desta task.

- [ ] **Step 8: Rodar o typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: nenhum erro novo introduzido (o único erro pré-existente conhecido, em
`CustoCompositionDonutChart.tsx`, não é desta task — se aparecer, é o mesmo de sempre).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/types/configuracao.ts frontend/src/lib/format.ts frontend/src/features/configuracoes/configuracaoApi.ts frontend/src/features/configuracoes/EapDisciplinaCard.tsx frontend/tests/e2e/config.spec.ts
git commit -m "feat: mostra datas previstas, avanco previsto e status na aba EAP"
```
