# EAP — Gantt / Cronograma Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desenhar um Gantt (uma barra por disciplina) na aba EAP, usando as datas previstas já
existentes por serviço, atrás de um toggle "Ver cronograma (Gantt)".

**Architecture:** Uma função pura em `buildflow/projetos/services.py` deriva a janela
(início/fim) de cada disciplina do min/max das datas previstas dos serviços filhos. A
`DisciplinaSerializer` expõe essa janela como dois campos computados (`data_inicio_prevista`/
`data_fim_prevista`, mesmos nomes já usados em `CatalogoServico`). O frontend recebe isso já pronto
via `/api/v1/projetos/<id>/configuracao/` e desenha com Recharts, usando a técnica de "barra
flutuante" (duas séries empilhadas: uma invisível de offset, uma visível de duração) para simular um
Gantt com uma biblioteca de gráficos genérica.

**Tech Stack:** Django REST Framework (`SerializerMethodField`), Decimal/`datetime.date` para
cálculo, Recharts (`BarChart` com `layout="vertical"`, já dependência do projeto), React + TypeScript.

## Global Constraints

- Nenhuma disciplina sem base real (nenhum serviço com as duas datas previstas) aparece no
  Gantt — nunca inventa uma janela (princípio "nunca inventa número" do projeto).
- Cor da barra pelo `status_eap` da disciplina; `status_eap` nulo (bases divergentes ou dado
  insuficiente) usa cinza neutro (`var(--color-muted-foreground)`), nunca uma cor de status
  fabricada.
- Sem biblioteca de gráfico nova — usa Recharts (`^3.10.0`, já em `frontend/package.json`), mesmo
  padrão de `CartaControleChart.tsx` (CSS custom properties para bordas/eixos, `ResponsiveContainer`,
  `aria-label` no wrapper).
- Linha "hoje" calculada no browser (`Date.now()`), nunca vinda da API — evita herdar o bug de
  fuso horário já conhecido (`timezone.now().date()` vs `timezone.localdate()`) do cálculo backend.
- Uma barra por Disciplina (não por serviço) — sem Gantt por serviço nesta rodada.
- Sem edição de cronograma pelo Gantt (só visualização) e sem sub-abas novas dentro da aba EAP — o
  Gantt fica atrás de um toggle acima da lista de disciplinas já existente.

---

### Task 1: Janela (início/fim) da disciplina para o Gantt

**Files:**
- Modify: `backend/buildflow/projetos/services.py`
- Test: `backend/buildflow/projetos/tests/test_execucao.py`

**Interfaces:**
- Consumes: `Disciplina` (model, `backend/buildflow/configuracoes/models.py`),
  `CatalogoServico.data_inicio_prevista`/`data_fim_prevista` (já existentes).
- Produces: `calcular_janela_disciplina(disciplina: Disciplina) -> tuple[datetime.date, datetime.date] | None`
  — usado pela Task 2.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `backend/buildflow/projetos/tests/test_execucao.py`:

```python
from buildflow.projetos.services import calcular_janela_disciplina


def test_janela_disciplina_sem_nenhum_servico_com_as_duas_datas_retorna_none():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        data_inicio_prevista=datetime.date(2026, 1, 1),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
    )

    assert calcular_janela_disciplina(disciplina) is None


def test_janela_disciplina_usa_so_servicos_com_as_duas_datas():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        data_inicio_prevista=datetime.date(2026, 1, 10),
        data_fim_prevista=datetime.date(2026, 2, 10),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
        data_inicio_prevista=datetime.date(2026, 3, 1),
    )

    janela = calcular_janela_disciplina(disciplina)

    assert janela == (datetime.date(2026, 1, 10), datetime.date(2026, 2, 10))


def test_janela_disciplina_usa_menor_inicio_e_maior_fim_entre_servicos():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    unidade = _criar_unidade()
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Corte",
        unidade=unidade,
        data_inicio_prevista=datetime.date(2026, 1, 10),
        data_fim_prevista=datetime.date(2026, 3, 1),
    )
    CatalogoServico.objects.create(
        disciplina=disciplina,
        nome="Aterro",
        unidade=unidade,
        data_inicio_prevista=datetime.date(2026, 2, 1),
        data_fim_prevista=datetime.date(2026, 5, 20),
    )

    janela = calcular_janela_disciplina(disciplina)

    assert janela == (datetime.date(2026, 1, 10), datetime.date(2026, 5, 20))
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v -k janela_disciplina`
Expected: FAIL — `ImportError: cannot import name 'calcular_janela_disciplina'`.

