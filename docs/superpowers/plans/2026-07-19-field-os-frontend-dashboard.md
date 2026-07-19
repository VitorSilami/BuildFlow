# Field OS Frontend — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Dashboard page that consumes the backend's `GET /api/v1/dashboard/` endpoint
(shipped in `docs/superpowers/plans/2026-07-18-field-os-backend.md`), make it the post-login
landing page, and restructure the Sidebar/Topbar navigation around it — the first of several
frontend sub-plans for the "Field OS" redesign (Projetos redesign, RDO wizard, Configurações tabs
are separate, later plans — see `docs/superpowers/specs/2026-07-18-field-os-dashboard-design.md`).

**Architecture:** A new `DashboardPage` following this codebase's existing page/hook/type
conventions (TanStack Query hook in `features/<domain>/`, plain `interface` types in `types/`,
composites from `components/ui` — no new composites needed, `Card`/`Badge`/`EmptyState`/
`ErrorRetry`/`PageHeader`/`Spinner` already cover everything this page needs). The Sidebar gains a
"OPERAÇÃO" group label with Dashboard promoted above it as a standalone first item. The Topbar
gains a client-side project search that reuses the existing `useProjetos()` query cache (no new
network endpoint) and renders a small results dropdown.

**Tech Stack:** React 19 + TypeScript, Vite, TanStack Query, React Router 7, Tailwind CSS v4 +
shadcn/ui, lucide-react icons. Testing: this frontend has zero Vitest unit tests today — all
behavior is verified through Playwright E2E (`frontend/tests/e2e/*.spec.ts`), mocking the
`_allauth` session and REST endpoints via `page.route(...)`. This plan follows that same
established convention (no unit tests to write; E2E is the test layer).

## Global Constraints

- Follow existing patterns exactly: hooks live in `features/<domain>/<domain>Api.ts` and call
  `apiClient.get<T>(path)`/`.post`; page components import composites from `../components/ui`
  (the barrel), never straight from `../components/ui/<primitive>.tsx` except where a primitive
  isn't re-exported yet (e.g. `Sheet*` is imported from `../components/ui/sheet` directly, matching
  `Topbar.tsx`'s existing import).
- `execucao_percentual` and `execucao_media` are `string | null` end-to-end — render `null` as
  `"—"`, never `"0%"` or blank.
- Do not touch `ProjetoForm.tsx`, `ProjetosListPage.tsx`'s card contents, `RdoPage.tsx`, or
  `ConfiguracaoPage.tsx` — those belong to separate, later plans.
- `npm run build` (runs `tsc -b` then `vite build`), `npm run lint` (oxlint), and
  `npm run test:e2e` (Playwright) must all pass cleanly after every task.
- Changing the post-login redirect target (`/projetos` → `/dashboard`) necessarily requires
  updating the existing assertion in `frontend/tests/e2e/login.spec.ts:76` in the same task that
  makes the change — do not leave that test red between tasks.

---

### Task 1: Tipos e hook de API do dashboard

**Files:**
- Create: `frontend/src/types/dashboard.ts`
- Create: `frontend/src/features/dashboard/dashboardApi.ts`

**Interfaces:**
- Produces: `DashboardResponse`, `DashboardProjeto`, `DashboardAlerta` (types), and `useDashboard()`
  (TanStack Query hook) — Task 2 imports both from these exact paths.

- [ ] **Step 1: Create the response types**

Create `frontend/src/types/dashboard.ts`:
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

export interface DashboardResponse {
  projetos_ativos: number
  projetos_pausados: number
  projetos_concluidos: number
  execucao_media: string | null
  projetos: DashboardProjeto[]
  alertas: DashboardAlerta[]
}
```
This matches the backend's `DashboardView` response shape exactly (`backend/buildflow/projetos/views.py`, `DashboardView.get`).

- [ ] **Step 2: Create the query hook**

Create `frontend/src/features/dashboard/dashboardApi.ts`:
```typescript
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { DashboardResponse } from '../../types/dashboard'

