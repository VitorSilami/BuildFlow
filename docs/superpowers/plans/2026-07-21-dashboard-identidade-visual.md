# Dashboard — Piloto de Identidade Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender pro Dashboard a identidade visual já forte na `LoginPage`/`Sidebar` (mono-caps,
marcadores tipo dado técnico, blueprint sutil, acento `signal`) — piloto antes de espalhar pras
outras telas autenticadas.

**Architecture:** `Card` (composite compartilhado) ganha um prop opcional `eyebrow` — aditivo,
zero mudança de comportamento pros 20+ consumidores existentes que não passam esse prop.
`DashboardPage.tsx` ganha um componente local `TileResumo` (substitui as 4 tiles de `Card`+ícone
por caixas com borda tracejada, label mono-caps + valor — mesmo padrão da seção "facts" do
`HeroMock` da `LoginPage`), eyebrows nos 2 cards de gráfico, e uma textura `grid-blueprint` sutil
atrás do `PageHeader`. Puramente apresentação — nenhuma mudança de dado, hook, ou lógica de negócio.

**Tech Stack:** React 19, TypeScript, Tailwind v4 (utility `grid-blueprint` já existe em
`app.css:131`), Playwright.

## Global Constraints

- Zero mudança de comportamento/dado: os mesmos valores (`data.projetos_ativos`,
  `data.execucao_media`, etc.) continuam sendo exibidos, só a apresentação muda.
- `Card`'s novo prop `eyebrow` é opcional — todo consumidor existente que não passa esse prop deve
  renderizar exatamente como hoje (nenhuma mudança visual quando omitido).
- Acento `signal` (ponto colorido) só no eyebrow do gráfico "RDOs por dia" — não duplicar em outros
  lugares (princípio de restrição do design: "gastar a ousadia num lugar só").
- Textura `grid-blueprint` com opacidade baixa (10–15%) — Dashboard é tela de trabalho densa, não
  uma hero page como o login (lá usa 70%/20%).
- Nunca usar `--no-verify`; commits novos ao invés de amend.

---

### Task 1: `Card` ganha prop opcional `eyebrow`

**Files:**
- Modify: `frontend/src/components/ui/app-card.tsx`

**Interfaces:**
- Produces: `Card({ title?, eyebrow?: ReactNode, actions?, children })` — quando `eyebrow` é
  passado, renderiza um label mono-caps (`font-mono text-[11px] uppercase tracking-widest
  text-signal`) acima do `title`, dentro do mesmo `CardHeader`.

- [ ] **Step 1: Modificar `app-card.tsx`**

Substituir o arquivo inteiro por:

```tsx
import type { ReactNode } from 'react'
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from './card'

interface CardProps {
  title?: string
  eyebrow?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function Card({ title, eyebrow, actions, children }: CardProps) {
  return (
    <ShadcnCard className="mb-6">
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            {eyebrow && (
              <p className="mb-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-signal">
                {eyebrow}
              </p>
            )}
            {title && <CardTitle className="font-display text-lg">{title}</CardTitle>}
          </div>
          {actions}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </ShadcnCard>
  )
}
```

(Único acréscimo real: o prop `eyebrow` e o `<div>` que agora envolve `title` — quando `eyebrow` é
`undefined`, o `<div>` só contém o `CardTitle`, sem nenhuma mudança visual em relação a hoje.)

- [ ] **Step 2: Build + regressão completa**