- [ ] **Step 3: Implementar a função em `services.py`**

Em `backend/buildflow/projetos/services.py`, adicionar logo depois de
`calcular_status_eap_disciplina` (antes de `calcular_execucao_percentual`):

```python
def calcular_janela_disciplina(
    disciplina: Disciplina,
) -> tuple[datetime.date, datetime.date] | None:
    """Janela (inicio, fim) de uma disciplina para o Gantt: menor
    data_inicio_prevista e maior data_fim_prevista entre os servicos filhos
    que tem ambas as datas definidas. Sem nenhum servico com as duas datas,
    retorna None — disciplina nao aparece no Gantt, nunca inventa uma janela.
    """
    servicos_com_janela = [
        s
        for s in disciplina.servicos.all()
        if s.data_inicio_prevista is not None and s.data_fim_prevista is not None
    ]
    if not servicos_com_janela:
        return None
    return (
        min(s.data_inicio_prevista for s in servicos_com_janela),
        max(s.data_fim_prevista for s in servicos_com_janela),
    )
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/projetos/tests/test_execucao.py -v`
Expected: todos os testes (baseline + os 3 novos desta task) PASS.

- [ ] **Step 5: Rodar o ruff**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run ruff check buildflow/projetos/services.py buildflow/projetos/tests/test_execucao.py`
Expected: `All checks passed!` — se houver E501/import-order, corrigir antes do commit.

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/projetos/services.py backend/buildflow/projetos/tests/test_execucao.py
git commit -m "feat: calcula janela (inicio/fim) da disciplina para o Gantt da EAP"
```

---

### Task 2: Expor a janela da disciplina na API

**Files:**
- Modify: `backend/buildflow/configuracoes/serializers.py`
- Test: `backend/buildflow/configuracoes/tests/test_api.py`

**Interfaces:**
- Consumes: `calcular_janela_disciplina(disciplina) -> tuple[date, date] | None` (Task 1).
- Produces: `DisciplinaSerializer` com `data_inicio_prevista`/`data_fim_prevista` (campos
  computados, formato `str` ISO igual ao de `CatalogoServico`) — usado pela Task 3 via
  `/api/v1/projetos/<id>/configuracao/`.

- [ ] **Step 1: Escrever os testes de API que falham**

Adicionar ao final de `backend/buildflow/configuracoes/tests/test_api.py`:

```python
def test_disciplina_expoe_janela_derivada_dos_servicos_com_data():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    CatalogoServicoFactory(
        disciplina=disciplina,
        unidade=unidade,
        data_inicio_prevista=datetime.date(2026, 1, 10),
        data_fim_prevista=datetime.date(2026, 3, 1),
    )
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")

    disciplina_body = response.json()["disciplinas"][0]
    assert disciplina_body["data_inicio_prevista"] == "2026-01-10"
    assert disciplina_body["data_fim_prevista"] == "2026-03-01"


def test_disciplina_sem_servico_com_as_duas_datas_expoe_janela_nula():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    CatalogoServicoFactory(disciplina=disciplina, unidade=UnidadeFactory())
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")

    disciplina_body = response.json()["disciplinas"][0]
    assert disciplina_body["data_inicio_prevista"] is None
    assert disciplina_body["data_fim_prevista"] is None


def test_configuracao_rdo_disciplina_nao_expoe_janela_do_gantt():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    CatalogoServicoFactory(disciplina=disciplina, unidade=UnidadeFactory())
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao-rdo/")

    disciplina_body = response.json()["disciplinas"][0]
    assert "data_inicio_prevista" not in disciplina_body
    assert "data_fim_prevista" not in disciplina_body
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/configuracoes/tests/test_api.py -v -k "janela_do_gantt or janela_derivada or janela_nula"`
Expected: FAIL — `KeyError: 'data_inicio_prevista'` no corpo de `disciplina_body` (o campo ainda
não existe no serializer).

- [ ] **Step 3: Adicionar os campos ao `DisciplinaSerializer`**

