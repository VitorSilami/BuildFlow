# Field OS Frontend — Projetos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Projetos frontend (create form + list) to expose the 4 fields shipped in the
backend plan (`numero_contrato`, `trecho`, `engenheiro_responsavel`, `status`) plus the computed
`execucao_percentual`, and add a status filter to the project list — the second of several
frontend sub-plans for the "Field OS" redesign (Dashboard already shipped; RDO wizard and
Configurações remain as separate, later plans — see
`docs/superpowers/specs/2026-07-18-field-os-dashboard-design.md`).

**Architecture:** `ProjetoForm` gains 4 new optional fields (matching the backend's optional
schema exactly — the name-only create flow must keep working). `ProjetosListPage`'s cards are
redesigned to surface the new fields plus a status `Badge`, and gain a client-side status filter
using the `Tabs` primitive (already vendored at `components/ui/tabs.tsx` but not yet re-exported
from the barrel — this plan is its first consumer). Filtering is client-side over the
already-fully-fetched `useProjetos()` list, matching the existing convention (no pagination, no
server-side filtering elsewhere in this app). A small `formatExecucao` helper — currently defined
inline inside `DashboardPage.tsx` — is extracted to a shared `lib/format.ts` so both pages share
one implementation instead of duplicating it.

**Tech Stack:** React 19 + TypeScript, Vite, TanStack Query, Zod, Tailwind CSS v4 + shadcn/ui
(Radix `Tabs`). Testing: zero Vitest unit tests (established convention) — Playwright E2E is the
test layer, following the exact `page.route(...)` mocking pattern already used in
`frontend/tests/e2e/projetos.spec.ts`.

## Global Constraints

- The 4 new fields are all optional on create — the existing "name-only" create flow (used by the
  current `projetos.spec.ts` tests) must keep working unchanged.
- `execucao_percentual` is `string | null` — render `null` as `"—"`, never `"0%"` or blank (same
  rule as the Dashboard plan, now shared via `formatExecucao`).
- Status filtering is 100% client-side (no new backend endpoint, no query params) — the backend's
  `GET /api/v1/projetos/` response is unchanged and already returns every field this plan needs
  (shipped in `docs/superpowers/plans/2026-07-18-field-os-backend.md`).
- Do not touch `RdoPage.tsx` or `ConfiguracaoPage.tsx` — those belong to separate, later plans.
- There is currently no `PATCH`/`PUT` endpoint for `Projeto` (`ProjetoViewSet` only supports
  List/Create/Retrieve) — this plan does not add project editing. A project's `status` can only be
  set at creation time through this UI; changing it later is out of scope (existing gap, not
  introduced or fixed here).
- `npm run build`, `npm run lint` (oxlint), and `npm run test:e2e` (Playwright) must all pass
  cleanly after every task.

---

### Task 1: Tipos, schema Zod e util de formatação compartilhada

**Files:**
- Modify: `frontend/src/types/projeto.ts`
- Modify: `frontend/src/schemas/projeto.ts`
- Create: `frontend/src/lib/format.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Produces: `ProjetoStatus` type, extended `Projeto` interface (4 new fields +
  `execucao_percentual`), extended `projetoFormSchema`/`ProjetoFormValues`, and
  `formatExecucao(valor: string | null): string` — Task 2 and Task 3 import all of these.

- [ ] **Step 1: Extend the `Projeto` type**

The current `frontend/src/types/projeto.ts` reads:
```typescript
export interface Projeto {
  id: string
  nome: string
  descricao: string
  criado_por: number
  created_at: string
  updated_at: string
}

export interface ProjetoListResponse {
  count: number
  next: string | null
  previous: string | null
  results: Projeto[]
}
```

Change it to:
```typescript
export type ProjetoStatus = 'ativo' | 'pausado' | 'concluido'

