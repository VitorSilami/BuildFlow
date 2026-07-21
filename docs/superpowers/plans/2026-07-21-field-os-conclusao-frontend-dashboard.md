# Field OS — Conclusão (Frontend Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o Dashboard com gráficos (Recharts) e cores semânticas — gráfico de barras de
atividade de RDO, donut de distribuição de status, e barra de execução "semáforo" (vermelho/âmbar/
verde) — deixando a leitura de saúde da operação mais rápida, sem inventar nenhum dado que o
backend não fornece.

**Architecture:** `DashboardPage.tsx` ganha dois componentes de gráfico novos
(`AtividadeRdoChart`, `StatusDonutChart`) em `frontend/src/features/dashboard/`, mais um ajuste de
cor na barra de execução já existente na lista de "Projetos ativos". Depende do backend do plano
`2026-07-21-field-os-conclusao-backend.md` (campo `atividade_rdo` em `GET /api/v1/dashboard/`) já
estar mesclado.

**Tech Stack:** React 19, TypeScript, TanStack Query, Tailwind v4, Recharts (nova dependência),
Playwright (E2E, única camada de teste do frontend por convenção deste projeto).

## Global Constraints

- Nunca inventar dado: se `execucao_percentual` for `null`, nunca renderizar uma barra em 0% —
  mesma regra já aplicada em `ProjetosListPage`.
- Se a soma de ativos+pausados+concluídos for 0 (empresa sem nenhum projeto), o donut de status não
  renderiza (evita um gráfico vazio sem sentido) — o `EmptyState` existente já cobre esse caso.
- Cores semânticas de status reaproveitam as já usadas em `ProjetosListPage.tsx`
  (`STATUS_BADGE_CLASS`): ativo=emerald, pausado=amber, concluído=slate.
- `atividade_rdo` sempre vem com os 7 dias preenchidos pelo backend (nunca precisa preencher gap no
  frontend) — ver `docs/superpowers/plans/2026-07-21-field-os-conclusao-backend.md`.
- Nunca usar `--no-verify`; commits novos ao invés de amend.

---

### Task 1: Gráfico "RDOs por dia" (Recharts)

**Files:**
- Modify: `frontend/package.json` (dependência `recharts`)
- Modify: `frontend/src/types/dashboard.ts`
- Create: `frontend/src/features/dashboard/AtividadeRdoChart.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Produces: `DashboardAtividadeDia { data: string; quantidade: number }`, campo
  `atividade_rdo: DashboardAtividadeDia[]` em `DashboardResponse`; componente
  `AtividadeRdoChart({ dados }: { dados: DashboardAtividadeDia[] })`.

- [ ] **Step 1: Instalar Recharts**

Run: `cd frontend && npm install recharts`
Expected: `recharts` adicionado a `dependencies` em `package.json`/`package-lock.json`.

- [ ] **Step 2: Atualizar o tipo `DashboardResponse`**

Em `frontend/src/types/dashboard.ts`, adicionar a interface e o campo:

```typescript
export interface DashboardProjeto {
  id: string
  nome: string
  status: 'ativo' | 'pausado' | 'concluido'
  execucao_percentual: string | null
}

export interface DashboardAlerta {
  projeto_id: string
  projeto_nome: string
  dias_sem_rdo: number | null
}

export interface DashboardAtividadeDia {
  data: string
  quantidade: number
}

export interface DashboardResponse {
  projetos_ativos: number
  projetos_pausados: number
  projetos_concluidos: number
  execucao_media: string | null
  projetos: DashboardProjeto[]
  alertas: DashboardAlerta[]
  atividade_rdo: DashboardAtividadeDia[]
}
```

- [ ] **Step 3: Criar `AtividadeRdoChart.tsx`**

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DashboardAtividadeDia } from '../../types/dashboard'

const DIAS_SEMANA_ABREVIADOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function formatarDiaCurto(iso: string): string {
  const data = new Date(`${iso}T00:00:00`)
  return DIAS_SEMANA_ABREVIADOS[data.getDay()]
}

interface AtividadeRdoChartProps {
  dados: DashboardAtividadeDia[]
}

export function AtividadeRdoChart({ dados }: AtividadeRdoChartProps) {
  const dadosFormatados = dados.map((dia) => ({ ...dia, rotulo: formatarDiaCurto(dia.data) }))

  return (
    <div aria-label="Gráfico de RDOs por dia" style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={dadosFormatados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="rotulo"
            stroke="var(--color-muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            stroke="var(--color-muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={24}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-surface)' }}
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="quantidade" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="RDOs" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Integrar no `DashboardPage.tsx`**

Adicionar o import e renderizar o gráfico logo após o grid de tiles de resumo (antes do card de
"Alertas de RDO"):

```tsx
import { AtividadeRdoChart } from '../features/dashboard/AtividadeRdoChart'
```

```tsx
          <Card title="RDOs por dia">
            <AtividadeRdoChart dados={data.atividade_rdo} />
          </Card>
