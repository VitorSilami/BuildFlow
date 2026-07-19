# Field OS Frontend — Edição de Projetos e Redesign de Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consume the backend's new `PATCH` endpoint and `ultimo_rdo_data` field
(`docs/superpowers/plans/2026-07-19-field-os-backend-edicao.md`) to add real project editing and a
redesigned card layout (icons, colored status badges, a progress bar, in-page text search) — the
frontend half of `docs/superpowers/specs/2026-07-19-field-os-projetos-edicao-design.md`.

**Architecture:** `ProjetoForm` is generalized to drive both create and edit (one form, one set of
fields, a mode switch based on whether a `projeto` prop is passed). Both flows open in a `Dialog`
modal instead of the current inline expand-in-place card. `ProjetosListPage`'s cards are
redesigned with icons (trecho/engenheiro/último RDO), colored status badges (the existing `Badge`
variants are generic — this needs custom color classes), and a real `Progress` bar for execução.
An in-page text search (nome/trecho/engenheiro) is layered on top of the existing status tabs,
filtering the same already-fetched list client-side. Sidebar/Topbar get `sticky` positioning.

**Tech Stack:** React 19 + TypeScript, Vite, TanStack Query, Zod, Tailwind CSS v4 + shadcn/ui
(`Dialog` and `Progress` — both vendored, neither consumed anywhere yet). Testing: zero Vitest unit
tests (established convention) — Playwright E2E is the test layer.

## Global Constraints

- `Dialog` and `Progress` are the first consumers in this codebase — both already exist at
  `components/ui/dialog.tsx`/`components/ui/progress.tsx` but aren't in the barrel yet.
- `execucao_percentual` and the new `ultimo_rdo_data` are both `string | null` — render `null` as
  `"—"`/`"Nunca registrado"` respectively, never a fabricated value. The `Progress` bar itself must
  not render at all when `execucao_percentual` is `null` (a 0%-looking bar would misrepresent "no
  data" as "zero executed").
- `ProjetoForm`'s public prop contract changes (`onCreated` → `onSuccess`, new optional `projeto`
  prop) — it has exactly one call site (`ProjetosListPage`), so this is a safe, single-PR rename.
- Status filtering AND the new text search are both 100% client-side over the already-fetched
  `useProjetos()` list — no new backend endpoint, no query params.
- `npm run build`, `npm run lint` (oxlint), and `npm run test:e2e` (Playwright) must all pass
  cleanly after every task.
- Do not touch `RdoPage.tsx` or `ConfiguracaoPage.tsx` — out of scope for this plan.
- **Playwright glob gotcha, read before touching `projetos.spec.ts`:** the file's existing
  `PROJETOS_URL = '**/api/v1/projetos/*'` constant has a single-`*` wildcard, which does **not**
  match across `/` characters — it matches the bare list endpoint (`/api/v1/projetos/`, where `*`
  matches zero characters) but will **not** match an item-detail URL with a trailing slash after
  the ID (e.g. `/api/v1/projetos/projeto-1/`, needed for the new `PATCH` test). Task 3 changes this
  constant to `'**/api/v1/projetos/**'` (double-star, matches across `/`) — confirmed this is a
  superset match that doesn't break any existing test's routing.

---

### Task 1: Tipos, hook de atualização, helper de data e barrel (Dialog, Progress)

**Files:**
- Modify: `frontend/src/types/projeto.ts`
- Modify: `frontend/src/features/projetos/projetosApi.ts`
- Modify: `frontend/src/lib/format.ts`
- Modify: `frontend/src/components/ui/index.ts`