export interface Projeto {
  id: string
  nome: string
  descricao: string
  numero_contrato: string
  trecho: string
  engenheiro_responsavel: string
  status: ProjetoStatus
  execucao_percentual: string | null
  criado_por: number
  created_at: string
  updated_at: string
}

export interface ProjetoListResponse {
  count: number
  next: string | null
  previous: string | null
  results: Projeto[]
}
```

- [ ] **Step 2: Extend the create-form Zod schema**

The current `frontend/src/schemas/projeto.ts` reads:
```typescript
import { z } from 'zod'

export const projetoFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'O nome do projeto é obrigatório.'),
  descricao: z.string().optional(),
})

export type ProjetoFormValues = z.infer<typeof projetoFormSchema>
```

Change it to:
```typescript
import { z } from 'zod'

export const projetoFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'O nome do projeto é obrigatório.'),
  descricao: z.string().optional(),
  numero_contrato: z.string().optional(),
  trecho: z.string().optional(),
  engenheiro_responsavel: z.string().optional(),
  status: z.enum(['ativo', 'pausado', 'concluido']).optional(),
})

export type ProjetoFormValues = z.infer<typeof projetoFormSchema>
```

- [ ] **Step 3: Extract the shared `formatExecucao` helper**

Create `frontend/src/lib/format.ts`:
```typescript
export function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}
```

In `frontend/src/pages/DashboardPage.tsx`, remove the existing local definition:
```typescript
function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}
```
and import it from the new shared location instead. The current top of the file reads:
```tsx
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, ErrorRetry, PageHeader, Spinner } from '../components/ui'
import { useDashboard } from '../features/dashboard/dashboardApi'

function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}

export function DashboardPage() {
```
Change it to:
```tsx
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, ErrorRetry, PageHeader, Spinner } from '../components/ui'
import { useDashboard } from '../features/dashboard/dashboardApi'
import { formatExecucao } from '../lib/format'