```

- [ ] **Step 5: Atualizar os mocks de `dashboard.spec.ts` e adicionar teste do gráfico**

As 3 respostas mockadas de `DASHBOARD_URL` em `frontend/tests/e2e/dashboard.spec.ts` precisam do
campo novo (senão `data.atividade_rdo` é `undefined` e o componente quebra em runtime). Adicionar
`atividade_rdo: []` (ou dados reais, ver teste novo abaixo) em cada uma das 3 respostas mockadas
existentes.

Na primeira resposta mockada (teste `'dashboard mostra resumo, projetos ativos e alertas'`), usar
dados reais em vez de array vazio:

```typescript
        atividade_rdo: [
          { data: '2026-07-14', quantidade: 2 },
          { data: '2026-07-15', quantidade: 0 },
          { data: '2026-07-16', quantidade: 3 },
          { data: '2026-07-17', quantidade: 1 },
          { data: '2026-07-18', quantidade: 0 },
          { data: '2026-07-19', quantidade: 4 },
          { data: '2026-07-20', quantidade: 2 },
        ],
```

Nas outras 2 respostas mockadas (testes `'dashboard sem projetos ativos...'` e `'busca no
Topbar...'`), adicionar `atividade_rdo: []`.

No primeiro teste, adicionar a asserção do gráfico ao final:

```typescript
  await expect(page.getByLabel('Gráfico de RDOs por dia')).toBeVisible()
```

- [ ] **Step 6: Rodar o build e os testes**

Run: `cd frontend && npm run build && npx playwright test tests/e2e/dashboard.spec.ts`
Expected: build exit 0; 3/3 testes passando.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/dashboard.ts frontend/src/features/dashboard/AtividadeRdoChart.tsx frontend/src/pages/DashboardPage.tsx frontend/tests/e2e/dashboard.spec.ts
git commit -m "feat: adiciona grafico de RDOs por dia ao Dashboard"
```

---

### Task 2: Gráfico de distribuição de status (donut)

**Files:**
- Create: `frontend/src/features/dashboard/StatusDonutChart.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Produces: `StatusDonutChart({ ativos, pausados, concluidos }: { ativos: number; pausados: number; concluidos: number })`.

- [ ] **Step 1: Criar `StatusDonutChart.tsx`**

```tsx
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const CORES_STATUS = {
  ativo: '#10b981',
  pausado: '#f59e0b',
  concluido: '#64748b',
} as const

interface StatusDonutChartProps {
  ativos: number
  pausados: number
  concluidos: number
}

export function StatusDonutChart({ ativos, pausados, concluidos }: StatusDonutChartProps) {
  const dados = [
    { status: 'ativo' as const, label: 'Ativos', valor: ativos },
    { status: 'pausado' as const, label: 'Pausados', valor: pausados },
    { status: 'concluido' as const, label: 'Concluídos', valor: concluidos },
  ]

  return (
    <div aria-label="Gráfico de distribuição de status" style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={dados}
            dataKey="valor"
            nameKey="label"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {dados.map((entrada) => (
              <Cell key={entrada.status} fill={CORES_STATUS[entrada.status]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Integrar no `DashboardPage.tsx`**

Import:

```tsx
import { StatusDonutChart } from '../features/dashboard/StatusDonutChart'
```

Logo após o Card de "RDOs por dia" do Task 1, renderizar condicionalmente (nunca um donut vazio
sem sentido quando a empresa não tem nenhum projeto):

```tsx
          {data.projetos_ativos + data.projetos_pausados + data.projetos_concluidos > 0 && (
            <Card title="Distribuição de status">
              <StatusDonutChart
                ativos={data.projetos_ativos}
                pausados={data.projetos_pausados}
                concluidos={data.projetos_concluidos}
              />
            </Card>
          )}
```

- [ ] **Step 3: Adicionar teste e2e**

Em `frontend/tests/e2e/dashboard.spec.ts`, no primeiro teste (que já tem `projetos_ativos: 1`),
adicionar ao final:

```typescript
  await expect(page.getByLabel('Gráfico de distribuição de status')).toBeVisible()