Run: `cd frontend && npm run build && npx playwright test`
Expected: build exit 0; suíte completa passando (todos os 20+ consumidores de `Card` — nenhum
passa `eyebrow` ainda, então nenhum deve mudar visualmente).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/app-card.tsx
git commit -m "feat: adiciona prop eyebrow opcional ao Card"
```

---

### Task 2: Identidade visual no `DashboardPage`

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `Card`'s novo prop `eyebrow` (Task 1); utility CSS `grid-blueprint` (já existe em
  `frontend/src/app.css:131`).

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FolderKanban, PauseCircle, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, Card, EmptyState, ErrorRetry, PageHeader, Progress, Spinner } from '../components/ui'
import { AtividadeRdoChart } from '../features/dashboard/AtividadeRdoChart'
import { StatusDonutChart } from '../features/dashboard/StatusDonutChart'
import { useDashboard } from '../features/dashboard/dashboardApi'
import { execucaoCorClasse, formatExecucao } from '../lib/format'

interface TileResumoProps {
  label: string
  valor: string | number
  icon: ReactNode
}

function TileResumo({ label, valor, icon }: TileResumoProps) {
  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-1 text-3xl font-bold text-ink">{valor}</p>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard()

  return (
    <main aria-label="Dashboard">
      <div className="relative overflow-hidden rounded-lg">
        <div className="grid-blueprint absolute inset-0 opacity-10" aria-hidden="true" />
        <div className="relative">
          <PageHeader title="Dashboard" breadcrumbs={[{ label: 'Dashboard' }]} />
        </div>
      </div>

      {isLoading && <Spinner label="Carregando dashboard…" />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar o dashboard." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumo">
            <TileResumo
              label="Projetos ativos"
              valor={data.projetos_ativos}
              icon={<FolderKanban className="text-primary" size={18} aria-hidden="true" />}
            />
            <TileResumo
              label="Pausados"
              valor={data.projetos_pausados}
              icon={<PauseCircle className="text-amber-500" size={18} aria-hidden="true" />}
            />
            <TileResumo
              label="Concluídos"
              valor={data.projetos_concluidos}
              icon={<CheckCircle2 className="text-slate-500" size={18} aria-hidden="true" />}
            />
            <TileResumo
              label="Execução média"
              valor={formatExecucao(data.execucao_media)}
              icon={<TrendingUp className="text-emerald-500" size={18} aria-hidden="true" />}
            />
          </div>

          <Card
            title="RDOs por dia"
            eyebrow={
              <>
                <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
                Últimos 7 dias
              </>
            }
          >
            <AtividadeRdoChart dados={data.atividade_rdo} />
          </Card>

          {data.projetos_ativos + data.projetos_pausados + data.projetos_concluidos > 0 && (
            <Card title="Distribuição de status" eyebrow="Projetos">
              <StatusDonutChart
                ativos={data.projetos_ativos}
                pausados={data.projetos_pausados}
                concluidos={data.projetos_concluidos}
              />
            </Card>
          )}

          {data.alertas.length > 0 && (
            <Card title="Alertas de RDO">
              <ul aria-label="Alertas de RDO atrasado" className="flex flex-col gap-3">
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
              </ul>
            </Card>
          )}

          {data.projetos.length === 0 ? (
            <EmptyState>
              Nenhum projeto ativo ainda.{' '}
              <Link to="/projetos" className="font-medium text-primary hover:underline">
                Crie um projeto para começar.
              </Link>
            </EmptyState>
          ) : (
            <Card title="Projetos ativos">
              <ul aria-label="Lista de projetos ativos" className="flex flex-col gap-3">
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
              </ul>
            </Card>
          )}
        </>
      )}
    </main>
  )
}
```

(Mudanças em relação ao arquivo atual: `TileResumo` novo componente local substituindo as 4
`<Card title="..."><div className="flex items-center gap-2">...` por `<TileResumo .../>`;
`PageHeader` envolvido pelo wrapper com `grid-blueprint`; os 2 `Card`s de gráfico ganham `eyebrow`.
As seções de Alertas e Projetos ativos ficam byte-a-byte idênticas — fora de escopo por decisão do
design doc.)

- [ ] **Step 2: Rodar o build e a suíte de dashboard**

Run: `cd frontend && npm run build && npx playwright test tests/e2e/dashboard.spec.ts`
Expected: build exit 0; 4/4 testes passando (os testes já existentes checam texto como
`40.00%`/`—`/`9 dias sem RDO` — continuam batendo, a estrutura do DOM muda mas o texto visível
não).

- [ ] **Step 3: Rodar a suíte completa (regressão)**

Run: `cd frontend && npx playwright test`
Expected: todos os specs passando — nenhuma outra página usa `TileResumo` ou é afetada por essa
mudança (escopo é só `DashboardPage.tsx`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: aplica identidade visual (mono-caps, blueprint, acento signal) no Dashboard"
```

---

### Task 3: Verificação final

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

**Frontend — Piloto de identidade visual no Dashboard (2026-07-21)**: `Card` ganha prop opcional
`eyebrow` (label mono-caps acima do título, aditivo — zero mudança pros 20+ consumidores
existentes). `DashboardPage` ganha tratamento visual reaproveitado da `LoginPage`/`Sidebar`: tiles
de resumo viram caixas com borda tracejada + label mono-caps (mesmo padrão da seção "facts" do
mockup do login), eyebrows mono-caps nos cards de gráfico, textura `grid-blueprint` sutil
(opacidade 10%) atrás do cabeçalho da página, acento `signal` no eyebrow do gráfico "RDOs por dia".
Puramente apresentação — nenhuma mudança de dado ou lógica. Piloto: se a direção validar, estende
pras outras telas autenticadas (Calendário, Configurações, Projetos, Wizard de RDO) numa iniciativa
separada.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra piloto de identidade visual do Dashboard em tasks.md"
```