export function DashboardPage() {
```
The rest of `DashboardPage.tsx` (both call sites of `formatExecucao`) is unchanged — this is a
pure extraction, no behavior change.

- [ ] **Step 4: Verify the build**

```bash
cd frontend
npm run build
```
Expected: exits 0.

- [ ] **Step 5: Run the full E2E suite**

```bash
cd frontend
npx playwright test
```
Expected: all 13 existing tests still pass (this step only changed types/a pure extraction, but
`DashboardPage.tsx` was touched, so confirm `dashboard.spec.ts`'s 3 tests specifically still pass
along with everything else).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/projeto.ts frontend/src/schemas/projeto.ts frontend/src/lib/format.ts frontend/src/pages/DashboardPage.tsx
git commit -m "feat: adiciona campos novos aos tipos de Projeto e extrai formatExecucao compartilhado"
```

---

### Task 2: Campos novos no formulário de criação

**Files:**
- Modify: `frontend/src/features/projetos/ProjetoForm.tsx`

**Interfaces:**
- Consumes: `ProjetoStatus` (Task 1), extended `projetoFormSchema`/`ProjetoFormValues` (Task 1),
  `SelectField` (existing `components/ui` barrel export).
- Produces: no new exports — `ProjetoForm`'s public props (`ProjetoFormProps`) stay identical.

- [ ] **Step 1: Add the 4 new fields to the form**

The current `frontend/src/features/projetos/ProjetoForm.tsx` reads:
```tsx
import { useState, type FormEvent } from 'react'
import { Alert, Button, FormField, Input, Textarea } from '../../components/ui'
import { projetoFormSchema } from '../../schemas/projeto'
import { useCriarProjeto } from './projetosApi'

interface ProjetoFormProps {
  onCreated: () => void
}

export function ProjetoForm({ onCreated }: ProjetoFormProps) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [nomeError, setNomeError] = useState<string | null>(null)
  const criarProjeto = useCriarProjeto()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNomeError(null)

    const result = projetoFormSchema.safeParse({ nome, descricao })
    if (!result.success) {
      setNomeError(result.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    criarProjeto.mutate(result.data, {
      onSuccess: () => {
        setNome('')
        setDescricao('')
        onCreated()
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Criar novo projeto">
      <FormField id="projeto-nome" label="Nome do projeto" error={nomeError}>
        <Input
          id="projeto-nome"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          aria-invalid={nomeError ? 'true' : undefined}
          aria-describedby={nomeError ? 'projeto-nome-erro' : undefined}
        />
      </FormField>

      <FormField id="projeto-descricao" label="Breve descrição">
        <Textarea id="projeto-descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} />
      </FormField>

      {criarProjeto.isError && <Alert>Não foi possível criar o projeto. Tente novamente.</Alert>}

      <Button type="submit" disabled={criarProjeto.isPending}>
        {criarProjeto.isPending ? 'Criando…' : 'Criar projeto'}
      </Button>
    </form>
  )
}
```

Change it to:
```tsx
import { useState, type FormEvent } from 'react'
import { Alert, Button, FormField, Input, SelectField, Textarea } from '../../components/ui'
import { projetoFormSchema } from '../../schemas/projeto'
import type { ProjetoStatus } from '../../types/projeto'
import { useCriarProjeto } from './projetosApi'

interface ProjetoFormProps {
  onCreated: () => void
}

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'concluido', label: 'Concluído' },
]

export function ProjetoForm({ onCreated }: ProjetoFormProps) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [numeroContrato, setNumeroContrato] = useState('')
  const [trecho, setTrecho] = useState('')
  const [engenheiroResponsavel, setEngenheiroResponsavel] = useState('')
  const [status, setStatus] = useState<ProjetoStatus>('ativo')
  const [nomeError, setNomeError] = useState<string | null>(null)
  const criarProjeto = useCriarProjeto()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNomeError(null)

    const result = projetoFormSchema.safeParse({
      nome,
      descricao,
      numero_contrato: numeroContrato,
      trecho,
      engenheiro_responsavel: engenheiroResponsavel,
      status,
    })
    if (!result.success) {
      setNomeError(result.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    criarProjeto.mutate(result.data, {
      onSuccess: () => {
        setNome('')
        setDescricao('')
        setNumeroContrato('')
        setTrecho('')
        setEngenheiroResponsavel('')
        setStatus('ativo')
        onCreated()
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Criar novo projeto">
      <FormField id="projeto-nome" label="Nome do projeto" error={nomeError}>
        <Input
          id="projeto-nome"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          aria-invalid={nomeError ? 'true' : undefined}
          aria-describedby={nomeError ? 'projeto-nome-erro' : undefined}
        />
      </FormField>

      <FormField id="projeto-descricao" label="Breve descrição">
        <Textarea id="projeto-descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} />
      </FormField>

      <FormField id="projeto-numero-contrato" label="Número do contrato">
        <Input
          id="projeto-numero-contrato"
          value={numeroContrato}
          onChange={(event) => setNumeroContrato(event.target.value)}
        />
      </FormField>

      <FormField id="projeto-trecho" label="Trecho">
        <Input id="projeto-trecho" value={trecho} onChange={(event) => setTrecho(event.target.value)} />
      </FormField>

      <FormField id="projeto-engenheiro-responsavel" label="Engenheiro responsável">
        <Input
          id="projeto-engenheiro-responsavel"
          value={engenheiroResponsavel}
          onChange={(event) => setEngenheiroResponsavel(event.target.value)}
        />
      </FormField>

      <SelectField
        id="projeto-status"
        label="Status"
        value={status}
        onChange={(value) => setStatus(value as ProjetoStatus)}
        options={STATUS_OPTIONS}
      />

      {criarProjeto.isError && <Alert>Não foi possível criar o projeto. Tente novamente.</Alert>}

      <Button type="submit" disabled={criarProjeto.isPending}>
        {criarProjeto.isPending ? 'Criando…' : 'Criar projeto'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Run the build and the existing Projetos E2E spec**

```bash
cd frontend
npm run build
npx playwright test tests/e2e/projetos.spec.ts
```
Expected: build exits 0. Both existing tests in `projetos.spec.ts` still pass — they only fill
"Nome do projeto" and submit, and the 4 new fields are all optional with sensible defaults
(`status` defaults to `'ativo'`, matching the backend default), so the name-only flow is
unaffected. (`projetos.spec.ts` itself is updated in Task 3, which also touches the list
rendering that consumes the new response fields — this step only confirms Task 2 doesn't break
the *existing* spec as it stands today.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/projetos/ProjetoForm.tsx
git commit -m "feat: adiciona numero_contrato, trecho, engenheiro_responsavel e status ao formulario de projeto"
```

---

### Task 3: Cards redesenhados com filtro por status

**Files:**
- Modify: `frontend/src/components/ui/index.ts`
- Modify: `frontend/src/pages/ProjetosListPage.tsx`
- Modify: `frontend/tests/e2e/projetos.spec.ts`

**Interfaces:**
- Consumes: `formatExecucao` (Task 1), extended `Projeto` type (Task 1), `Tabs`/`TabsList`/
  `TabsTrigger` (vendored at `components/ui/tabs.tsx`, not yet re-exported — this task adds the
  barrel export), `Badge` (existing barrel export).
- Produces: no new exports — `ProjetosListPage`'s shape is unchanged, only its rendered content
  and the barrel's export list change.

- [ ] **Step 1: Add `Tabs` to the composites barrel**

The current `frontend/src/components/ui/index.ts` reads:
```typescript
export { Alert } from './app-alert'
export { Spinner } from './app-spinner'
export { Card } from './app-card'
export { PageHeader } from './page-header'
export { FormField } from './form-field'
export { SelectField } from './select-field'
export { EmptyState } from './empty-state'
export { ErrorRetry } from './error-retry'
export { Badge } from './badge'
export { Button } from './button'
export { Input } from './input'
export { Label } from './label'
export { Textarea } from './textarea'
```
Add one line:
```typescript
export { Alert } from './app-alert'
export { Spinner } from './app-spinner'
export { Card } from './app-card'
export { PageHeader } from './page-header'
export { FormField } from './form-field'
export { SelectField } from './select-field'
export { EmptyState } from './empty-state'
export { ErrorRetry } from './error-retry'
export { Badge } from './badge'
export { Button } from './button'
export { Input } from './input'
export { Label } from './label'
export { Textarea } from './textarea'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
```
(`TabsContent` is re-exported for completeness/future use even though this task's usage is a
controlled segmented-button-bar with no `TabsContent` panels — the filtering is done in plain
JS/JSX below the `Tabs`, not via Radix's content-switching, since all statuses share one grid of
cards rather than 4 separate panels of different content.)

- [ ] **Step 2: Redesign the cards and add the status filter**

The current `frontend/src/pages/ProjetosListPage.tsx` reads:
```tsx
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorRetry, PageHeader, Spinner } from '../components/ui'
import { ProjetoForm } from '../features/projetos/ProjetoForm'
import { useProjetos } from '../features/projetos/projetosApi'

export function ProjetosListPage() {
  const { data, isLoading, isError, refetch } = useProjetos()
  const [showForm, setShowForm] = useState(false)

  return (
    <main aria-label="Projetos">
      <PageHeader
        title="Projetos"
        breadcrumbs={[{ label: 'Projetos' }]}
        actions={
          <Button className="gap-2" onClick={() => setShowForm((current) => !current)}>
            <Plus size={16} aria-hidden="true" />
            {showForm ? 'Cancelar' : 'Novo Projeto'}
          </Button>
        }
      />

      {showForm && (
        <Card title="Criar novo projeto">
          <ProjetoForm onCreated={() => setShowForm(false)} />
        </Card>
      )}

      {isLoading && <Spinner label="Carregando projetos…" />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar os projetos." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <EmptyState>Nenhum projeto ainda. Crie o primeiro projeto para começar.</EmptyState>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Lista de projetos">
          {data.results.map((projeto) => (
            <Card title={projeto.nome} key={projeto.id}>
              {projeto.descricao && <p className="mb-3 text-sm text-muted-foreground">{projeto.descricao}</p>}
              <div className="flex gap-4 text-sm">
                <Link to={`/projetos/${projeto.id}/registros-diarios`} className="font-medium text-primary hover:underline">
                  Registros diários
                </Link>
                <Link to={`/projetos/${projeto.id}/configuracoes`} className="font-medium text-primary hover:underline">
                  Configurações
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
```

Change it to:
```tsx
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, ErrorRetry, PageHeader, Spinner, Tabs, TabsList, TabsTrigger } from '../components/ui'
import { ProjetoForm } from '../features/projetos/ProjetoForm'
import { useProjetos } from '../features/projetos/projetosApi'
import { formatExecucao } from '../lib/format'
import type { ProjetoStatus } from '../types/projeto'

type FiltroStatus = 'todos' | ProjetoStatus

const STATUS_LABEL: Record<ProjetoStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

const STATUS_BADGE_VARIANT: Record<ProjetoStatus, 'default' | 'secondary' | 'outline'> = {
  ativo: 'default',
  pausado: 'secondary',
  concluido: 'outline',
}

export function ProjetosListPage() {
  const { data, isLoading, isError, refetch } = useProjetos()
  const [showForm, setShowForm] = useState(false)
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')

  const projetosFiltrados =
    data?.results.filter((projeto) => filtro === 'todos' || projeto.status === filtro) ?? []

  return (
    <main aria-label="Projetos">
      <PageHeader
        title="Projetos"
        breadcrumbs={[{ label: 'Projetos' }]}
        actions={
          <Button className="gap-2" onClick={() => setShowForm((current) => !current)}>
            <Plus size={16} aria-hidden="true" />
            {showForm ? 'Cancelar' : 'Novo Projeto'}
          </Button>
        }
      />

      {showForm && (
        <Card title="Criar novo projeto">
          <ProjetoForm onCreated={() => setShowForm(false)} />
        </Card>
      )}

      {isLoading && <Spinner label="Carregando projetos…" />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar os projetos." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <EmptyState>Nenhum projeto ainda. Crie o primeiro projeto para começar.</EmptyState>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <>
          <Tabs value={filtro} onValueChange={(value) => setFiltro(value as FiltroStatus)} className="mb-6">
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="ativo">Ativos</TabsTrigger>
              <TabsTrigger value="pausado">Pausados</TabsTrigger>
              <TabsTrigger value="concluido">Concluídos</TabsTrigger>
            </TabsList>
          </Tabs>

          {projetosFiltrados.length === 0 ? (
            <EmptyState>Nenhum projeto neste status.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Lista de projetos">
              {projetosFiltrados.map((projeto) => (
                <Card
                  key={projeto.id}
                  title={projeto.nome}
                  actions={
                    <Badge variant={STATUS_BADGE_VARIANT[projeto.status]}>
                      {STATUS_LABEL[projeto.status]}
                    </Badge>
                  }
                >
                  {projeto.descricao && <p className="mb-3 text-sm text-muted-foreground">{projeto.descricao}</p>}
                  <dl className="mb-3 flex flex-col gap-1 text-sm">
                    {projeto.numero_contrato && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Contrato</dt>
                        <dd className="font-medium text-ink">{projeto.numero_contrato}</dd>
                      </div>
                    )}
                    {projeto.trecho && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Trecho</dt>
                        <dd className="font-medium text-ink">{projeto.trecho}</dd>
                      </div>
                    )}
                    {projeto.engenheiro_responsavel && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Engenheiro</dt>
                        <dd className="font-medium text-ink">{projeto.engenheiro_responsavel}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Execução</dt>
                      <dd className="font-medium text-ink">{formatExecucao(projeto.execucao_percentual)}</dd>
                    </div>
                  </dl>
                  <div className="flex gap-4 text-sm">
                    <Link to={`/projetos/${projeto.id}/registros-diarios`} className="font-medium text-primary hover:underline">
                      Registros diários
                    </Link>
                    <Link to={`/projetos/${projeto.id}/configuracoes`} className="font-medium text-primary hover:underline">
                      Configurações
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Update the existing E2E mocks with the new fields**

The current `frontend/tests/e2e/projetos.spec.ts` reads:
```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const PROJETOS_URL = '**/api/v1/projetos/*'

const USUARIO_EMPRESA_A = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

async function mockAuthenticated(page: import('@playwright/test').Page) {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({
      json: { status: 200, data: { user: USUARIO_EMPRESA_A }, meta: { is_authenticated: true } },
    }),
  )
}