```

E no teste `'dashboard sem projetos ativos mostra estado vazio'` (todos os contadores em 0),
adicionar a asserção negativa:

```typescript
  await expect(page.getByLabel('Gráfico de distribuição de status')).not.toBeVisible()
```

- [ ] **Step 4: Rodar o build e os testes**

Run: `cd frontend && npm run build && npx playwright test tests/e2e/dashboard.spec.ts`
Expected: build exit 0; 3/3 testes passando.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/dashboard/StatusDonutChart.tsx frontend/src/pages/DashboardPage.tsx frontend/tests/e2e/dashboard.spec.ts
git commit -m "feat: adiciona grafico de distribuicao de status ao Dashboard"
```

---

### Task 3: Execução "semáforo" e ícones

**Files:**
- Modify: `frontend/src/components/ui/progress.tsx`
- Modify: `frontend/src/lib/format.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Produces: `Progress` ganha prop opcional `indicatorClassName?: string`;
  `execucaoCorClasse(valor: string | null): string` em `lib/format.ts`.

- [ ] **Step 1: `Progress` ganha `indicatorClassName`**

Em `frontend/src/components/ui/progress.tsx`, trocar o corpo do componente:

```tsx
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
```

(Sem prop nova, comportamento idêntico ao atual — `indicatorClassName` undefined vira `cn(x,
undefined)` que é um no-op.)

- [ ] **Step 2: `execucaoCorClasse` em `lib/format.ts`**

Adicionar ao final de `frontend/src/lib/format.ts`:

```typescript
const LIMITE_EXECUCAO_BAIXA = 30
const LIMITE_EXECUCAO_MEDIA = 70

export function execucaoCorClasse(valor: string | null): string {
  if (valor === null) return 'bg-muted-foreground'
  const numero = Number(valor)
  if (numero < LIMITE_EXECUCAO_BAIXA) return 'bg-red-500'
  if (numero < LIMITE_EXECUCAO_MEDIA) return 'bg-amber-500'
  return 'bg-emerald-500'
}
```

- [ ] **Step 3: Barra de execução colorida + ícones em `DashboardPage.tsx`**

Import de ícones e helper novos:

```tsx
import { AlertTriangle, CheckCircle2, FolderKanban, PauseCircle, TrendingUp } from 'lucide-react'
import { execucaoCorClasse, formatExecucao } from '../lib/format'
import { Progress } from '../components/ui'
```

(`Progress` precisa entrar na lista de imports de `'../components/ui'` já existente no topo do
arquivo, junto com `Badge, Card, EmptyState, ErrorRetry, PageHeader, Spinner`.)

Tiles de resumo — cada `<Card title="...">` ganha um ícone ao lado do número (mesmo padrão visual
usado em `ProjetosListPage` com `MapPin`/`User`/`Calendar`):

```tsx
            <Card title="Projetos ativos">
              <div className="flex items-center gap-2">
                <FolderKanban className="text-primary" size={20} aria-hidden="true" />
                <p className="text-3xl font-bold text-ink">{data.projetos_ativos}</p>
              </div>
            </Card>
            <Card title="Pausados">
              <div className="flex items-center gap-2">
                <PauseCircle className="text-amber-500" size={20} aria-hidden="true" />
                <p className="text-3xl font-bold text-ink">{data.projetos_pausados}</p>
              </div>
            </Card>
            <Card title="Concluídos">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-slate-500" size={20} aria-hidden="true" />
                <p className="text-3xl font-bold text-ink">{data.projetos_concluidos}</p>
              </div>
            </Card>
            <Card title="Execução média">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-emerald-500" size={20} aria-hidden="true" />
                <p className="text-3xl font-bold text-ink">{formatExecucao(data.execucao_media)}</p>
              </div>
            </Card>
```

Alertas — ícone antes de cada link:

```tsx
                {data.alertas.map((alerta) => (
                  <li key={alerta.projeto_id} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="text-destructive" size={16} aria-hidden="true" />
                      <Link
                        to={`/projetos/${alerta.projeto_id}/registros-diarios/novo`}
                        className="font-medium text-primary hover:underline"
                      >
                        {alerta.projeto_nome}
                      </Link>
                    </span>
                    <Badge variant="destructive">
                      {alerta.dias_sem_rdo === null
                        ? 'Nunca registrado'
                        : `${alerta.dias_sem_rdo} dias sem RDO`}
                    </Badge>
                  </li>
                ))}
