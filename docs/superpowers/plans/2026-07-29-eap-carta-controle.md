# EAP — Carta de Controle de Produtividade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar, na aba EAP, uma carta de controle estatística (SPC) real da produtividade diária
de cada serviço — média, desvio padrão amostral e limites de controle (LSC/LIC) calculados a partir
da produção diária efetivamente aprovada nos RDOs, nunca de números fabricados.

**Architecture:** Uma nova função em `buildflow/projetos/services.py` agrupa `ProducaoDiaria` aprovada
por dia, calcula estatística real (usando `statistics.stdev`, sem inventar coeficiente), e retorna
`None` quando a amostra é pequena demais para ser significativa. A API expõe isso como um campo
computado a mais no `CatalogoServicoSerializer`. O frontend renderiza um `LineChart` do Recharts
dentro do toggle "Ver lançamentos" já existente, com linhas de referência para média/LSC/LIC e os
pontos fora de controle destacados.

**Tech Stack:** Django ORM (aggregate/values/annotate), `statistics.stdev` (stdlib), DRF
SerializerMethodField, React + Recharts (já é dependência do projeto), Playwright.

## Global Constraints

- Amostra mínima de **5 dias distintos** de produção aprovada — abaixo disso, `calcular_carta_controle`
  retorna `None` e a UI não muda (continua só a lista de lançamentos, sem gráfico nem aviso extra).
- Estatística sempre calculada a partir de dado real (`ProducaoDiaria` com
  `registro_diario__status="aprovado"`, mesmo filtro já usado por `calcular_quantidade_executada_total`)
  — nunca um coeficiente ou valor fabricado, ao contrário do protótipo de referência.
- `pontos` vem em ordem cronológica **crescente** (mais antigo primeiro) — diferente de
  `producoes_vinculadas`, que é mais-recente-primeiro.
- `CatalogoServicoResumoSerializer` (endpoint de configuração-rdo) não ganha este campo — mesma regra
  já aplicada a `avanco_percentual`/`quantidade_executada`/`producoes_vinculadas`.

---

### Task 1: Cálculo da carta de controle (backend)

**Files:**
- Modify: `backend/buildflow/projetos/services.py`
- Test: `backend/buildflow/projetos/tests/test_execucao.py`

**Interfaces:**
- Produces: `PontoCartaControle` (dataclass: `data_referencia: datetime.date`, `quantidade: Decimal`,
  `fora_de_controle: bool`) e `CartaControle` (dataclass: `media: Decimal`, `desvio_padrao: Decimal`,
  `lsc: Decimal`, `lic: Decimal`, `pontos: list[PontoCartaControle]`) em `buildflow/projetos/services.py`
  — usados pela Task 2 no serializer.
- Produces: `calcular_carta_controle(servico: CatalogoServico) -> CartaControle | None`.

- [ ] **Step 1: Escrever os testes falhos**

Em `backend/buildflow/projetos/tests/test_execucao.py`, adicione no topo do arquivo (junto aos
imports existentes):

```python
import datetime

from buildflow.projetos.services import calcular_carta_controle
```

E adicione, no final do arquivo, o helper e os testes:

```python
def _criar_producoes_diarias(
    servico: CatalogoServico,
    valores_por_dia: list[Decimal],
) -> None:
    """Cria um RegistroDiario aprovado + uma ProducaoDiaria por dia, um dia
    apos o outro a partir de 2026-07-01 — usado para popular a amostra da
    carta de controle nos testes."""
    disciplina = servico.disciplina
    projeto = disciplina.projeto
    unidade = servico.unidade
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    for indice, valor in enumerate(valores_por_dia):
        registro = RegistroDiario.objects.create(
            projeto=projeto,
            data_referencia=datetime.date(2026, 7, 1) + datetime.timedelta(days=indice),
            turno="diurno",
            clima="sol",
            equipe=equipe,
            fiscal=usuario,
            autor=usuario,
            status="aprovado",
        )
        ProducaoDiaria.objects.create(
            registro_diario=registro,
            rodovia="BR-365",
            sentido="crescente",
            disciplina=disciplina,
            servico=servico,
            km_inicial=Decimal("0.000"),
            km_final=Decimal("1.000"),
            quantidade=valor,
            unidade=unidade,
        )


def test_carta_controle_com_menos_de_5_dias_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("10000.000"),
    )
    _criar_producoes_diarias(servico, [Decimal("100.000")] * 4)

    assert calcular_carta_controle(servico) is None


def test_carta_controle_com_5_dias_calcula_media_desvio_e_limites():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("10000.000"),
    )
    _criar_producoes_diarias(
        servico,
        [Decimal("100.000"), Decimal("110.000"), Decimal("90.000"), Decimal("105.000"), Decimal("95.000")],
    )

    cc = calcular_carta_controle(servico)

    assert cc is not None
    assert cc.media == Decimal("100.000")
    assert cc.desvio_padrao == Decimal("7.906")
    assert cc.lsc == Decimal("123.718")
    assert cc.lic == Decimal("76.282")
    assert len(cc.pontos) == 5
    assert [p.data_referencia for p in cc.pontos] == [
        datetime.date(2026, 7, 1),
        datetime.date(2026, 7, 2),
        datetime.date(2026, 7, 3),
        datetime.date(2026, 7, 4),
        datetime.date(2026, 7, 5),
    ]
    assert all(p.fora_de_controle is False for p in cc.pontos)


def test_carta_controle_soma_dois_lancamentos_do_mesmo_dia_antes_da_amostra():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        quantidade_planejada=Decimal("10000.000"),
    )
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    usuario = projeto.criado_por
    for indice in range(4):
        registro = RegistroDiario.objects.create(
            projeto=projeto,
            data_referencia=datetime.date(2026, 7, 1) + datetime.timedelta(days=indice),
            turno="diurno",
            clima="sol",
            equipe=equipe,
            fiscal=usuario,
            autor=usuario,
            status="aprovado",
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
    # 5o dia: dois lancamentos no mesmo RDO, devem somar 100 antes de virar 1 ponto
    registro_5 = RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=datetime.date(2026, 7, 5),
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=usuario,
        autor=usuario,
        status="aprovado",
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_5,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.000"),
        km_final=Decimal("0.500"),
        quantidade=Decimal("70.000"),
        unidade=unidade,
    )
    ProducaoDiaria.objects.create(
        registro_diario=registro_5,
        rodovia="BR-365",
        sentido="crescente",
        disciplina=disciplina,
        servico=servico,
        km_inicial=Decimal("0.500"),
        km_final=Decimal("1.000"),
        quantidade=Decimal("30.000"),
        unidade=unidade,
    )

    cc = calcular_carta_controle(servico)

    assert cc is not None
    assert len(cc.pontos) == 5
    assert cc.pontos[4].quantidade == Decimal("100.000")
    assert cc.media == Decimal("100.000")
    assert cc.desvio_padrao == Decimal("0.000")


def test_carta_controle_marca_ponto_acima_do_lsc_como_fora_de_controle():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("10000.000"),
    )
    _criar_producoes_diarias(servico, [Decimal("100.000")] * 14 + [Decimal("400.000")])

    cc = calcular_carta_controle(servico)

    assert cc is not None
    assert cc.media == Decimal("120.000")
    assert cc.desvio_padrao == Decimal("77.460")
    assert cc.lsc == Decimal("352.380")
    assert cc.lic == Decimal("0.000")
    assert [p.fora_de_controle for p in cc.pontos] == [False] * 14 + [True]


def test_carta_controle_marca_ponto_abaixo_do_lic_como_fora_de_controle():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    servico = CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=_criar_unidade(),
        quantidade_planejada=Decimal("10000.000"),
    )
    _criar_producoes_diarias(servico, [Decimal("100.000")] * 14 + [Decimal("1.000")])

    cc = calcular_carta_controle(servico)

    assert cc is not None
    assert cc.media == Decimal("93.400")
    assert cc.desvio_padrao == Decimal("25.562")
    assert cc.lsc == Decimal("170.086")
    assert cc.lic == Decimal("16.714")
    assert [p.fora_de_controle for p in cc.pontos] == [False] * 14 + [True]
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v -k carta_controle`
Expected: `FAIL` com `ImportError: cannot import name 'calcular_carta_controle'`.