test('lista vazia mostra estado vazio e permite criar o primeiro projeto', async ({ page }) => {
  await mockAuthenticated(page)

  let projetoCriado = false
  await page.route(PROJETOS_URL, (route) => {
    if (route.request().method() === 'POST') {
      projetoCriado = true
      return route.fulfill({
        status: 201,
        json: { id: 'novo-projeto', nome: 'Duplicação BR-365', descricao: '', criado_por: 1 },
      })
    }
    const results = projetoCriado
      ? [{ id: 'novo-projeto', nome: 'Duplicação BR-365', descricao: '', criado_por: 1 }]
      : []
    return route.fulfill({ json: { count: results.length, next: null, previous: null, results } })
  })

  await page.goto('/projetos')

  await expect(page.getByText('Nenhum projeto ainda')).toBeVisible()

  await page.getByRole('button', { name: 'Novo Projeto' }).click()
  await page.getByLabel('Nome do projeto').fill('Duplicação BR-365')
  await page.getByRole('button', { name: 'Criar projeto' }).click()

  await expect(page.getByText('Duplicação BR-365')).toBeVisible()
})

test('nome vazio é rejeitado com erro próximo ao campo', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }),
  )

  await page.goto('/projetos')
  await page.getByRole('button', { name: 'Novo Projeto' }).click()
  await page.getByRole('button', { name: 'Criar projeto' }).click()

  await expect(page.getByRole('alert')).toContainText('obrigatório')
})
```

Change the first test's mock objects to include the new fields (matching the real backend's
response shape), and add a new third test for the status filter:
```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const PROJETOS_URL = '**/api/v1/projetos/*'