**Interfaces:**
- Produces: `Projeto.ultimo_rdo_data: string | null`, `useAtualizarProjeto(projetoId: string)`
  (PATCH mutation hook), `formatData(iso: string | null): string` — Task 2 and Task 3 import all
  of these. `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogTrigger`/`DialogFooter`/
  `DialogDescription`/`DialogClose` and `Progress` become available from the `components/ui`
  barrel — Task 3 imports `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, and `Progress`.

- [ ] **Step 1: Add `ultimo_rdo_data` to the `Projeto` type**

The current `frontend/src/types/projeto.ts` reads:
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
  ultimo_rdo_data: string | null
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

- [ ] **Step 2: Add the update mutation hook**

The current `frontend/src/features/projetos/projetosApi.ts` reads:
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { ProjetoFormValues } from '../../schemas/projeto'
import type { Projeto, ProjetoListResponse } from '../../types/projeto'

const PROJETOS_PATH = '/api/v1/projetos/'

export function useProjetos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<ProjetoListResponse>(PROJETOS_PATH),
    enabled: options?.enabled ?? true,
  })
}

export function useCriarProjeto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProjetoFormValues) => apiClient.post<Projeto>(PROJETOS_PATH, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projetos'] })
    },
  })
}
```
Add a new hook at the end:
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { ProjetoFormValues } from '../../schemas/projeto'
import type { Projeto, ProjetoListResponse } from '../../types/projeto'

const PROJETOS_PATH = '/api/v1/projetos/'

export function useProjetos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<ProjetoListResponse>(PROJETOS_PATH),
    enabled: options?.enabled ?? true,
  })
}

export function useCriarProjeto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProjetoFormValues) => apiClient.post<Projeto>(PROJETOS_PATH, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projetos'] })
    },
  })
}

export function useAtualizarProjeto(projetoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProjetoFormValues) =>
      apiClient.patch<Projeto>(`${PROJETOS_PATH}${projetoId}/`, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projetos'] })
    },
  })
}
```

- [ ] **Step 3: Add the date-formatting helper**

The current `frontend/src/lib/format.ts` reads:
```typescript
export function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}
```
Add a new function:
```typescript
export function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}

export function formatData(iso: string | null): string {
  if (iso === null) return 'Nunca registrado'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}
```
(Manual string split rather than `new Date(iso)` — parsing a date-only ISO string with `Date` and
then formatting it can shift the displayed day by one depending on the browser's local timezone,
since `new Date('2026-07-10')` is interpreted as UTC midnight. A plain split avoids that entirely
for this `YYYY-MM-DD` input, which is exactly what `date.isoformat()` produces on the backend.)

- [ ] **Step 4: Add `Dialog` and `Progress` to the composites barrel**

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
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'
```
Add two lines:
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
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from './dialog'
export { Progress } from './progress'
```

- [ ] **Step 5: Verify the build**

```bash
cd frontend
npm run build
```
Expected: exits 0. (No behavior to test yet — this task only adds types, an unused-until-later
hook/helper, and barrel exports; `tsc -b` catching a type error is the only applicable check.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/projeto.ts frontend/src/features/projetos/projetosApi.ts frontend/src/lib/format.ts frontend/src/components/ui/index.ts
git commit -m "feat: adiciona ultimo_rdo_data, hook de atualizacao e Dialog/Progress ao barrel"
```

---

### Task 2: Generalizar `ProjetoForm` para criar e editar

**Files:**
- Modify: `frontend/src/features/projetos/ProjetoForm.tsx`
- Modify: `frontend/src/pages/ProjetosListPage.tsx` (one line only — see Step 2)