- [ ] **Step 3: Implementar `calcular_carta_controle`**

Em `backend/buildflow/projetos/services.py`, o bloco de imports do topo do arquivo hoje é:

```python
from __future__ import annotations

import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
```

Substitua por (ordem alfabética por nome de módulo, `dataclasses` < `datetime` < `decimal` <
`statistics` < `typing`):

```python
from __future__ import annotations

from dataclasses import dataclass
import datetime
from decimal import Decimal
from statistics import stdev
from typing import TYPE_CHECKING
```

Adicione, logo após a constante `DIAS_JANELA_ATIVIDADE = 7`:

```python
AMOSTRA_MINIMA_CARTA_CONTROLE = 5


@dataclass
class PontoCartaControle:
    data_referencia: datetime.date
    quantidade: Decimal
    fora_de_controle: bool


@dataclass
class CartaControle:
    media: Decimal
    desvio_padrao: Decimal
    lsc: Decimal
    lic: Decimal
    pontos: list[PontoCartaControle]


def calcular_carta_controle(servico: CatalogoServico) -> CartaControle | None:
    """Carta de controle (SPC) da produtividade diaria de um servico: soma as
    ProducaoDiaria aprovadas por dia (um RDO pode ter mais de um lancamento do
    mesmo servico no mesmo dia), calcula media/desvio padrao amostral e limites
    de controle (LSC/LIC = media +/- 3 desvios) a partir dos totais diarios
    reais. Com menos de AMOSTRA_MINIMA_CARTA_CONTROLE dias distintos, retorna
    None — nunca inventa estatistica com amostra pequena demais.
    """
    totais_por_dia = (
        ProducaoDiaria.objects.filter(
            servico=servico,
            registro_diario__status=StatusRegistroChoices.APROVADO,
        )
        .values("registro_diario__data_referencia")
        .annotate(total=Sum("quantidade"))
        .order_by("registro_diario__data_referencia")
    )

    if len(totais_por_dia) < AMOSTRA_MINIMA_CARTA_CONTROLE:
        return None

    valores = [linha["total"] for linha in totais_por_dia]
    media = (sum(valores) / len(valores)).quantize(Decimal("0.001"))
    desvio = stdev(valores).quantize(Decimal("0.001"))
    lsc = media + 3 * desvio
    lic = max(Decimal("0"), media - 3 * desvio)

    pontos = [
        PontoCartaControle(
            data_referencia=linha["registro_diario__data_referencia"],
            quantidade=linha["total"],
            fora_de_controle=linha["total"] > lsc or linha["total"] < lic,
        )
        for linha in totais_por_dia
    ]

    return CartaControle(media=media, desvio_padrao=desvio, lsc=lsc, lic=lic, pontos=pontos)
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v -k carta_controle`
Expected: todos os 5 testes `PASSED`.