const USUARIO_EMPRESA_A = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

async function mockAuthenticated(page: import('@playwright/test').Page) {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({
      json: { status: 200, data: { user: USUARIO_EMPRESA_A }, meta: { is_authenticated: true } },
    }),
  )
}

test('lista vazia mostra estado vazio e permite criar o primeiro projeto', async ({ page }) => {
  await mockAuthenticated(page)

  let projetoCriado = false
  await page.route(PROJETOS_URL, (route) => {
    if (route.request().method() === 'POST') {
      projetoCriado = true
      return route.fulfill({
        status: 201,
        json: {
          id: 'novo-projeto',
          nome: 'Duplicação BR-365',
          descricao: '',
          numero_contrato: '',
          trecho: '',
          engenheiro_responsavel: '',
          status: 'ativo',
          execucao_percentual: null,
          criado_por: 1,
        },
      })
    }
    const results = projetoCriado
      ? [
          {
            id: 'novo-projeto',
            nome: 'Duplicação BR-365',
            descricao: '',
            numero_contrato: '',
            trecho: '',
            engenheiro_responsavel: '',
            status: 'ativo',
            execucao_percentual: null,
            criado_por: 1,
          },
        ]
      : []
    return route.fulfill({ json: { count: results.length, next: null, previous: null, results } })
  })

  await page.goto('/projetos')

  await expect(page.getByText('Nenhum projeto ainda')).toBeVisible()

  await page.getByRole('button', { name: 'Novo Projeto' }).click()
  await page.getByLabel('Nome do projeto').fill('Duplicação BR-365')
  await page.getByRole('button', { name: 'Criar projeto' }).click()

  await expect(page.getByText('Duplicação BR-365')).toBeVisible()
})