```

Lista de "Projetos ativos" — troca o texto solto de execução por uma barra colorida (mantém o `—`
textual quando `execucao_percentual` é `null`, nunca uma barra em 0%):

```tsx
                {data.projetos.map((projeto) => (
                  <li key={projeto.id} className="flex items-center justify-between gap-4">
                    <Link
                      to={`/projetos/${projeto.id}/registros-diarios`}
                      className="font-medium text-primary hover:underline"
                    >
                      {projeto.nome}
                    </Link>
                    {projeto.execucao_percentual === null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <div className="flex w-32 items-center gap-2">
                        <Progress
                          value={Number(projeto.execucao_percentual)}
                          indicatorClassName={execucaoCorClasse(projeto.execucao_percentual)}
                        />
                        <span className="w-12 text-right text-sm text-muted-foreground">
                          {formatExecucao(projeto.execucao_percentual)}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
```

- [ ] **Step 4: Rodar o build e os testes**

Run: `cd frontend && npm run build && npx playwright test tests/e2e/dashboard.spec.ts`
Expected: build exit 0; 3/3 testes passando (os testes existentes já checam `40.00%` e
`'—'` — continuam batendo, só a marcação visual muda).

- [ ] **Step 5: Teste novo — cor da barra por faixa**

Adicionar a `frontend/tests/e2e/dashboard.spec.ts` (reaproveitando o padrão dos testes existentes):

```typescript
test('barra de execucao usa cor por faixa', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(DASHBOARD_URL, (route) =>
    route.fulfill({
      json: {
        projetos_ativos: 3,
        projetos_pausados: 0,
        projetos_concluidos: 0,
        execucao_media: '50.00',
        projetos: [
          { id: 'p-baixa', nome: 'Baixa', status: 'ativo', execucao_percentual: '10.00' },
          { id: 'p-media', nome: 'Media', status: 'ativo', execucao_percentual: '50.00' },
          { id: 'p-alta', nome: 'Alta', status: 'ativo', execucao_percentual: '90.00' },
        ],
        alertas: [],
        atividade_rdo: [],
      },
    }),
  )

  await page.goto('/dashboard')

  const indicadorBaixa = page.locator('li', { hasText: 'Baixa' }).locator('[class*="bg-red-500"]')
  const indicadorMedia = page.locator('li', { hasText: 'Media' }).locator('[class*="bg-amber-500"]')
  const indicadorAlta = page.locator('li', { hasText: 'Alta' }).locator('[class*="bg-emerald-500"]')

  await expect(indicadorBaixa).toBeVisible()
  await expect(indicadorMedia).toBeVisible()
  await expect(indicadorAlta).toBeVisible()
})
```

- [ ] **Step 6: Rodar todos os testes de dashboard novamente**

Run: `cd frontend && npx playwright test tests/e2e/dashboard.spec.ts`
Expected: 4/4 testes passando.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ui/progress.tsx frontend/src/lib/format.ts frontend/src/pages/DashboardPage.tsx frontend/tests/e2e/dashboard.spec.ts
git commit -m "feat: adiciona cores semanticas e icones ao Dashboard"
```

---

### Task 4: Verificação final

**Files:** none esperado além de possíveis pequenos ajustes achados na verificação.

- [ ] **Step 1: Suíte completa**

```bash
cd frontend
npm run build
npm run lint
npm run test
npx playwright test
```
Expected: build exit 0, lint exit 0 (só warnings pré-existentes de fast-refresh), `npm run test`
reporta 0 testes (convenção já estabelecida), suíte Playwright completa passando.

- [ ] **Step 2: Atualizar `specs/001-mvp-gestao-diaria/tasks.md`**

Adicionar ao final do arquivo:

```markdown

**Frontend do "Field OS" — Dashboard com gráficos (2026-07-21)**: `DashboardPage` ganha 2 gráficos
Recharts (nova dependência) — barra de "RDOs por dia" (últimos 7 dias, `atividade_rdo` do backend)
e donut de distribuição de status (ativos/pausados/concluídos, mesmas cores semânticas dos badges
de projeto), mais barra de execução "semáforo" (vermelho <30%/âmbar 30–70%/verde >70%) na lista de
projetos ativos e ícones nas tiles de resumo e nos alertas. `Progress` ganha prop opcional
`indicatorClassName` para permitir a cor por faixa sem duplicar o componente.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra dashboard com graficos do Field OS frontend em tasks.md"
```