- [ ] **Step 5: Rodar a suite completa do backend**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/ -q`
Expected: `198 passed` (193 de antes + 5 novos).

- [ ] **Step 6: Ruff e commit**

Run: `cd backend && uv run ruff format buildflow/projetos/services.py buildflow/projetos/tests/test_execucao.py && uv run ruff check buildflow/projetos/services.py buildflow/projetos/tests/test_execucao.py`
Expected: `All checks passed!`. Se `ruff check` acusar `I001` (import não ordenado) ou `COM812`
(vírgula final faltando), rode `uv run ruff check --fix buildflow/projetos/services.py buildflow/projetos/tests/test_execucao.py`
e confirme `All checks passed!` na sequência — mesmo padrão já usado em tasks anteriores deste
projeto.

```bash
git add backend/buildflow/projetos/services.py backend/buildflow/projetos/tests/test_execucao.py
git commit -m "feat: calcula carta de controle real de produtividade diaria por servico"
```

---

### Task 2: API — expõe a carta de controle no serializer

**Files:**
- Modify: `backend/buildflow/configuracoes/serializers.py`
- Modify: `backend/buildflow/configuracoes/tests/test_api.py`

**Interfaces:**
- Consumes: `calcular_carta_controle(servico) -> CartaControle | None` (Task 1).
- Produces: campo JSON `carta_controle` no `CatalogoServicoSerializer`: `null`, ou
  `{media, desvio_padrao, lsc, lic, pontos: [{data_referencia, quantidade, fora_de_controle}]}` com
  `pontos` em ordem cronológica crescente.

- [ ] **Step 1: Escrever o teste falho**

Em `backend/buildflow/configuracoes/tests/test_api.py`, adicione no topo do arquivo (junto aos
imports existentes):

```python
import datetime
```

E adicione, no final do arquivo:

```python
def test_servico_expoe_carta_controle_com_amostra_suficiente():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=unidade)
    equipe = Equipe.objects.create(projeto=projeto, nome="Equipe A")
    for indice, valor in enumerate(
        [Decimal("100.000"), Decimal("110.000"), Decimal("90.000"), Decimal("105.000"), Decimal("95.000")],
    ):
        registro = RegistroDiario.objects.create(
            projeto=projeto,
            data_referencia=datetime.date(2026, 7, 1) + datetime.timedelta(days=indice),
            turno="diurno",
            clima="sol",
            equipe=equipe,
            fiscal=usuario,
            autor=usuario,
            status="aprovado",
        )
        ProducaoDiaria.objects.create(
            registro_diario=registro,
            rodovia="BR-365",
            sentido="crescente",
            disciplina=disciplina,
            servico=servico,
            km_inicial=Decimal("0.000"),
            km_final=Decimal("1.000"),
            quantidade=valor,
            unidade=unidade,
        )
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")

    servico_body = response.json()["disciplinas"][0]["servicos"][0]
    cc = servico_body["carta_controle"]
    assert cc["media"] == "100.000"
    assert cc["desvio_padrao"] == "7.906"
    assert cc["lsc"] == "123.718"
    assert cc["lic"] == "76.282"
    assert cc["pontos"][0]["data_referencia"] == "2026-07-01"
    assert cc["pontos"][-1]["data_referencia"] == "2026-07-05"
    assert all(p["fora_de_controle"] is False for p in cc["pontos"])


def test_servico_expoe_carta_controle_nula_com_amostra_insuficiente():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=UnidadeFactory())
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")

    servico_body = response.json()["disciplinas"][0]["servicos"][0]
    assert servico_body["carta_controle"] is None


def test_configuracao_rdo_servico_nao_expoe_carta_controle():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    CatalogoServicoFactory(disciplina=disciplina, unidade=UnidadeFactory())
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao-rdo/")

    servico_body = response.json()["disciplinas"][0]["servicos"][0]
    assert "carta_controle" not in servico_body
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/configuracoes/tests/test_api.py -v -k carta_controle`
Expected: `FAIL` com `KeyError: 'carta_controle'`.

- [ ] **Step 3: Atualizar o serializer**

Em `backend/buildflow/configuracoes/serializers.py`, troque o import (linha 7):

```python
from buildflow.projetos.services import calcular_quantidade_executada_total
```

por:

```python
from buildflow.projetos.services import calcular_carta_controle
from buildflow.projetos.services import calcular_quantidade_executada_total
```

Na classe `CatalogoServicoSerializer`, adicione o campo e o método. Substitua:

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
```

por:

```python
class CatalogoServicoSerializer(serializers.ModelSerializer):
    avanco_percentual = serializers.SerializerMethodField()
    quantidade_executada = serializers.SerializerMethodField()
    producoes_vinculadas = serializers.SerializerMethodField()
    carta_controle = serializers.SerializerMethodField()

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
        ]
```