test('nome vazio é rejeitado com erro próximo ao campo', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }),
  )

  await page.goto('/projetos')
  await page.getByRole('button', { name: 'Novo Projeto' }).click()
  await page.getByRole('button', { name: 'Criar projeto' }).click()

  await expect(page.getByRole('alert')).toContainText('obrigatório')
})

test('filtro por status mostra apenas projetos do status selecionado', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 'projeto-ativo',
            nome: 'Duplicação BR-365',
            descricao: '',
            numero_contrato: '',
            trecho: '',
            engenheiro_responsavel: '',
            status: 'ativo',
            execucao_percentual: null,
            criado_por: 1,
          },
          {
            id: 'projeto-pausado',
            nome: 'Contorno BR-101',
            descricao: '',
            numero_contrato: '',
            trecho: '',
            engenheiro_responsavel: '',
            status: 'pausado',
            execucao_percentual: null,
            criado_por: 1,
          },
        ],
      },
    }),
  )

  await page.goto('/projetos')

  await expect(page.getByText('Duplicação BR-365')).toBeVisible()
  await expect(page.getByText('Contorno BR-101')).toBeVisible()

  await page.getByRole('tab', { name: 'Pausados' }).click()

  await expect(page.getByText('Contorno BR-101')).toBeVisible()
  await expect(page.getByText('Duplicação BR-365')).not.toBeVisible()
})
```

- [ ] **Step 4: Run the Projetos E2E spec**

```bash
cd frontend
npx playwright test tests/e2e/projetos.spec.ts
```
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/index.ts frontend/src/pages/ProjetosListPage.tsx frontend/tests/e2e/projetos.spec.ts
git commit -m "feat: redesenha cards de projetos com status/contrato/trecho/engenheiro/execucao e filtro por status"
```