Em `backend/buildflow/configuracoes/serializers.py`, adicionar `import datetime` como a primeira
linha do arquivo (antes de `from decimal import Decimal` — segue a ordem padrão de imports:
biblioteca padrão primeiro), e o import do novo cálculo (ordem alfabética, junto dos demais imports
de `buildflow.projetos.services`):

```python
import datetime
from decimal import Decimal

from rest_framework import serializers

from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_previsto_disciplina
from buildflow.projetos.services import calcular_avanco_previsto_servico
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import calcular_carta_controle
from buildflow.projetos.services import calcular_janela_disciplina
from buildflow.projetos.services import calcular_quantidade_executada_total
from buildflow.projetos.services import calcular_status_eap_disciplina
from buildflow.projetos.services import classificar_status_eap
from buildflow.projetos.services import decimal_para_str_ou_none
from buildflow.projetos.services import listar_producoes_vinculadas
```

Substituir a classe `DisciplinaSerializer` inteira (linhas 151-182 do arquivo atual) por:

```python
class DisciplinaSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoSerializer(many=True, read_only=True)
    avanco_percentual = serializers.SerializerMethodField()
    avanco_previsto_percentual = serializers.SerializerMethodField()
    status_eap = serializers.SerializerMethodField()
    data_inicio_prevista = serializers.SerializerMethodField()
    data_fim_prevista = serializers.SerializerMethodField()

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
            "data_inicio_prevista",
            "data_fim_prevista",
        ]

    def _avanco_real(self, obj: Disciplina) -> Decimal | None:
        cache = self.context.setdefault("_avanco_real_disciplina_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = calcular_avanco_disciplina(obj)
        return cache[obj.pk]

    def get_avanco_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(self._avanco_real(obj))

    def get_avanco_previsto_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_previsto_disciplina(obj))

    def get_status_eap(self, obj: Disciplina) -> str | None:
        return calcular_status_eap_disciplina(obj)

    def _janela(self, obj: Disciplina) -> tuple[datetime.date, datetime.date] | None:
        cache = self.context.setdefault("_janela_disciplina_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = calcular_janela_disciplina(obj)
        return cache[obj.pk]

    def get_data_inicio_prevista(self, obj: Disciplina) -> str | None:
        janela = self._janela(obj)
        return janela[0].isoformat() if janela else None

    def get_data_fim_prevista(self, obj: Disciplina) -> str | None:
        janela = self._janela(obj)
        return janela[1].isoformat() if janela else None
```

`CatalogoServicoResumoSerializer`/`DisciplinaResumoSerializer` (bootstrap do RDO) não mudam — já
listam campos explícitos e não ganham `data_inicio_prevista`/`data_fim_prevista` por não estarem no
`Meta.fields` deles.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/configuracoes/ buildflow/projetos/ -v`
Expected: todos PASS (baseline + 3 testes novos desta task).

- [ ] **Step 5: Rodar o ruff**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run ruff check buildflow/configuracoes/serializers.py buildflow/configuracoes/tests/test_api.py`
Expected: `All checks passed!`

- [ ] **Step 6: Commit**

```bash
git add backend/buildflow/configuracoes/serializers.py backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: expoe janela da disciplina para o Gantt na API da EAP"
```

---

### Task 3: Desenhar o Gantt na aba EAP (frontend)

**Files:**
- Modify: `frontend/src/types/configuracao.ts`
- Create: `frontend/src/features/configuracoes/GanttChart.tsx`
- Modify: `frontend/src/pages/ConfiguracaoPage.tsx`
- Test: `frontend/tests/e2e/config.spec.ts`

**Interfaces:**
- Consumes: API de `Disciplina` da Task 2 (`data_inicio_prevista`, `data_fim_prevista`, já
  existentes `avanco_percentual`, `status_eap`).
- Produces: nada consumido por tasks futuras desta spec (última task).

- [ ] **Step 1: Adicionar os campos novos ao tipo `Disciplina`**

Em `frontend/src/types/configuracao.ts`, substituir a interface `Disciplina` (linhas 41-49 do
arquivo atual) por:

```typescript
export interface Disciplina {
  id: string
  nome: string
  peso_percentual: string | null
  servicos: CatalogoServico[]
  avanco_percentual: string | null
  avanco_previsto_percentual: string | null
  status_eap: StatusEap | null
  data_inicio_prevista: string | null
  data_fim_prevista: string | null
}
```