E adicione o método `get_carta_controle`, logo após `get_producoes_vinculadas`:

```python
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
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/configuracoes/tests/test_api.py -v -k carta_controle`
Expected: os 3 testes `PASSED`.

- [ ] **Step 5: Rodar a suite completa do backend**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/ -q`
Expected: `201 passed` (198 de antes + 3 novos).

- [ ] **Step 6: Ruff e commit**

Run: `cd backend && uv run ruff format buildflow/configuracoes/serializers.py buildflow/configuracoes/tests/test_api.py && uv run ruff check buildflow/configuracoes/serializers.py buildflow/configuracoes/tests/test_api.py`
Expected: `All checks passed!`

```bash
git add backend/buildflow/configuracoes/serializers.py backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: expoe carta de controle de produtividade na API da EAP"
```

---

### Task 3: Frontend — gráfico da carta de controle na aba EAP

**Files:**
- Create: `frontend/src/features/configuracoes/CartaControleChart.tsx`
- Modify: `frontend/src/types/configuracao.ts`
- Modify: `frontend/src/features/configuracoes/EapDisciplinaCard.tsx`
- Modify: `frontend/tests/e2e/config.spec.ts`

**Interfaces:**
- Consumes: campo JSON `carta_controle: CartaControle | null` do `CatalogoServico` (Task 2).

- [ ] **Step 1: Atualizar os tipos**

Em `frontend/src/types/configuracao.ts`, adicione (após a interface `ProducaoVinculada`):

```typescript
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
```

E adicione o campo `carta_controle: CartaControle | null` à interface `CatalogoServico`, logo após
`producoes_vinculadas`:

```typescript
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
}
```

- [ ] **Step 2: Criar o componente do gráfico**

Crie `frontend/src/features/configuracoes/CartaControleChart.tsx`:

```typescript
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatData } from '../../lib/format'
import type { CartaControle } from '../../types/configuracao'

interface CartaControleChartProps {
  cartaControle: CartaControle
}