---

### Task 4: Verificação final

**Files:** none expected beyond possible small fixes found during verification.

- [ ] **Step 1: Suíte completa**

```bash
cd frontend
npm run build
npm run lint
npm run test
npx playwright test
```
Expected: build exits 0, lint exits 0 (only the pre-existing fast-refresh warnings, no new
errors), `npm run test` reports 0 tests (established convention), and the full Playwright suite
passes (all specs, including the 3 Projetos tests and everything from the Dashboard plan).

- [ ] **Step 2: Update `specs/001-mvp-gestao-diaria/tasks.md`**

Append an entry documenting this frontend work, following the same convention as the previous two
entries:
```markdown

**Frontend do "Field OS" — Projetos (2026-07-19)**: `ProjetoForm` ganha `numero_contrato`,
`trecho`, `engenheiro_responsavel` e `status` (todos opcionais, `status` default "Ativo").
`ProjetosListPage` reescrita: cards mostram status (badge), contrato, trecho, engenheiro e
execução (`formatExecucao`, extraído para `lib/format.ts` e compartilhado com `DashboardPage`),
com um filtro por status (Todos/Ativos/Pausados/Concluídos) client-side sobre a lista já
carregada. Sem endpoint novo — não há ainda edição de projeto (`ProjetoViewSet` só suporta
list/create/retrieve), então o status só pode ser definido na criação. Próximos passos do
redesign "Field OS" (RDO wizard, Configurações) ficam em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra frontend de projetos do Field OS em tasks.md"
```