**Interfaces:**
- Consumes: `useAtualizarProjeto` (Task 1), `Projeto` type (Task 1's `ultimo_rdo_data` addition
  doesn't affect this file directly, but the type it imports now carries the field).
- Produces: `ProjetoForm` now accepts `{ projeto?: Projeto; onSuccess: () => void }` (renamed from
  `{ onCreated: () => void }`). Task 3 rewrites `ProjetosListPage.tsx` entirely (including the
  modal wiring), but this task keeps the build green in the meantime by updating that file's one
  call site to the new prop name — every task's commit must leave the app in a working, tested
  state, not just the plan's final state.

- [ ] **Step 1: Add edit-mode support**

The current `frontend/src/features/projetos/ProjetoForm.tsx` reads:
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

Change it to:
```tsx
import { useState, type FormEvent } from 'react'
import { Alert, Button, FormField, Input, SelectField, Textarea } from '../../components/ui'
import { projetoFormSchema } from '../../schemas/projeto'
import type { Projeto, ProjetoStatus } from '../../types/projeto'
import { useAtualizarProjeto, useCriarProjeto } from './projetosApi'

interface ProjetoFormProps {
  projeto?: Projeto
  onSuccess: () => void
}

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'concluido', label: 'Concluído' },
]

export function ProjetoForm({ projeto, onSuccess }: ProjetoFormProps) {
  const [nome, setNome] = useState(projeto?.nome ?? '')
  const [descricao, setDescricao] = useState(projeto?.descricao ?? '')
  const [numeroContrato, setNumeroContrato] = useState(projeto?.numero_contrato ?? '')
  const [trecho, setTrecho] = useState(projeto?.trecho ?? '')
  const [engenheiroResponsavel, setEngenheiroResponsavel] = useState(
    projeto?.engenheiro_responsavel ?? '',
  )
  const [status, setStatus] = useState<ProjetoStatus>(projeto?.status ?? 'ativo')
  const [nomeError, setNomeError] = useState<string | null>(null)
  const criarProjeto = useCriarProjeto()
  const atualizarProjeto = useAtualizarProjeto(projeto?.id ?? '')
  const mutation = projeto ? atualizarProjeto : criarProjeto

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

    mutation.mutate(result.data, {
      onSuccess: () => {
        if (!projeto) {
          setNome('')
          setDescricao('')
          setNumeroContrato('')
          setTrecho('')
          setEngenheiroResponsavel('')
          setStatus('ativo')
        }
        onSuccess()
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} aria-label={projeto ? 'Editar projeto' : 'Criar novo projeto'}>
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

      {mutation.isError && (
        <Alert>
          {projeto
            ? 'Não foi possível salvar as alterações. Tente novamente.'
            : 'Não foi possível criar o projeto. Tente novamente.'}
        </Alert>
      )}

      <Button type="submit" disabled={mutation.isPending}>
        {projeto
          ? mutation.isPending
            ? 'Salvando…'
            : 'Salvar alterações'
          : mutation.isPending
            ? 'Criando…'
            : 'Criar projeto'}
      </Button>
    </form>
  )
}
```
(`useAtualizarProjeto(projeto?.id ?? '')` is called unconditionally — required by the Rules of
Hooks — but its `mutate` is only ever invoked when `mutation === atualizarProjeto`, i.e. only when
`projeto` is defined, so the empty-string fallback ID is never actually used in a request.)

- [ ] **Step 2: Update `ProjetosListPage.tsx`'s call site to match**

`frontend/src/pages/ProjetosListPage.tsx` currently has exactly one line that constructs
`ProjetoForm`:
```tsx
        <ProjetoForm onCreated={() => setShowForm(false)} />
```
Change only this one line (nothing else in the file — Task 3 rewrites the rest of this file,
including this line again, as part of the modal/redesign):
```tsx
        <ProjetoForm onSuccess={() => setShowForm(false)} />
```

- [ ] **Step 3: Verify the build and existing E2E spec**

```bash
cd frontend
npm run build
npx playwright test tests/e2e/projetos.spec.ts
```
Expected: build exits 0. All 4 existing tests in `projetos.spec.ts` still pass (this task changes
no rendered behavior — `projeto` is always `undefined` at this call site until Task 3, so
`ProjetoForm` still only ever runs in create mode here).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/projetos/ProjetoForm.tsx frontend/src/pages/ProjetosListPage.tsx
git commit -m "feat: generaliza ProjetoForm para suportar edicao alem de criacao"
```

---

### Task 3: Modal de criação/edição, redesign dos cards e busca em texto

**Files:**
- Modify: `frontend/src/pages/ProjetosListPage.tsx`
- Modify: `frontend/tests/e2e/projetos.spec.ts`

**Interfaces:**
- Consumes: `ProjetoForm` (Task 2, new `projeto`/`onSuccess` prop contract), `formatData`,
  `formatExecucao` (Task 1), `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`Progress`
  (Task 1's barrel additions).
- Produces: no new exports — `ProjetosListPage`'s shape is unchanged, only its rendered content.

- [ ] **Step 1: Rewrite `ProjetosListPage.tsx`**

The current `frontend/src/pages/ProjetosListPage.tsx` reads:
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
            <TabsList aria-label="Filtrar por status">
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

Change it to:
```tsx
import { Calendar, MapPin, Pencil, Plus, Search, Settings, User } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorRetry,
  Input,
  PageHeader,
  Progress,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../components/ui'
import { ProjetoForm } from '../features/projetos/ProjetoForm'
import { useProjetos } from '../features/projetos/projetosApi'
import { formatData, formatExecucao } from '../lib/format'
import type { Projeto, ProjetoStatus } from '../types/projeto'

type FiltroStatus = 'todos' | ProjetoStatus
type ModalState = 'fechado' | 'criar' | Projeto

const STATUS_LABEL: Record<ProjetoStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

// hover:bg-*/15 (identico ao estado normal) neutraliza o hover:bg-primary/80 do
// variant "default" do Badge — sem isso, passar o mouse faria o badge colorido
// piscar de volta para a cor primaria no hover, ja que tailwind-merge so agrupa
// conflitos entre classes com o mesmo prefixo de variante (hover: vs sem hover:
// nao sao o mesmo grupo, entao a classe do variant nao seria sobrescrita).
const STATUS_BADGE_CLASS: Record<ProjetoStatus, string> = {
  ativo:
    'border-transparent bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
  pausado:
    'border-transparent bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20',
  concluido:
    'border-transparent bg-slate-500/15 text-slate-700 hover:bg-slate-500/15 dark:bg-slate-500/20 dark:text-slate-400 dark:hover:bg-slate-500/20',
}

export function ProjetosListPage() {
  const { data, isLoading, isError, refetch } = useProjetos()
  const [modal, setModal] = useState<ModalState>('fechado')
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const [busca, setBusca] = useState('')

  const projetosFiltrados =
    data?.results.filter((projeto) => {
      const combinaStatus = filtro === 'todos' || projeto.status === filtro
      const termo = busca.trim().toLowerCase()
      const combinaBusca =
        termo === '' ||
        projeto.nome.toLowerCase().includes(termo) ||
        projeto.trecho.toLowerCase().includes(termo) ||
        projeto.engenheiro_responsavel.toLowerCase().includes(termo)
      return combinaStatus && combinaBusca
    }) ?? []

  return (
    <main aria-label="Projetos">
      <PageHeader
        title="Projetos"
        breadcrumbs={[{ label: 'Projetos' }]}
        actions={
          <Button className="gap-2" onClick={() => setModal('criar')}>
            <Plus size={16} aria-hidden="true" />
            Novo Projeto
          </Button>
        }
      />

      {isLoading && <Spinner label="Carregando projetos…" />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar os projetos." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <EmptyState>Nenhum projeto ainda. Crie o primeiro projeto para começar.</EmptyState>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Tabs value={filtro} onValueChange={(value) => setFiltro(value as FiltroStatus)}>
              <TabsList aria-label="Filtrar por status">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="ativo">Ativos</TabsTrigger>
                <TabsTrigger value="pausado">Pausados</TabsTrigger>
                <TabsTrigger value="concluido">Concluídos</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative max-w-sm">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por nome, trecho ou engenheiro…"
                aria-label="Buscar projetos"
                className="pl-9"
              />
            </div>
          </div>

          {projetosFiltrados.length === 0 ? (
            <EmptyState>Nenhum projeto encontrado.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Lista de projetos">
              {projetosFiltrados.map((projeto) => (
                <Card
                  key={projeto.id}
                  title={projeto.nome}
                  actions={
                    <div className="flex items-center gap-2">
                      {projeto.numero_contrato && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {projeto.numero_contrato}
                        </span>
                      )}
                      <Badge className={STATUS_BADGE_CLASS[projeto.status]}>
                        {STATUS_LABEL[projeto.status]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${projeto.nome}`}
                        onClick={() => setModal(projeto)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  }
                >
                  {projeto.descricao && <p className="mb-3 text-sm text-muted-foreground">{projeto.descricao}</p>}

                  <div className="mb-4 flex flex-col gap-2 text-sm">
                    {projeto.trecho && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin size={14} aria-hidden="true" />
                        <span>{projeto.trecho}</span>
                      </div>
                    )}
                    {projeto.engenheiro_responsavel && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User size={14} aria-hidden="true" />
                        <span>{projeto.engenheiro_responsavel}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar size={14} aria-hidden="true" />
                      <span>Último RDO: {formatData(projeto.ultimo_rdo_data)}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Execução</span>
                      <span className="font-medium text-ink">{formatExecucao(projeto.execucao_percentual)}</span>
                    </div>
                    {projeto.execucao_percentual !== null && (
                      <Progress value={Number(projeto.execucao_percentual)} className="h-2" />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild className="flex-1">
                      <Link to={`/projetos/${projeto.id}/registros-diarios`}>Entrar</Link>
                    </Button>
                    <Button asChild variant="outline" size="icon" aria-label={`Configurações de ${projeto.nome}`}>
                      <Link to={`/projetos/${projeto.id}/configuracoes`}>
                        <Settings size={16} aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={modal !== 'fechado'} onOpenChange={(open) => !open && setModal('fechado')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal === 'criar' ? 'Criar novo projeto' : 'Editar projeto'}</DialogTitle>
          </DialogHeader>
          <ProjetoForm
            projeto={modal === 'criar' || modal === 'fechado' ? undefined : modal}
            onSuccess={() => setModal('fechado')}
          />
        </DialogContent>
      </Dialog>
    </main>
  )
}
```

- [ ] **Step 2: Update `projetos.spec.ts`**

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

test('filtro sem projetos correspondentes mostra mensagem de vazio', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 1,
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
        ],
      },
    }),
  )

  await page.goto('/projetos')

  await expect(page.getByText('Duplicação BR-365')).toBeVisible()

  await page.getByRole('tab', { name: 'Concluídos' }).click()

  await expect(page.getByText('Nenhum projeto neste status.')).toBeVisible()
})
```

Replace the whole file with:
```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
// Double-star: precisa casar tanto com a listagem (/api/v1/projetos/) quanto com
// URLs de item (/api/v1/projetos/{id}/, usadas pelo PATCH de edicao) — um unico
// `*` no final nao casa atraves da barra apos o id.
const PROJETOS_URL = '**/api/v1/projetos/**'

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
          ultimo_rdo_data: null,
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
            ultimo_rdo_data: null,
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
            ultimo_rdo_data: null,
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
            ultimo_rdo_data: null,
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

test('filtro sem projetos correspondentes mostra mensagem de vazio', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 1,
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
            ultimo_rdo_data: null,
            criado_por: 1,
          },
        ],
      },
    }),
  )

  await page.goto('/projetos')

  await expect(page.getByText('Duplicação BR-365')).toBeVisible()

  await page.getByRole('tab', { name: 'Concluídos' }).click()

  await expect(page.getByText('Nenhum projeto encontrado.')).toBeVisible()
})

test('editar projeto abre modal preenchido e salva alterações', async ({ page }) => {
  await mockAuthenticated(page)

  let projetoAtualizado = false
  await page.route(PROJETOS_URL, (route) => {
    if (route.request().method() === 'PATCH') {
      projetoAtualizado = true
      return route.fulfill({
        status: 200,
        json: {
          id: 'projeto-1',
          nome: 'Duplicação BR-365 Renovada',
          descricao: '',
          numero_contrato: '',
          trecho: 'BR-365 · km 10-25',
          engenheiro_responsavel: '',
          status: 'pausado',
          execucao_percentual: null,
          ultimo_rdo_data: null,
          criado_por: 1,
        },
      })
    }
    const nome = projetoAtualizado ? 'Duplicação BR-365 Renovada' : 'Duplicação BR-365'
    const status = projetoAtualizado ? 'pausado' : 'ativo'
    return route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 'projeto-1',
            nome,
            descricao: '',
            numero_contrato: '',
            trecho: 'BR-365 · km 10-25',
            engenheiro_responsavel: '',
            status,
            execucao_percentual: null,
            ultimo_rdo_data: null,
            criado_por: 1,
          },
        ],
      },
    })
  })

  await page.goto('/projetos')
  await expect(page.getByText('Duplicação BR-365', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Editar Duplicação BR-365' }).click()
  await expect(page.getByLabel('Nome do projeto')).toHaveValue('Duplicação BR-365')

  await page.getByLabel('Nome do projeto').fill('Duplicação BR-365 Renovada')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()

  await expect(page.getByText('Duplicação BR-365 Renovada')).toBeVisible()
})

test('busca em texto filtra por nome, trecho ou engenheiro', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 'projeto-1',
            nome: 'Duplicação BR-365',
            descricao: '',
            numero_contrato: '',
            trecho: 'BR-365 · km 10-25',
            engenheiro_responsavel: 'Eng. Carlos Mendes',
            status: 'ativo',
            execucao_percentual: null,
            ultimo_rdo_data: null,
            criado_por: 1,
          },
          {
            id: 'projeto-2',
            nome: 'Contorno BR-101',
            descricao: '',
            numero_contrato: '',
            trecho: 'BR-101 · km 40-55',
            engenheiro_responsavel: 'Eng. Ana Souza',
            status: 'ativo',
            execucao_percentual: null,
            ultimo_rdo_data: null,
            criado_por: 1,
          },
        ],
      },
    }),
  )

  await page.goto('/projetos')
  await expect(page.getByText('Duplicação BR-365', { exact: true })).toBeVisible()
  await expect(page.getByText('Contorno BR-101', { exact: true })).toBeVisible()

  await page.getByLabel('Buscar projetos').fill('Carlos')

  await expect(page.getByText('Duplicação BR-365', { exact: true })).toBeVisible()
  await expect(page.getByText('Contorno BR-101', { exact: true })).not.toBeVisible()
})
```

- [ ] **Step 3: Run the Projetos E2E spec**

```bash
cd frontend
npx playwright test tests/e2e/projetos.spec.ts
```
Expected: 6/6 pass.

- [ ] **Step 4: Run the build**

```bash
cd frontend
npm run build
```
Expected: exits 0 (this also confirms Task 2's `onCreated` → `onSuccess` rename is now fully
consistent, since this is the only call site).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProjetosListPage.tsx frontend/tests/e2e/projetos.spec.ts
git commit -m "feat: adiciona modal de criacao/edicao e redesenha cards de projeto com icones e progress bar"
```

---

### Task 4: Sidebar e Topbar `sticky`

**Files:**
- Modify: `frontend/src/layouts/Sidebar.tsx`
- Modify: `frontend/src/layouts/Topbar.tsx`

**Interfaces:** none — purely additive CSS classes, no prop/behavior changes.

- [ ] **Step 1: Make the Sidebar sticky**

In `frontend/src/layouts/Sidebar.tsx`, the `Sidebar` component's `<aside>` currently reads:
```tsx
    <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
```
Change it to:
```tsx
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
```

- [ ] **Step 2: Make the Topbar sticky**

In `frontend/src/layouts/Topbar.tsx`, the `<header>` currently reads:
```tsx
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4">
```
Change it to:
```tsx
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background px-4">
```

- [ ] **Step 3: Run the build and full E2E suite**

```bash
cd frontend
npm run build
npx playwright test
```
Expected: build exits 0. Every spec still passes — this is a layout-only CSS change with no
structural DOM changes, so no test should be affected, but confirm via the full run.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/layouts/Sidebar.tsx frontend/src/layouts/Topbar.tsx
git commit -m "feat: torna sidebar e topbar sticky ao rolar a pagina"
```

---

### Task 5: Verificação final

**Files:** none expected beyond possible small fixes found during verification.

- [ ] **Step 1: Suíte completa**

```bash
cd frontend
npm run build
npm run lint
npm run test
npx playwright test
```
Expected: build exits 0, lint exits 0 (only pre-existing fast-refresh warnings), `npm run test`
reports 0 tests (established convention), and the full Playwright suite passes.

- [ ] **Step 2: Atualizar `specs/001-mvp-gestao-diaria/tasks.md`**

Append an entry documenting this frontend work:
```markdown

**Frontend do "Field OS" — Edição de Projetos e Redesign de Cards (2026-07-19)**: `ProjetoForm`
generalizado para criar e editar (prop `projeto?`, hook `useAtualizarProjeto` via `PATCH`); criação
e edição agora abrem em modal (`Dialog`, primeiro consumo no codebase) em vez do card inline
anterior. Cards de `ProjetosListPage` redesenhados: ícones em trecho/engenheiro/último RDO (novo
campo `ultimo_rdo_data`), badge de status com cores semânticas reais (verde/âmbar/cinza), barra de
execução via `Progress` (primeiro consumo) — mostrada só quando há dado real, nunca uma barra em 0%
para "sem dado". Nova busca em texto (nome/trecho/engenheiro) somada aos tabs de status já
existentes, tudo client-side sobre a lista já carregada. Sidebar/Topbar ganham `sticky`. Próximos
passos do redesign "Field OS" (RDO wizard, Configurações) ficam em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra edicao de projetos e redesign de cards do Field OS frontend em tasks.md"
```