export function CartaControleChart({ cartaControle }: CartaControleChartProps) {
  const dados = cartaControle.pontos.map((ponto) => ({
    rotulo: formatData(ponto.data_referencia),
    valor: Number(ponto.quantidade),
    valorForaDeControle: ponto.fora_de_controle ? Number(ponto.quantidade) : undefined,
  }))

  return (
    <div aria-label="Carta de controle de produtividade diária" style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer>
        <LineChart data={dados} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="rotulo"
            stroke="var(--color-muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <ReferenceLine y={Number(cartaControle.media)} stroke="var(--color-primary)" label="Média" />
          <ReferenceLine
            y={Number(cartaControle.lsc)}
            stroke="var(--color-destructive)"
            strokeDasharray="5 4"
            label="LSC"
          />
          <ReferenceLine
            y={Number(cartaControle.lic)}
            stroke="var(--color-destructive)"
            strokeDasharray="5 4"
            label="LIC"
          />
          <Line type="monotone" dataKey="valor" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
          <Line
            dataKey="valorForaDeControle"
            stroke="none"
            dot={{ r: 5, fill: 'var(--color-destructive)', stroke: 'var(--color-destructive)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Renderizar o gráfico no `EapServicoRow`**

Em `frontend/src/features/configuracoes/EapDisciplinaCard.tsx`, adicione o import (junto aos
existentes, no topo):

```typescript
import { CartaControleChart } from './CartaControleChart'
```

Dentro da função `EapServicoRow`, o bloco condicional `{lancamentosVisiveis && (...)}` (linhas
237-245 atuais) mostra hoje só a lista de lançamentos. Substitua por:

```typescript
      {lancamentosVisiveis && (
        <>
          {servico.carta_controle && <CartaControleChart cartaControle={servico.carta_controle} />}
          <ul className="flex flex-col gap-1 pl-1 text-muted-foreground">
            {servico.producoes_vinculadas.map((producao, indice) => (
              <li key={`${producao.data_referencia}-${producao.quantidade}-${indice}`}>
                {formatData(producao.data_referencia)} — {producao.quantidade}
              </li>
            ))}
          </ul>
        </>
      )}
```

- [ ] **Step 4: Rodar o typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem erros novos (lembrete: use sempre `-b`, `npx tsc --noEmit` sozinho é um no-op nesse
repo por causa de project references; o único erro esperado é o pré-existente e não relacionado em
`CustoCompositionDonutChart.tsx`).

- [ ] **Step 5: Corrigir os mocks existentes de `config.spec.ts`**

Em `frontend/tests/e2e/config.spec.ts`, os dois objetos de `servico` mockados dentro do teste
`'define peso da disciplina e adiciona serviço na aba EAP'` (o que tem `quantidade_executada_manual`
e `producoes_vinculadas` já adicionados por uma task anterior) precisam do campo novo, senão o
componente lê `servico.carta_controle` como `undefined` em vez de `null` — funcionalmente inofensivo
aqui (o `&&` trata `undefined` como falso também), mas deixa o mock com um formato diferente do real.
Em ambos os objetos, adicione logo após `producoes_vinculadas: [],`:

```typescript
                carta_controle: null,
```

- [ ] **Step 6: Escrever o novo teste e2e**

Em `frontend/tests/e2e/config.spec.ts`, adicione ao final do arquivo:

```typescript
test('mostra a carta de controle quando o servico tem amostra suficiente de RDOs aprovados', async ({ page }) => {
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
                quantidade_executada_manual: '0.000',
                quantidade_executada: '500.000',
                producoes_vinculadas: [
                  { data_referencia: '2026-07-05', quantidade: '95.000' },
                  { data_referencia: '2026-07-04', quantidade: '105.000' },
                  { data_referencia: '2026-07-03', quantidade: '90.000' },
                  { data_referencia: '2026-07-02', quantidade: '110.000' },
                  { data_referencia: '2026-07-01', quantidade: '100.000' },
                ],
                carta_controle: {
                  media: '100.000',
                  desvio_padrao: '7.906',
                  lsc: '123.718',
                  lic: '76.282',
                  pontos: [
                    { data_referencia: '2026-07-01', quantidade: '100.000', fora_de_controle: false },
                    { data_referencia: '2026-07-02', quantidade: '110.000', fora_de_controle: false },
                    { data_referencia: '2026-07-03', quantidade: '90.000', fora_de_controle: false },
                    { data_referencia: '2026-07-04', quantidade: '105.000', fora_de_controle: false },
                    { data_referencia: '2026-07-05', quantidade: '95.000', fora_de_controle: false },
                  ],
                },
                avanco_percentual: '50.00',
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
  await page.getByRole('button', { name: 'Ver lançamentos (5)' }).click()

  await expect(page.getByLabel('Carta de controle de produtividade diária')).toBeVisible()
})
```

- [ ] **Step 7: Rodar os testes e2e da aba de configuração**

Run: `cd frontend && npx playwright test tests/e2e/config.spec.ts`
Expected: todos os testes do arquivo `passed`.

- [ ] **Step 8: Rodar a suite e2e completa**

Run: `cd frontend && npx playwright test`
Expected: nenhuma regressão nos outros arquivos.

- [ ] **Step 9: Lint e commit**

Run: `cd frontend && npx oxlint src/types/configuracao.ts src/features/configuracoes/CartaControleChart.tsx src/features/configuracoes/EapDisciplinaCard.tsx tests/e2e/config.spec.ts`
Expected: sem erros (lembrete: este repo usa `oxlint`, não `eslint` — não existe configuração de
eslint aqui).

```bash
git add frontend/src/types/configuracao.ts frontend/src/features/configuracoes/CartaControleChart.tsx \
  frontend/src/features/configuracoes/EapDisciplinaCard.tsx frontend/tests/e2e/config.spec.ts
git commit -m "feat: mostra carta de controle de produtividade na aba EAP"
```