- [ ] **Step 2: Escrever o teste e2e que falha**

Adicionar ao final de `frontend/tests/e2e/config.spec.ts`:

```typescript
test('toggle do Gantt fica oculto por padrao e mostra o cronograma ao clicar', async ({ page }) => {
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
            avanco_percentual: '50.00',
            avanco_previsto_percentual: '60.00',
            status_eap: 'atencao',
            data_inicio_prevista: '2026-01-01',
            data_fim_prevista: '2026-03-01',
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: '100.00',
                quantidade_planejada: '1000.000',
                quantidade_executada_manual: '500.000',
                quantidade_executada: '500.000',
                producoes_vinculadas: [],
                carta_controle: null,
                avanco_percentual: '50.00',
                data_inicio_prevista: '2026-01-01',
                data_fim_prevista: '2026-03-01',
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

  await expect(page.getByLabel('Cronograma da EAP')).not.toBeVisible()
  await page.getByRole('button', { name: 'Ver cronograma (Gantt)' }).click()
  await expect(page.getByLabel('Cronograma da EAP')).toBeVisible()
})

test('disciplina sem janela valida nao aparece no Gantt', async ({ page }) => {
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
            avanco_percentual: null,
            avanco_previsto_percentual: null,
            status_eap: null,
            data_inicio_prevista: null,
            data_fim_prevista: null,
            servicos: [],
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

  await expect(page.getByRole('button', { name: 'Ver cronograma (Gantt)' })).not.toBeVisible()
})
```

- [ ] **Step 3: Rodar o teste e2e e confirmar que falha**

Run: `cd frontend && npx playwright test config.spec.ts -g "Gantt"`
Expected: FAIL — nem o botão "Ver cronograma (Gantt)" nem o `aria-label` "Cronograma da EAP" existem
ainda.

- [ ] **Step 4: Criar `GanttChart.tsx`**

Criar `frontend/src/features/configuracoes/GanttChart.tsx`:

```tsx
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Disciplina, StatusEap } from '../../types/configuracao'

interface GanttChartProps {
  disciplinas: Disciplina[]
}

const ALTURA_CABECALHO = 40
const ALTURA_POR_LINHA = 40

const STATUS_GANTT_CORES: Record<StatusEap, string> = {
  concluido: '#10b981',
  no_prazo: '#10b981',
  atencao: '#f59e0b',
  critico: '#ef4444',
  nao_iniciado: 'var(--color-muted-foreground)',
  planejado: '#06b6d4',
}
const COR_SEM_STATUS = 'var(--color-muted-foreground)'

function corDaBarra(status: StatusEap | null): string {
  return status === null ? COR_SEM_STATUS : STATUS_GANTT_CORES[status]
}

function gerarTicksMensais(minimo: number, maximo: number): number[] {
  const ticks: number[] = []
  const cursor = new Date(minimo)
  cursor.setDate(1)
  cursor.setHours(0, 0, 0, 0)
  while (cursor.getTime() <= maximo) {
    ticks.push(cursor.getTime() - minimo)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return ticks
}

interface BarraDuracaoProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: { avancoReal: number; cor: string }
}

function BarraDuracao({ x = 0, y = 0, width = 0, height = 0, payload }: BarraDuracaoProps) {
  const cor = payload?.cor ?? COR_SEM_STATUS
  const avancoReal = payload?.avancoReal ?? 0
  const larguraProgresso = Math.max(0, (width * Math.min(100, avancoReal)) / 100)
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={cor} fillOpacity={0.18} stroke={cor} strokeWidth={1} />
      <rect x={x} y={y} width={larguraProgresso} height={height} rx={4} fill={cor} />
    </g>
  )
}

interface TooltipGanttProps {
  active?: boolean
  payload?: Array<{ payload: { nome: string; avancoReal: number } }>
}

function TooltipGantt({ active, payload }: TooltipGanttProps) {
  if (!active || !payload || payload.length === 0) return null
  const { nome, avancoReal } = payload[0].payload
  return (
    <div
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        fontSize: 12,
        padding: '6px 10px',
      }}
    >
      <div style={{ fontWeight: 600 }}>{nome}</div>
      <div>{avancoReal}% executado</div>
    </div>
  )
}

export function GanttChart({ disciplinas }: GanttChartProps) {
  const linhas = disciplinas
    .filter((d) => d.data_inicio_prevista !== null && d.data_fim_prevista !== null)
    .map((d) => ({
      nome: d.nome,
      inicio: new Date(d.data_inicio_prevista as string).getTime(),
      fim: new Date(d.data_fim_prevista as string).getTime(),
      avancoReal: d.avanco_percentual ? Number(d.avanco_percentual) : 0,
      cor: corDaBarra(d.status_eap),
    }))

  if (linhas.length === 0) return null

  const dominioMinimo = Math.min(...linhas.map((l) => l.inicio))
  const dominioMaximo = Math.max(...linhas.map((l) => l.fim))

  const dados = linhas.map((l) => ({
    nome: l.nome,
    offset: l.inicio - dominioMinimo,
    duracao: l.fim - l.inicio,
    avancoReal: l.avancoReal,
    cor: l.cor,
  }))

  const ticksMensais = gerarTicksMensais(dominioMinimo, dominioMaximo)
  const hojeOffset = Date.now() - dominioMinimo
  const mostrarHoje = hojeOffset >= 0 && hojeOffset <= dominioMaximo - dominioMinimo

  return (
    <div
      aria-label="Cronograma da EAP"
      style={{ width: '100%', height: ALTURA_CABECALHO + linhas.length * ALTURA_POR_LINHA }}
    >
      <ResponsiveContainer>
        <BarChart data={dados} layout="vertical" margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis
            type="number"
            domain={[0, dominioMaximo - dominioMinimo]}
            ticks={ticksMensais}
            tickFormatter={(offset: number) =>
              new Date(offset + dominioMinimo).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
            }
            stroke="var(--color-muted-foreground)"
            fontSize={11}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={140}
            stroke="var(--color-muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={TooltipGantt} />
          {mostrarHoje && <ReferenceLine x={hojeOffset} stroke="#f59e0b" strokeDasharray="4 3" label="Hoje" />}
          <Bar dataKey="offset" stackId="gantt" fill="transparent" isAnimationActive={false} name="offset" />
          <Bar dataKey="duracao" stackId="gantt" shape={BarraDuracao} isAnimationActive={false} name="duracao" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 5: Adicionar o toggle na aba EAP em `ConfiguracaoPage.tsx`**

Em `frontend/src/pages/ConfiguracaoPage.tsx`, adicionar o import (junto dos demais imports de
`features/configuracoes`, linha 13 atual):

```typescript
import { GanttChart } from '../features/configuracoes/GanttChart'
```

Adicionar um novo estado logo após os `useState` já existentes (linha 72 atual, depois de
`valorMaquinaId`):

```typescript
  const [verGantt, setVerGantt] = useState(false)
```

Na `TabsContent value="eap"` (linhas 137-161 atuais), adicionar o botão de toggle e o componente
condicional logo antes da `<ul>` de disciplinas — só renderiza o botão quando existe ao menos uma
disciplina com janela válida (`data_inicio_prevista`/`data_fim_prevista` não-nulos):

```tsx
        <TabsContent value="eap">
          <Card title="EAP">
            <div aria-label="EAP">
              {disciplinas.length === 0 && (
                <EmptyState>Cadastre uma disciplina na aba Disciplinas para começar a EAP.</EmptyState>
              )}
              {disciplinas.some((d) => d.data_inicio_prevista !== null && d.data_fim_prevista !== null) && (
                <div className="mb-4">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setVerGantt((valor) => !valor)}>
                    {verGantt ? 'Ocultar cronograma' : 'Ver cronograma (Gantt)'}
                  </Button>
                  {verGantt && <GanttChart disciplinas={disciplinas} />}
                </div>
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

- [ ] **Step 6: Rodar o teste e2e e confirmar que passa**

Run: `cd frontend && npx playwright test config.spec.ts`
Expected: todos os testes do arquivo PASS, incluindo os 2 novos desta task.

- [ ] **Step 7: Rodar o typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: nenhum erro novo (o único erro pré-existente conhecido, em
`CustoCompositionDonutChart.tsx`, não é desta task).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/configuracao.ts frontend/src/features/configuracoes/GanttChart.tsx frontend/src/pages/ConfiguracaoPage.tsx frontend/tests/e2e/config.spec.ts
git commit -m "feat: desenha o Gantt (cronograma) da EAP atras de um toggle"
```