const DASHBOARD_PATH = '/api/v1/dashboard/'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardResponse>(DASHBOARD_PATH),
  })
}
```
This mirrors `frontend/src/features/projetos/projetosApi.ts`'s `useProjetos()` exactly (same
`apiClient.get<T>` call shape, same query-hook pattern).

- [ ] **Step 3: Verify the build**

```bash
cd frontend
npm run build
```
Expected: exits 0. (No runtime behavior to test yet — this task only adds types and an unused-until-Task-2
hook; `tsc -b` catching any type error is the only applicable check here.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/dashboard.ts frontend/src/features/dashboard/dashboardApi.ts
git commit -m "feat: adiciona tipos e hook de API do dashboard"
```

---

### Task 2: Página do Dashboard, rota e redirecionamento pós-login

**Files:**
- Create: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/routes/ProtectedRoute.tsx`
- Modify: `frontend/tests/e2e/login.spec.ts`

**Interfaces:**
- Consumes: `useDashboard()`, `DashboardResponse` (Task 1); `Card`, `Badge`, `EmptyState`,
  `ErrorRetry`, `PageHeader`, `Spinner` (existing `components/ui` barrel).
- Produces: `DashboardPage` component, `/dashboard` route, `/dashboard` as the new default landing
  route for authenticated users (both the root `/` redirect and `PublicOnlyRoute`'s
  already-authenticated redirect).

- [ ] **Step 1: Create `DashboardPage`**

Create `frontend/src/pages/DashboardPage.tsx`:
```tsx
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, ErrorRetry, PageHeader, Spinner } from '../components/ui'
import { useDashboard } from '../features/dashboard/dashboardApi'

function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard()

  return (
    <main aria-label="Dashboard">
      <PageHeader title="Dashboard" breadcrumbs={[{ label: 'Dashboard' }]} />

      {isLoading && <Spinner label="Carregando dashboard…" />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar o dashboard." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumo">
            <Card title="Projetos ativos">
              <p className="text-3xl font-bold text-ink">{data.projetos_ativos}</p>
            </Card>
            <Card title="Pausados">
              <p className="text-3xl font-bold text-ink">{data.projetos_pausados}</p>
            </Card>
            <Card title="Concluídos">
              <p className="text-3xl font-bold text-ink">{data.projetos_concluidos}</p>
            </Card>
            <Card title="Execução média">
              <p className="text-3xl font-bold text-ink">{formatExecucao(data.execucao_media)}</p>
            </Card>
          </div>

          {data.alertas.length > 0 && (
            <Card title="Alertas de RDO">
              <ul aria-label="Alertas de RDO atrasado" className="flex flex-col gap-3">
                {data.alertas.map((alerta) => (
                  <li key={alerta.projeto_id} className="flex items-center justify-between">
                    <Link
                      to={`/projetos/${alerta.projeto_id}/registros-diarios/novo`}
                      className="font-medium text-primary hover:underline"
                    >
                      {alerta.projeto_nome}
                    </Link>
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
                  <li key={projeto.id} className="flex items-center justify-between">
                    <Link
                      to={`/projetos/${projeto.id}/registros-diarios`}
                      className="font-medium text-primary hover:underline"
                    >
                      {projeto.nome}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {formatExecucao(projeto.execucao_percentual)}
                    </span>
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

- [ ] **Step 2: Wire the route and change the post-login destination**

The current `frontend/src/App.tsx` reads:
```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ConfiguracaoPage } from './pages/ConfiguracaoPage'
import { LoginPage } from './pages/LoginPage'
import { ProjetosListPage } from './pages/ProjetosListPage'
import { RdoPage } from './pages/RdoPage'
import { RegistroDiarioDetailPage } from './pages/RegistroDiarioDetailPage'
import { RegistrosDiariosListPage } from './pages/RegistrosDiariosListPage'
import { ProtectedRoute, PublicOnlyRoute } from './routes/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/projetos" element={<ProjetosListPage />} />
              <Route path="/projetos/:projetoId/registros-diarios" element={<RegistrosDiariosListPage />} />
              <Route path="/projetos/:projetoId/registros-diarios/novo" element={<RdoPage />} />
              <Route
                path="/projetos/:projetoId/registros-diarios/:registroId"
                element={<RegistroDiarioDetailPage />}
              />
              <Route path="/projetos/:projetoId/configuracoes" element={<ConfiguracaoPage />} />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/projetos" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

Change it to:
```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ConfiguracaoPage } from './pages/ConfiguracaoPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { ProjetosListPage } from './pages/ProjetosListPage'
import { RdoPage } from './pages/RdoPage'
import { RegistroDiarioDetailPage } from './pages/RegistroDiarioDetailPage'
import { RegistrosDiariosListPage } from './pages/RegistrosDiariosListPage'
import { ProtectedRoute, PublicOnlyRoute } from './routes/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projetos" element={<ProjetosListPage />} />
              <Route path="/projetos/:projetoId/registros-diarios" element={<RegistrosDiariosListPage />} />
              <Route path="/projetos/:projetoId/registros-diarios/novo" element={<RdoPage />} />
              <Route
                path="/projetos/:projetoId/registros-diarios/:registroId"
                element={<RegistroDiarioDetailPage />}
              />
              <Route path="/projetos/:projetoId/configuracoes" element={<ConfiguracaoPage />} />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
```

- [ ] **Step 3: Update `PublicOnlyRoute`'s already-authenticated redirect**

The current `frontend/src/routes/ProtectedRoute.tsx` reads:
```tsx
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div role="status">Carregando…</div>
  }

  if (user) {
    return <Navigate to="/projetos" replace />
  }

  return <>{children}</>
}
```
Change the redirect target:
```tsx
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div role="status">Carregando…</div>
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
```
(`ProtectedRoute` itself needs no change — it only renders `<Outlet />` on success, it doesn't
redirect anywhere itself.)

- [ ] **Step 4: Update the existing login E2E assertion**

In `frontend/tests/e2e/login.spec.ts`, the test `'login com Google bem-sucedido redireciona para /projetos'`
currently asserts:
```typescript
  await expect(page).toHaveURL(/\/projetos$/)
})
```
at the end of that test (line 76). Change the test name and assertion together:
```typescript
test('login com Google bem-sucedido redireciona para /dashboard', async ({ page }) => {
```
(rename from `'... redireciona para /projetos'`) and:
```typescript
  await expect(page).toHaveURL(/\/dashboard$/)
})
```
This test doesn't mock the `/api/v1/dashboard/` endpoint, so `DashboardPage` will render its
`isError` branch (`ErrorRetry`) after the redirect — that's fine, the test only asserts the URL,
not the page content. Do not add a dashboard mock to this test; it belongs to `login.spec.ts`'s
scope (login flow), not dashboard content (covered in Task 5's `dashboard.spec.ts`).

The other two tests in this file (`'usuário não autenticado é redirecionado para /login'` and
`'login recusado...'`) don't reference `/projetos` and need no change.

- [ ] **Step 5: Run the build and the login E2E spec**

```bash
cd frontend
npm run build
npx playwright test tests/e2e/login.spec.ts
```
Expected: build exits 0; all 3 tests in `login.spec.ts` pass (including the renamed/updated one).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/App.tsx frontend/src/routes/ProtectedRoute.tsx frontend/tests/e2e/login.spec.ts
git commit -m "feat: adiciona pagina de dashboard e torna /dashboard o destino pos-login"
```

---

### Task 3: Sidebar com grupo "OPERAÇÃO" e subtítulo "Field OS"

**Files:**
- Modify: `frontend/src/layouts/Sidebar.tsx`
- Modify: `frontend/src/layouts/Topbar.tsx`

**Interfaces:**
- Consumes: nothing new (uses existing `NavLink`, `lucide-react` icons already imported in
  `Sidebar.tsx`, plus the `LayoutDashboard` icon which needs adding to the existing import).
- Produces: no new exports — `SidebarNav` and `Sidebar`'s public shape (props, named exports)
  stay identical, only their rendered content changes.

- [ ] **Step 1: Add the Dashboard nav item and "OPERAÇÃO" group label**

The current `frontend/src/layouts/Sidebar.tsx` reads:
```tsx
import { FileText, LayoutGrid, Settings } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface hover:text-ink'
  }`

export function SidebarNav() {
  const { projetoId } = useParams<{ projetoId?: string }>()

  return (
    <nav className="flex flex-col gap-1 p-3">
      <p className="px-3 pb-2 pt-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Navegação
      </p>
      <NavLink to="/projetos" className={navItemClass}>
        <LayoutGrid size={18} aria-hidden="true" />
        Projetos
      </NavLink>
      {projetoId && (
        <>
          <NavLink to={`/projetos/${projetoId}/registros-diarios`} className={navItemClass}>
            <FileText size={18} aria-hidden="true" />
            Registros diários
          </NavLink>
          <NavLink to={`/projetos/${projetoId}/configuracoes`} className={navItemClass}>
            <Settings size={18} aria-hidden="true" />
            Configurações
          </NavLink>
        </>
      )}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-border px-4">
        <span className="font-display text-lg font-bold tracking-tight text-ink">
          Build<span className="text-signal">Flow</span>
        </span>
      </div>
      <SidebarNav />
    </aside>
  )
}
```

Change it to:
```tsx
import { FileText, LayoutDashboard, LayoutGrid, Settings } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface hover:text-ink'
  }`

export function SidebarNav() {
  const { projetoId } = useParams<{ projetoId?: string }>()

  return (
    <nav className="flex flex-col gap-1 p-3">
      <NavLink to="/dashboard" className={navItemClass}>
        <LayoutDashboard size={18} aria-hidden="true" />
        Dashboard
      </NavLink>
      <p className="px-3 pb-2 pt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Operação
      </p>
      <NavLink to="/projetos" className={navItemClass}>
        <LayoutGrid size={18} aria-hidden="true" />
        Projetos
      </NavLink>
      {projetoId && (
        <>
          <NavLink to={`/projetos/${projetoId}/registros-diarios`} className={navItemClass}>
            <FileText size={18} aria-hidden="true" />
            Registros diários
          </NavLink>
          <NavLink to={`/projetos/${projetoId}/configuracoes`} className={navItemClass}>
            <Settings size={18} aria-hidden="true" />
            Configurações
          </NavLink>
        </>
      )}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
      <div className="flex h-16 flex-col justify-center border-b border-border px-4">
        <span className="font-display text-lg font-bold tracking-tight text-ink">
          Build<span className="text-signal">Flow</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Field OS
        </span>
      </div>
      <SidebarNav />
    </aside>
  )
}
```

- [ ] **Step 2: Mirror the "Field OS" subtitle in the mobile Sheet header**

`frontend/src/layouts/Topbar.tsx` renders its own copy of the BuildFlow brand mark inside the
mobile navigation `Sheet` (a separate element from `Sidebar.tsx`'s, since the desktop sidebar is
`hidden` below the `lg` breakpoint). The current block reads:
```tsx
          <SheetHeader className="h-16 justify-center border-b border-border px-4">
            <SheetTitle className="text-left font-display text-lg font-bold tracking-tight text-ink">
              Build<span className="text-signal">Flow</span>
            </SheetTitle>
          </SheetHeader>
```
Add the same subtitle span used in `Sidebar.tsx` (`SheetHeader` already defaults to
`flex flex-col`, per `frontend/src/components/ui/sheet.tsx`, so no extra layout class is needed):
```tsx
          <SheetHeader className="h-16 justify-center border-b border-border px-4">
            <SheetTitle className="text-left font-display text-lg font-bold tracking-tight text-ink">
              Build<span className="text-signal">Flow</span>
            </SheetTitle>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Field OS
            </span>
          </SheetHeader>
```

- [ ] **Step 3: Run the build and the full E2E suite**

```bash
cd frontend
npm run build
npx playwright test
```
Expected: build exits 0. All existing E2E specs still pass — this is a structural nav change, so
watch specifically for any test that navigates via the sidebar/mobile menu (none currently do by
inspection, but confirm via the full run rather than assuming).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/layouts/Sidebar.tsx frontend/src/layouts/Topbar.tsx
git commit -m "feat: adiciona Dashboard e grupo Operacao na sidebar, subtitulo Field OS na marca"
```

---

### Task 4: Busca de projetos no Topbar (client-side)

**Files:**
- Modify: `frontend/src/layouts/Topbar.tsx`

**Interfaces:**
- Consumes: `useProjetos()` (`frontend/src/features/projetos/projetosApi.ts`, existing, unchanged
  — TanStack Query dedupes the cache by `queryKey: ['projetos']`, so this doesn't add a redundant
  network request when `ProjetosListPage` has already fetched it in the same session).
- Produces: no new exports — purely additive UI inside `Topbar`.

- [ ] **Step 1: Add the search input and results dropdown**

The current `frontend/src/layouts/Topbar.tsx` (after Task 3's edit) reads:
```tsx
import { LogOut, Menu, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { useTheme } from '../features/theme/ThemeContext'
import { Button } from '../components/ui'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { SidebarNav } from './Sidebar'

export function Topbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir navegação"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </Button>
        <span className="text-sm font-medium text-ink">
          {user?.empresa_nome} — {user?.nome} ({user?.perfil})
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Alternar tema claro/escuro" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void logout()}>
          <LogOut size={16} aria-hidden="true" />
          Sair
        </Button>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="h-16 justify-center border-b border-border px-4">
            <SheetTitle className="text-left font-display text-lg font-bold tracking-tight text-ink">
              Build<span className="text-signal">Flow</span>
            </SheetTitle>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Field OS
            </span>
          </SheetHeader>
          <SidebarNav />
        </SheetContent>
      </Sheet>
    </header>
  )
}
```

Change it to:
```tsx
import { LogOut, Menu, Moon, Search, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { useTheme } from '../features/theme/ThemeContext'
import { useProjetos } from '../features/projetos/projetosApi'
import { Button, Input } from '../components/ui'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { SidebarNav } from './Sidebar'

const MAX_RESULTADOS_BUSCA = 5

export function Topbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')
  const buscaRef = useRef<HTMLDivElement>(null)
  const projetos = useProjetos()

  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (buscaRef.current && !buscaRef.current.contains(event.target as Node)) {
        setTermoBusca('')
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  const resultadosBusca = termoBusca
    ? (projetos.data?.results ?? [])
        .filter((projeto) => projeto.nome.toLowerCase().includes(termoBusca.toLowerCase()))
        .slice(0, MAX_RESULTADOS_BUSCA)
    : []

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir navegação"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </Button>
        <span className="text-sm font-medium text-ink">
          {user?.empresa_nome} — {user?.nome} ({user?.perfil})
        </span>
      </div>

      <div ref={buscaRef} className="relative hidden max-w-xs flex-1 md:block">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={termoBusca}
          onChange={(event) => setTermoBusca(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setTermoBusca('')
          }}
          placeholder="Buscar projeto…"
          aria-label="Buscar projeto"
          className="pl-9"
        />
        {termoBusca && (
          <ul
            aria-label="Resultados da busca"
            className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background py-1 shadow-md"
          >
            {resultadosBusca.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum projeto encontrado.</li>
            ) : (
              resultadosBusca.map((projeto) => (
                <li key={projeto.id}>
                  <Link
                    to={`/projetos/${projeto.id}/registros-diarios`}
                    className="block px-3 py-2 text-sm hover:bg-surface"
                    onClick={() => setTermoBusca('')}
                  >
                    {projeto.nome}
                  </Link>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Alternar tema claro/escuro" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void logout()}>
          <LogOut size={16} aria-hidden="true" />
          Sair
        </Button>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="h-16 justify-center border-b border-border px-4">
            <SheetTitle className="text-left font-display text-lg font-bold tracking-tight text-ink">
              Build<span className="text-signal">Flow</span>
            </SheetTitle>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Field OS
            </span>
          </SheetHeader>
          <SidebarNav />
        </SheetContent>
      </Sheet>
    </header>
  )
}
```

Note: `Input`'s `type="search"` plus the `pl-9` padding-left class (to make room for the `Search`
icon) both work through the existing `Input` component's `className` merge (`cn(...)` via
`tailwind-merge`) — no changes to `frontend/src/components/ui/input.tsx` are needed.

- [ ] **Step 2: Run the build**

```bash
cd frontend
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/layouts/Topbar.tsx
git commit -m "feat: adiciona busca client-side de projetos no Topbar"
```

---

### Task 5: Teste E2E do dashboard e verificação final

**Files:**
- Create: `frontend/tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: the whole feature built in Tasks 1-4 (route, page, nav, search).

- [ ] **Step 1: Write the E2E spec**

Create `frontend/tests/e2e/dashboard.spec.ts`, following the exact mocking pattern already used in
`frontend/tests/e2e/projetos.spec.ts` (mock `_allauth` session + mock the REST endpoint via
`page.route`):
```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const DASHBOARD_URL = '**/api/v1/dashboard/*'
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

test('dashboard mostra resumo, projetos ativos e alertas', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(DASHBOARD_URL, (route) =>
    route.fulfill({
      json: {
        projetos_ativos: 1,
        projetos_pausados: 0,
        projetos_concluidos: 0,
        execucao_media: '40.00',
        projetos: [
          { id: 'projeto-1', nome: 'Duplicação BR-365', status: 'ativo', execucao_percentual: '40.00' },
        ],
        alertas: [{ projeto_id: 'projeto-1', projeto_nome: 'Duplicação BR-365', dias_sem_rdo: 9 }],
      },
    }),
  )

  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('40.00%').first()).toBeVisible()
  await expect(page.getByText('9 dias sem RDO')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Duplicação BR-365' }).first()).toBeVisible()
})

test('dashboard sem projetos ativos mostra estado vazio', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(DASHBOARD_URL, (route) =>
    route.fulfill({
      json: {
        projetos_ativos: 0,
        projetos_pausados: 0,
        projetos_concluidos: 0,
        execucao_media: null,
        projetos: [],
        alertas: [],
      },
    }),
  )

  await page.goto('/dashboard')

  await expect(page.getByText('Nenhum projeto ativo ainda.')).toBeVisible()
  // exact: true evita colisao com o em-dash que tambem aparece no texto do
  // Topbar ("Empresa A — Gerente Empresa A (gerente)").
  await expect(page.getByText('—', { exact: true })).toBeVisible()
})

test('busca no Topbar filtra projetos e navega ao clicar', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(DASHBOARD_URL, (route) =>
    route.fulfill({
      json: {
        projetos_ativos: 0,
        projetos_pausados: 0,
        projetos_concluidos: 0,
        execucao_media: null,
        projetos: [],
        alertas: [],
      },
    }),
  )
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 'projeto-1', nome: 'Duplicação BR-365', descricao: '', criado_por: 1 }],
      },
    }),
  )

  await page.goto('/dashboard')
  await page.getByLabel('Buscar projeto').fill('Duplic')

  await expect(page.getByRole('link', { name: 'Duplicação BR-365' })).toBeVisible()
  await page.getByRole('link', { name: 'Duplicação BR-365' }).click()

  await expect(page).toHaveURL(/\/projetos\/projeto-1\/registros-diarios$/)
})
```

- [ ] **Step 2: Run the new spec**

```bash
cd frontend
npx playwright test tests/e2e/dashboard.spec.ts
```
Expected: 3/3 pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/dashboard.spec.ts
git commit -m "test: adiciona e2e do dashboard e da busca no topbar"
```

- [ ] **Step 4: Full verification**

```bash
cd frontend
npm run build
npm run lint
npm run test
npx playwright test
```
Expected: build exits 0, lint exits 0, `npm run test` reports 0 tests (established convention for
this frontend — no Vitest unit tests exist), and the full Playwright suite passes (all specs in
`tests/e2e/`, including the 3 new dashboard tests and the updated `login.spec.ts`).

- [ ] **Step 5: Update `specs/001-mvp-gestao-diaria/tasks.md`**

Append an entry documenting this frontend work, following the same convention as the backend
entry added in the previous plan:
```markdown

**Frontend do "Field OS" — Dashboard (2026-07-19)**: nova `DashboardPage` consumindo
`GET /api/v1/dashboard/` (contagens por status, execução média, projetos ativos, alertas de RDO
atrasado). `/dashboard` vira o destino pós-login (era `/projetos`). Sidebar ganha o Dashboard como
primeiro item, agrupamento "Operação" para os itens existentes, e subtítulo "Field OS" na marca.
Topbar ganha busca client-side de projetos (reaproveitando o cache de `useProjetos()`, sem
endpoint novo). Próximos passos do redesign "Field OS" (Projetos, RDO wizard, Configurações) ficam
em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra frontend do dashboard Field OS em tasks.md"
```
