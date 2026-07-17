# Frontend Mazer Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frontend's unstyled, layout-less pages with a Bootstrap 5 + Mazer-design-system UI, organized into isolated `layouts/` and `components/ui/` layers, with zero change to business logic, hooks, API calls, or routes.

**Architecture:** Copy Mazer's SCSS/fonts/icons pipeline into `frontend/src/styles` and `frontend/src/assets`, build a small `components/ui/` primitive library and a `layouts/` shell (`DashboardLayout`, `AuthLayout`), then migrate each existing page one at a time to compose those primitives instead of raw HTML — keeping every `useX` hook call, Zod schema, aria-label, button label, and route exactly as-is so the existing Playwright E2E suite keeps passing.

**Tech Stack:** React 19, TypeScript, Vite, `bootstrap@5`, `sass`, `lucide-react`, React Router 7, TanStack Query, Zod (all pre-existing except the three new deps).

## Global Constraints

- Never change hook signatures, API call shapes, Zod schemas, or route paths — only JSX/markup/classNames.
- Every button/link accessible name (visible text) used by `frontend/tests/e2e/*.spec.ts` must remain byte-identical unless the task explicitly says to change it.
- `role="alert"` / `role="status"` / `aria-label` attributes on containers referenced by tests must be preserved.
- After each task: `cd frontend && npm run lint && npx tsc -b --noEmit` must pass before commit. Full `npm run test:e2e` runs at the end of Task 6 (layout wiring) and again as Task 13 (final pass) — running it after every single page task is optional but recommended if time allows.
- Commit messages in Portuguese, imperative, explaining why (per repo convention already used in `tasks.md`).

---

### Task 1: Install dependencies and wire the SCSS build

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/styles/app.scss`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/index.css` (strip the Vite-template `#root` width constraint)

**Interfaces:**
- Produces: `frontend/src/styles/app.scss` — the single stylesheet entry point every later task assumes is already imported by `main.tsx`.

- [ ] **Step 1: Install the three new packages**

Run:
```bash
cd frontend && npm install bootstrap@^5.3.3 bootstrap-icons@^1.11.3 lucide-react@^0.474.0 && npm install -D sass@^1.83.0
```
Expected: `package.json` `dependencies` gains `bootstrap`, `bootstrap-icons`, `lucide-react`; `devDependencies` gains `sass`. (`bootstrap-icons` is installed only to satisfy Mazer's SCSS `@import` chain, which references its font — no `bi-*` class is used in any React component; all icons in JSX come from `lucide-react`.)

- [ ] **Step 2: Create the styles directory and copy Mazer's SCSS**

Run:
```bash
mkdir -p frontend/src/styles
cp -r mazer-main/src/assets/scss/. frontend/src/styles/
rm -rf frontend/src/styles/themes/dark/_mazer-dark.scss.orig 2>/dev/null || true
```
This copies `_variables.scss`, `_fonts.scss`, `_mazer.scss`, `_utilities.scss`, `bootstrap.scss`, `iconly.scss`, `app.scss` (will be overwritten in the next step), `components/`, `layouts/`, `mixins/`, `pages/`, `themes/`, `widgets/` into `frontend/src/styles/`.

- [ ] **Step 3: Remove the Iconly font import (replaced by lucide-react)**

Edit `frontend/src/styles/_mazer.scss`: find the line that imports Iconly (search for `iconly`) and delete it, since no component uses Iconly classes.

Run to find it first:
```bash
grep -n "iconly" frontend/src/styles/_mazer.scss
```
Delete whatever `@import "./iconly";`-style line that search returns.

- [ ] **Step 4: Fix the `@/` alias in `_fonts.scss` to a relative path**

`_fonts.scss` currently references fonts as `url('@/assets/static/fonts/...')`, a webpack alias Vite does not resolve. Replace every `@/assets/static/fonts/` with `../assets/static/fonts/` (this anticipates Task 2, which copies the font files to `frontend/src/assets/static/fonts/`):

```bash
cd frontend/src/styles && sed -i "s#@/assets/static/fonts/#../assets/static/fonts/#g" _fonts.scss && cd -
```

- [ ] **Step 5: Fix background-image paths in `pages/auth.scss` and `pages/flag.scss`**

These reference `../../static/images/...` (correct relative *within the original mazer-main tree*, where scss files live two levels under `assets/`). In the new location (`frontend/src/styles/pages/*.scss`), the images will live at `frontend/src/assets/static/images/...`, i.e. one level up from `styles/`, not two. Fix both files:

```bash
cd frontend/src/styles && sed -i "s#\\.\\./\\.\\./static/#../assets/static/#g" pages/auth.scss pages/flag.scss && cd -
```

- [ ] **Step 6: Replace `frontend/src/styles/app.scss` with the real entry point**

```scss
// Mazer design tokens (colors, spacing, typography overrides for Bootstrap)
@import "./variables";

// Bootstrap + Bootstrap Icons (icon font is required by Mazer's own component
// scss even though the app itself renders icons via lucide-react)
@import "bootstrap/scss/bootstrap";
@import "bootstrap-icons/font/bootstrap-icons";

// Fonts (Nunito, self-hosted, see _fonts.scss)
@import "./fonts";

// Mazer component/page overrides (sidebar, navbar, cards, tables, auth pages, etc.)
@import "./mazer";
```

Note: the original Mazer `app.scss` also imported `perfect-scrollbar/css/perfect-scrollbar.css` — we drop that import since we are not installing `perfect-scrollbar` (Bootstrap's own overflow handling is enough for the sidebar in this app); if a later task finds the sidebar needs custom-scrollbar styling, add `overflow-y: auto` in the `DashboardLayout` CSS instead of pulling in the extra dependency.

- [ ] **Step 7: Replace the Vite template body of `frontend/src/index.css`**

Delete the entire contents of `frontend/src/index.css` (it's unstyled Vite-template boilerplate: a fixed 1126px `#root`, a light/dark palette we don't use, and heading styles that will conflict with Bootstrap's). Replace with:

```css
html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
}
```

- [ ] **Step 8: Import the new stylesheet in `main.tsx`**

In `frontend/src/main.tsx`, change:
```tsx
import './index.css'
```
to:
```tsx
import './index.css'
import './styles/app.scss'
```

- [ ] **Step 9: Verify the build compiles**

Run:
```bash
cd frontend && npm run build
```
Expected: exit code 0, no Sass import errors, no missing-file errors. If Sass complains about a missing partial, re-check Steps 3–5 for a path this task's `grep`/`sed` missed and fix it before moving on — do not skip verification.

- [ ] **Step 10: Commit**

```bash
git add -A frontend/package.json frontend/package-lock.json frontend/src/styles frontend/src/main.tsx frontend/src/index.css
git commit -m "feat: adiciona Bootstrap 5 e SCSS do Mazer como base visual do frontend"
```

(If the repo is not yet a git repository, run `git init` first and confirm with the user before the first commit of this plan — see the design doc's note that `git init` was still pending as of 2026-07-17.)

---

### Task 2: Port Mazer's static assets (fonts, logo, auth background)

**Files:**
- Create: `frontend/src/assets/static/fonts/*` (Nunito woff/woff2 files)
- Create: `frontend/src/assets/static/images/logo/*`
- Create: `frontend/src/assets/static/images/bg/4853433.png`

**Interfaces:**
- Produces: the exact file paths Task 1's `_fonts.scss` and `pages/auth.scss` already reference — this task supplies the files those paths point to.

- [ ] **Step 1: Copy fonts**

```bash
mkdir -p frontend/src/assets/static/fonts
cp mazer-main/src/assets/static/fonts/nunito-*.woff mazer-main/src/assets/static/fonts/nunito-*.woff2 frontend/src/assets/static/fonts/
```

- [ ] **Step 2: Copy logo assets used by the sidebar/auth layouts**

```bash
mkdir -p frontend/src/assets/static/images/logo
cp mazer-main/src/assets/static/images/logo/logo.svg frontend/src/assets/static/images/logo/
cp mazer-main/src/assets/static/images/logo/favicon.svg frontend/src/assets/static/images/logo/ 2>/dev/null || true
```

- [ ] **Step 3: Copy the auth-page background image referenced by `pages/auth.scss`**

```bash
mkdir -p frontend/src/assets/static/images/bg
cp "mazer-main/src/assets/static/images/bg/4853433.png" frontend/src/assets/static/images/bg/
```

- [ ] **Step 4: Rebuild and verify no 404s for fonts/images**

```bash
cd frontend && npm run dev -- --port 5173 &
sleep 3
curl -sf http://localhost:5173/src/assets/static/fonts/nunito-latin-400-normal.woff2 > /dev/null && echo "font OK"
kill %1
```
Expected: prints `font OK`. (If the dev server needs longer to boot, rerun the `curl` line — do not increase the sleep beyond a few seconds in CI.)

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/assets
git commit -m "feat: adiciona fontes e imagens estaticas do design Mazer"
```

---

### Task 3: Dark/light ThemeContext

**Files:**
- Create: `frontend/src/features/theme/ThemeContext.tsx`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Produces: `ThemeProvider` (wraps the app), `useTheme(): { theme: 'light' | 'dark'; toggleTheme: () => void }` — consumed by `Sidebar` in Task 5.

- [ ] **Step 1: Write `ThemeContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'buildflow-theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readInitialTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }, [])

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider')
  }
  return context
}
```

- [ ] **Step 2: Wrap the app in `ThemeProvider`**

In `frontend/src/main.tsx`, import and wrap:
```tsx
import { ThemeProvider } from './features/theme/ThemeContext.tsx'
```
and change the render tree from
```tsx
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```
to
```tsx
<QueryClientProvider client={queryClient}>
  <ThemeProvider>
    <App />
  </ThemeProvider>
</QueryClientProvider>
```

- [ ] **Step 3: Verify it doesn't crash**

```bash
cd frontend && npx tsc -b --noEmit && npm run build
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/theme frontend/src/main.tsx
git commit -m "feat: adiciona alternancia de tema claro/escuro"
```

---

### Task 4: `components/ui/` primitive library

**Files:**
- Create: `frontend/src/components/ui/Spinner.tsx`
- Create: `frontend/src/components/ui/Alert.tsx`
- Create: `frontend/src/components/ui/Card.tsx`
- Create: `frontend/src/components/ui/PageHeader.tsx`
- Create: `frontend/src/components/ui/FormField.tsx`
- Create: `frontend/src/components/ui/index.ts`

**Interfaces:**
- Produces:
  - `Spinner({ label }: { label: string })` — renders a Bootstrap spinner, `role="status"` on the wrapper, `label` as the accessible text.
  - `Alert({ children, variant }: { children: ReactNode; variant?: 'danger' | 'warning' | 'info' })` — renders `role="alert"` `div.alert`.
  - `Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode })` — `div.card` wrapper.
  - `PageHeader({ title, subtitle, breadcrumbs }: { title: string; subtitle?: string; breadcrumbs: { label: string; to?: string }[] })`.
  - `FormField({ id, label, error, children }: { id: string; label: string; error?: string | null; children: ReactNode })` — wraps a single labeled input, renders the error as `role="alert"` under it.
- Consumes: nothing (leaf components), except `FormField`/`PageHeader` use `react-router-dom`'s `Link`.

- [ ] **Step 1: `Spinner.tsx`**

```tsx
interface SpinnerProps {
  label: string
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <div className="d-flex align-items-center gap-2 py-4" role="status">
      <div className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
```

- [ ] **Step 2: `Alert.tsx`**

```tsx
import type { ReactNode } from 'react'

interface AlertProps {
  children: ReactNode
  variant?: 'danger' | 'warning' | 'info'
}

export function Alert({ children, variant = 'danger' }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`} role="alert">
      {children}
    </div>
  )
}
```

- [ ] **Step 3: `Card.tsx`**

```tsx
import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  actions?: ReactNode
  children: ReactNode
}

export function Card({ title, actions, children }: CardProps) {
  return (
    <div className="card mb-4">
      {(title || actions) && (
        <div className="card-header d-flex justify-content-between align-items-center">
          {title && <h4 className="card-title mb-0">{title}</h4>}
          {actions}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  )
}
```

- [ ] **Step 4: `PageHeader.tsx`**

```tsx
import { Link } from 'react-router-dom'

interface Breadcrumb {
  label: string
  to?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs: Breadcrumb[]
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="page-heading">
      <div className="page-title">
        <div className="row align-items-center">
          <div className="col-12 col-md-6 order-md-1 order-last">
            <h3>{title}</h3>
            {subtitle && <p className="text-subtitle text-muted">{subtitle}</p>}
          </div>
          <div className="col-12 col-md-6 order-md-2 order-first d-flex justify-content-md-end align-items-center gap-2">
            <nav aria-label="breadcrumb" className="breadcrumb-header float-start float-lg-end">
              <ol className="breadcrumb mb-0">
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1
                  return (
                    <li
                      key={crumb.label}
                      className={`breadcrumb-item${isLast ? ' active' : ''}`}
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {crumb.to && !isLast ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
                    </li>
                  )
                })}
              </ol>
            </nav>
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `FormField.tsx`**

```tsx
import type { ReactNode } from 'react'

interface FormFieldProps {
  id: string
  label: string
  error?: string | null
  children: ReactNode
}

export function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <div className="form-group mb-3">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-erro`} role="alert" className="text-danger small mt-1">
          {error}
        </p>
      )}
    </div>
  )
}
```

`FormField` does not clone `children` to inject `className="form-control"` — each call site is responsible for putting `form-control`/`form-select` on its own `<input>`/`<select>`, since cloning would hide the exact markup from whoever reads the page component. This keeps the component honest about what it does (label + error wiring) without magic prop injection.

- [ ] **Step 6: `index.ts` barrel**

```ts
export { Spinner } from './Spinner'
export { Alert } from './Alert'
export { Card } from './Card'
export { PageHeader } from './PageHeader'
export { FormField } from './FormField'
```

- [ ] **Step 7: Verify**

```bash
cd frontend && npx tsc -b --noEmit
```
Expected: exit 0 (these components aren't imported anywhere yet, but must type-check standalone).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components
git commit -m "feat: adiciona biblioteca de componentes de UI (Card, Alert, PageHeader, FormField, Spinner)"
```

---

### Task 5: Layout shell — `Sidebar`, `Topbar`, `Footer`, `DashboardLayout`, `AuthLayout`

**Files:**
- Create: `frontend/src/layouts/Sidebar.tsx`
- Create: `frontend/src/layouts/Topbar.tsx`
- Create: `frontend/src/layouts/Footer.tsx`
- Create: `frontend/src/layouts/DashboardLayout.tsx`
- Create: `frontend/src/layouts/AuthLayout.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `frontend/src/features/auth/AuthContext.tsx` (`user`, `logout`), `useTheme()` from Task 3.
- Produces: `DashboardLayout` (no props — renders `<Outlet/>`), `AuthLayout({ children }: { children: ReactNode })`, both used by `App.tsx` in Task 6.

- [ ] **Step 1: `Sidebar.tsx`**

```tsx
import { FileText, LayoutGrid, Settings } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'
import { useTheme } from '../features/theme/ThemeContext'

export function Sidebar() {
  const { projetoId } = useParams<{ projetoId?: string }>()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="sidebar-wrapper active">
      <div className="sidebar-header position-relative">
        <div className="d-flex justify-content-between align-items-center">
          <div className="logo">
            <span className="fw-bold fs-4">BuildFlow</span>
          </div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="toggle-dark"
              checked={theme === 'dark'}
              onChange={toggleTheme}
              aria-label="Alternar tema claro/escuro"
            />
          </div>
        </div>
      </div>
      <div className="sidebar-menu">
        <ul className="menu">
          <li className="sidebar-title">Navegação</li>
          <li className="sidebar-item">
            <NavLink to="/projetos" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <LayoutGrid size={18} aria-hidden="true" />
              <span>Projetos</span>
            </NavLink>
          </li>
          {projetoId && (
            <>
              <li className="sidebar-item">
                <NavLink
                  to={`/projetos/${projetoId}/registros-diarios`}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <FileText size={18} aria-hidden="true" />
                  <span>Registros diários</span>
                </NavLink>
              </li>
              <li className="sidebar-item">
                <NavLink
                  to={`/projetos/${projetoId}/configuracoes`}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <Settings size={18} aria-hidden="true" />
                  <span>Configurações</span>
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `Topbar.tsx`**

```tsx
import { LogOut } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'

export function Topbar() {
  const { user, logout } = useAuth()

  return (
    <header className="mb-3 d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
      <span className="fw-semibold">
        {user?.empresa_nome} — {user?.nome} ({user?.perfil})
      </span>
      <button type="button" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2" onClick={() => void logout()}>
        <LogOut size={16} aria-hidden="true" />
        Sair
      </button>
    </header>
  )
}
```

- [ ] **Step 3: `Footer.tsx`**

```tsx
export function Footer() {
  return (
    <footer className="footer text-center text-muted py-3">
      <p className="mb-0">BuildFlow — Gestão diária de obras</p>
    </footer>
  )
}
```

- [ ] **Step 4: `DashboardLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function DashboardLayout() {
  return (
    <div id="app">
      <div id="sidebar">
        <Sidebar />
      </div>
      <div id="main">
        <Topbar />
        <div className="page-content px-3">
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `AuthLayout.tsx`**

```tsx
import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="row h-100 m-0">
      <div className="col-lg-5 col-12">
        <div id="auth-left" className="d-flex flex-column justify-content-center h-100 px-4 px-lg-5">
          {children}
        </div>
      </div>
      <div className="col-lg-7 d-none d-lg-block">
        <div id="auth-right" className="h-100" />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify**

```bash
cd frontend && npx tsc -b --noEmit
```
Expected: exit 0. (`DashboardLayout`/`AuthLayout` aren't wired into `App.tsx` yet — that's Task 6 — so this just checks these files compile in isolation.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layouts
git commit -m "feat: adiciona layout shell (sidebar, topbar, footer) baseado no Mazer"
```

---

### Task 6: Wire layouts into `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `DashboardLayout`, `AuthLayout` (Task 5).

- [ ] **Step 1: Replace `App.tsx` routing to nest protected routes under `DashboardLayout`**

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

Note: `ProtectedRoute` (outer) still owns the auth-redirect logic unchanged; `DashboardLayout` (inner) is purely presentational chrome, nested one level in so `/login` never renders the sidebar.

- [ ] **Step 2: Verify build and run the full E2E suite once as a checkpoint**

```bash
cd frontend && npx tsc -b --noEmit && npm run build
npm run test:e2e
```
Expected: `tsc`/`build` exit 0. E2E: expect the 5 existing spec files to mostly still pass since no page content changed yet — only the wrapping `DashboardLayout` chrome was added around them. If any test fails because a duplicate landmark/heading now exists (e.g., two `<h1>`s), note the failure and fix it in this task (adjust `Topbar`/`Sidebar` markup, not the test), then rerun before moving to Task 7.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: encaixa DashboardLayout nas rotas autenticadas"
```

---

### Task 7: Refactor `LoginPage` with `AuthLayout`

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `AuthLayout` (Task 5), `useAuth()` (unchanged).
- No change to `loadGoogleScript`, `useEffect` logic, or the `status`/`scriptError` state machine — only the returned JSX changes.

- [ ] **Step 1: Replace the `return` block only**

Keep lines 1–69 of `frontend/src/pages/LoginPage.tsx` (all the script-loading/auth logic) exactly as-is. Replace lines 71–89 (the `return (...)`) with:

```tsx
  return (
    <AuthLayout>
      <h1 className="auth-title fw-bold">BuildFlow</h1>
      <p className="auth-subtitle mb-4 text-muted">
        Gestão diária de obras — acesse com a conta Google da sua empresa.
      </p>

      {status === 'loading' && <Spinner label="Carregando…" />}

      <div ref={buttonRef} aria-live="polite" />

      {status === 'authenticating' && <Spinner label="Entrando…" />}

      {(loginError || scriptError) && (
        <div className="mt-3">
          <Alert>{loginError ?? scriptError}</Alert>
        </div>
      )}
    </AuthLayout>
  )
}
```

And add the two new imports at the top of the file, alongside the existing ones:
```tsx
import { Alert, Spinner } from '../components/ui'
import { AuthLayout } from '../layouts/AuthLayout'
```

- [ ] **Step 2: Verify with the login E2E spec**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/login.spec.ts
```
Expected: exit 0. `login.spec.ts` checks `getByRole('heading', { name: 'BuildFlow' })` (still an `<h1>`, text unchanged) and `getByRole('alert')` containing "Acesso não autorizado" (still rendered via `Alert`, which sets `role="alert"`) — both preserved.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "refactor: aplica AuthLayout e componentes de UI na tela de login"
```

---

### Task 8: Refactor `ProjetosListPage` + `ProjetoForm`

**Files:**
- Modify: `frontend/src/pages/ProjetosListPage.tsx`
- Modify: `frontend/src/features/projetos/ProjetoForm.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Card`, `Alert`, `Spinner`, `FormField` (Task 4).
- No change to `useProjetos`, `useCriarProjeto`, `projetoFormSchema`, or the `ProjetoForm` `onCreated` prop contract.

- [ ] **Step 1: Rewrite `ProjetosListPage.tsx`**

```tsx
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, PageHeader, Spinner } from '../components/ui'
import { ProjetoForm } from '../features/projetos/ProjetoForm'
import { useProjetos } from '../features/projetos/projetosApi'

export function ProjetosListPage() {
  const { data, isLoading, isError, refetch } = useProjetos()
  const [showForm, setShowForm] = useState(false)

  return (
    <main>
      <PageHeader
        title="Projetos"
        breadcrumbs={[{ label: 'Projetos' }]}
        actions={
          <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm((current) => !current)}>
            <Plus size={16} aria-hidden="true" />
            {showForm ? 'Cancelar' : 'Novo Projeto'}
          </button>
        }
      />

      {showForm && (
        <Card title="Criar novo projeto">
          <ProjetoForm onCreated={() => setShowForm(false)} />
        </Card>
      )}

      {isLoading && <Spinner label="Carregando projetos…" />}

      {isError && (
        <Alert>
          <p className="mb-2">Não foi possível carregar os projetos.</p>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </Alert>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <p className="text-muted">Nenhum projeto ainda. Crie o primeiro projeto para começar.</p>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <div className="row" aria-label="Lista de projetos">
          {data.results.map((projeto) => (
            <div className="col-12 col-md-6 col-lg-4" key={projeto.id}>
              <Card title={projeto.nome}>
                {projeto.descricao && <p>{projeto.descricao}</p>}
                <div className="d-flex gap-3">
                  <Link to={`/projetos/${projeto.id}/registros-diarios`}>Registros diários</Link>
                  <Link to={`/projetos/${projeto.id}/configuracoes`}>Configurações</Link>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
```

Note: the previous `<header>` with the user/empresa summary and "Sair" button moved to `Topbar` in Task 5 — `useAuth` is no longer needed directly in this page, so it is dropped from the imports (this is intentional, not an oversight).

- [ ] **Step 2: Rewrite `ProjetoForm.tsx`'s `return` block**

Keep all state/logic (lines 1–32) unchanged. Replace the JSX (lines 34–68) with:

```tsx
  return (
    <form onSubmit={handleSubmit} aria-label="Criar novo projeto">
      <FormField id="projeto-nome" label="Nome do projeto" error={nomeError}>
        <input
          id="projeto-nome"
          className="form-control"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          aria-invalid={nomeError ? 'true' : undefined}
          aria-describedby={nomeError ? 'projeto-nome-erro' : undefined}
        />
      </FormField>

      <FormField id="projeto-descricao" label="Breve descrição">
        <textarea
          id="projeto-descricao"
          className="form-control"
          value={descricao}
          onChange={(event) => setDescricao(event.target.value)}
        />
      </FormField>

      {criarProjeto.isError && <Alert>Não foi possível criar o projeto. Tente novamente.</Alert>}

      <button type="submit" className="btn btn-primary" disabled={criarProjeto.isPending}>
        {criarProjeto.isPending ? 'Criando…' : 'Criar projeto'}
      </button>
    </form>
  )
}
```

Add imports:
```tsx
import { Alert, FormField } from '../../components/ui'
```

- [ ] **Step 3: Verify with the projetos E2E spec**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/projetos.spec.ts
```
Expected: exit 0. This spec asserts `getByText('Nenhum projeto ainda')`, `getByRole('button', { name: 'Novo Projeto' })`, `getByRole('button', { name: 'Criar projeto' })`, `getByText('Duplicação BR-365')` (a project name, still rendered inside the `Card` title), and `getByRole('alert')` containing "obrigatório" (still the Zod validation message inside `FormField`'s error paragraph, which has `role="alert"`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjetosListPage.tsx frontend/src/features/projetos/ProjetoForm.tsx
git commit -m "refactor: aplica componentes de UI na listagem e criacao de projetos"
```

---

### Task 9: Refactor `RegistrosDiariosListPage`

**Files:**
- Modify: `frontend/src/pages/RegistrosDiariosListPage.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Alert`, `Spinner` (Task 4). No change to `useRegistrosDiarios`.

- [ ] **Step 1: Rewrite the file**

```tsx
import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Alert, PageHeader, Spinner } from '../components/ui'
import { useRegistrosDiarios } from '../features/registros-diarios/registrosDiariosApi'

export function RegistrosDiariosListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const { data, isLoading, isError, refetch } = useRegistrosDiarios(projetoId ?? '')

  return (
    <main aria-label="Registros diários">
      <PageHeader
        title="Registros diários"
        breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Registros diários' }]}
        actions={
          <Link
            to={`/projetos/${projetoId}/registros-diarios/novo`}
            className="btn btn-primary d-flex align-items-center gap-2"
          >
            <Plus size={16} aria-hidden="true" />
            Novo registro diário
          </Link>
        }
      />

      {isLoading && <Spinner label="Carregando registros…" />}

      {isError && (
        <Alert>
          <p className="mb-2">Não foi possível carregar os registros diários.</p>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </Alert>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <p className="text-muted">Nenhum registro diário ainda. Crie o primeiro para começar.</p>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <ul className="list-group" aria-label="Lista de registros diários">
          {data.results.map((registro) => (
            <li className="list-group-item" key={registro.id}>
              <Link to={`/projetos/${projetoId}/registros-diarios/${registro.id}`}>
                {registro.data_referencia} — {registro.turno} — {registro.clima}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/registros-list.spec.ts
```
Expected: exit 0 — the spec checks `getByText('Nenhum registro diário ainda')`, `getByRole('link', { name: 'Novo registro diário' })` (still an `<a>` via `Link`, text unchanged), and `getByRole('link', { name: /2026-07-17/ })`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RegistrosDiariosListPage.tsx
git commit -m "refactor: aplica componentes de UI na listagem de registros diarios"
```

---

### Task 10: Refactor `RegistroDiarioDetailPage` + `FotoUpload`

**Files:**
- Modify: `frontend/src/pages/RegistroDiarioDetailPage.tsx`
- Modify: `frontend/src/features/registros-diarios/FotoUpload.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Card`, `Alert`, `Spinner`, `FormField` (Task 4). No change to `useRegistroDiario`, `useEnviarFoto`, or the `FotoUpload` `registroId` prop.

- [ ] **Step 1: Rewrite `RegistroDiarioDetailPage.tsx`**

```tsx
import { Link, useParams } from 'react-router-dom'
import { Alert, Card, PageHeader, Spinner } from '../components/ui'
import { FotoUpload } from '../features/registros-diarios/FotoUpload'
import { useRegistroDiario } from '../features/registros-diarios/registrosDiariosApi'

export function RegistroDiarioDetailPage() {
  const { projetoId, registroId } = useParams<{ projetoId: string; registroId: string }>()
  const { data: registro, isLoading, isError, refetch } = useRegistroDiario(registroId)

  if (isLoading) return <Spinner label="Carregando…" />

  if (isError || !registro) {
    return (
      <Alert>
        <p className="mb-2">Não foi possível carregar o registro diário.</p>
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </Alert>
    )
  }

  return (
    <main aria-label="Detalhe do registro diário">
      <PageHeader
        title={`Registro diário — ${registro.data_referencia}`}
        breadcrumbs={[
          { label: 'Projetos', to: '/projetos' },
          { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
          { label: registro.data_referencia },
        ]}
        actions={
          <Link to={`/projetos/${projetoId}/registros-diarios`} className="btn btn-outline-secondary btn-sm">
            Voltar para a lista
          </Link>
        }
      />

      <Card title="Gerais">
        <p className="mb-1">Turno: {registro.turno}</p>
        <p className="mb-0">Clima: {registro.clima}</p>
      </Card>

      <Card title="Produção">
        <ul className="list-group list-group-flush" aria-label="Produção">
          {registro.producoes.map((producao, index) => (
            <li className="list-group-item" key={index}>
              {producao.rodovia} — km {producao.km_inicial} a {producao.km_final} — {producao.quantidade}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Equipe">
        <ul className="list-group list-group-flush" aria-label="Presenças">
          {registro.presencas.map((presenca, index) => (
            <li className="list-group-item" key={index}>
              {presenca.nome_avulso || presenca.pessoa} — {presenca.funcao} ({presenca.status})
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Máquinas">
        <ul className="list-group list-group-flush" aria-label="Máquinas">
          {registro.maquinas.map((maquina, index) => (
            <li className="list-group-item" key={index}>
              {maquina.identificacao_avulsa || maquina.maquina} — {maquina.horas_produtivas}h produtivas /{' '}
              {maquina.horas_paradas}h paradas
            </li>
          ))}
        </ul>
      </Card>

      {registro.ocorrencias.length > 0 && (
        <Card title="Ocorrências">
          <ul className="list-group list-group-flush" aria-label="Ocorrências">
            {registro.ocorrencias.map((ocorrencia, index) => (
              <li className="list-group-item" key={index}>
                {ocorrencia.tipo}: {ocorrencia.descricao}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Fotos">
        {registro.fotos.length === 0 && <p className="text-muted">Nenhuma foto anexada ainda.</p>}
        <div className="d-flex flex-wrap gap-3 mb-3" aria-label="Fotos">
          {registro.fotos.map((foto) => (
            <figure className="mb-0" key={foto.id}>
              <img src={foto.arquivo} alt="" width={120} className="rounded" />
              {foto.km && <figcaption className="small text-muted">km {foto.km}</figcaption>}
            </figure>
          ))}
        </div>
        <FotoUpload registroId={registro.id} />
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Rewrite `FotoUpload.tsx`'s `return` block**

Keep lines 1–32 (all state/handlers) unchanged. Replace lines 34–51 with:

```tsx
  return (
    <div aria-label="Anexar foto">
      <FormField id="foto-arquivo" label="Foto">
        <input id="foto-arquivo" type="file" accept="image/*" className="form-control" onChange={handleFileChange} />
      </FormField>

      {preview && <img src={preview} alt="Pré-visualização da foto" width={120} className="rounded mb-3" />}

      <FormField id="foto-km" label="Km (opcional)">
        <input id="foto-km" className="form-control" value={km} onChange={(event) => setKm(event.target.value)} />
      </FormField>

      <button type="button" className="btn btn-primary" onClick={handleEnviar} disabled={!arquivo || enviarFoto.isPending}>
        {enviarFoto.isPending ? 'Enviando…' : 'Anexar foto'}
      </button>

      {enviarFoto.isError && <Alert>Não foi possível enviar a foto.</Alert>}
    </div>
  )
}
```

Add imports (`FotoUpload.tsx` lives in `features/registros-diarios/`, two levels below `src/`):
```tsx
import { Alert, FormField } from '../../components/ui'
```

- [ ] **Step 3: Verify with the RDO E2E spec (covers both files)**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/rdo.spec.ts
```
Expected: exit 0. The spec clicks `getByRole('button', { name: 'Anexar foto' })` and checks `getByRole('heading', { name: /Registro diário/ })` — both preserved (heading text still starts with "Registro diário —", `PageHeader` renders it as an `<h3>`, which satisfies `getByRole('heading')` regardless of level).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/RegistroDiarioDetailPage.tsx frontend/src/features/registros-diarios/FotoUpload.tsx
git commit -m "refactor: aplica componentes de UI no detalhe do registro diario e upload de foto"
```

---

### Task 11: Refactor `RdoPage`

**Files:**
- Modify: `frontend/src/pages/RdoPage.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Card`, `Alert`, `Spinner`, `FormField` (Task 4).
- No change to any of: `PRODUCAO_VAZIA`, `PRESENCA_VAZIA`, `MAQUINA_VAZIA`, `OCORRENCIA_VAZIA`, the `useState` calls, the `useEffect` fiscal-prefill, `handleSubmit`, or `registroDiarioFormSchema`. Only the JSX inside the returned `<main>` changes, plus `className` additions on existing `<input>`/`<select>`/`<textarea>`/`<button>` elements.

- [ ] **Step 1: Keep lines 1–105 of `RdoPage.tsx` unchanged** (imports through the end of `handleSubmit`), except add these two imports alongside the existing ones:

```tsx
import { Alert, Card, FormField, PageHeader, Spinner } from '../components/ui'
```

- [ ] **Step 2: Replace the loading/error early-returns**

Change:
```tsx
  if (configuracao.isLoading) return <p role="status">Carregando…</p>
  if (configuracao.isError || !configuracao.data) {
    return <p role="alert">Não foi possível carregar os cadastros do projeto.</p>
  }
```
to:
```tsx
  if (configuracao.isLoading) return <Spinner label="Carregando…" />
  if (configuracao.isError || !configuracao.data) {
    return <Alert>Não foi possível carregar os cadastros do projeto.</Alert>
  }
```

- [ ] **Step 3: Replace the returned JSX**

Replace everything from `return (` (line 107) to the end of the file with:

```tsx
  return (
    <main aria-label="Novo registro diário">
      <PageHeader
        title="Novo Registro Diário"
        breadcrumbs={[
          { label: 'Projetos', to: '/projetos' },
          { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
          { label: 'Novo' },
        ]}
      />

      <Card title="Gerais">
        <div className="row" aria-label="Dados gerais">
          <div className="col-md-3">
            <FormField id="rdo-data" label="Data">
              <input
                id="rdo-data"
                type="date"
                className="form-control"
                value={dataReferencia}
                onChange={(event) => setDataReferencia(event.target.value)}
              />
            </FormField>
          </div>
          <div className="col-md-3">
            <FormField id="rdo-turno" label="Turno">
              <select
                id="rdo-turno"
                className="form-select"
                value={turno}
                onChange={(event) => setTurno(event.target.value as typeof turno)}
              >
                <option value="diurno">Diurno</option>
                <option value="noturno">Noturno</option>
              </select>
            </FormField>
          </div>
          <div className="col-md-3">
            <FormField id="rdo-clima" label="Clima">
              <select
                id="rdo-clima"
                className="form-select"
                value={clima}
                onChange={(event) => setClima(event.target.value as typeof clima)}
              >
                <option value="sol">Sol</option>
                <option value="nublado">Nublado</option>
                <option value="chuva">Chuva</option>
                <option value="chuva_forte">Chuva forte</option>
              </select>
            </FormField>
          </div>
          <div className="col-md-3">
            <FormField id="rdo-equipe" label="Equipe">
              <select id="rdo-equipe" className="form-select" value={equipe} onChange={(event) => setEquipe(event.target.value)}>
                <option value="">Selecione…</option>
                {equipes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="col-md-3">
            <FormField id="rdo-fiscal" label="Fiscal">
              <select id="rdo-fiscal" className="form-select" value={fiscal} onChange={(event) => setFiscal(event.target.value)}>
                <option value="">Selecione…</option>
                {fiscais.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome} ({item.email})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
      </Card>

      <Card title="Produção">
        <div aria-label="Produção do dia">
          {producoes.map((producao, index) => (
            <fieldset key={index} className="border rounded p-3 mb-3">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Rodovia</label>
                  <input
                    className="form-control"
                    value={producao.rodovia}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, rodovia: event.target.value } : item)),
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Disciplina</label>
                  <select
                    className="form-select"
                    value={producao.disciplina}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, disciplina: event.target.value, servico: '' } : item,
                        ),
                      )
                    }
                  >
                    <option value="">Selecione…</option>
                    {disciplinas.map((disciplina) => (
                      <option key={disciplina.id} value={disciplina.id}>
                        {disciplina.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Serviço</label>
                  <select
                    className="form-select"
                    value={producao.servico}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, servico: event.target.value } : item)),
                      )
                    }
                  >
                    <option value="">Selecione…</option>
                    {disciplinas
                      .find((d) => d.id === producao.disciplina)
                      ?.servicos.map((servico) => (
                        <option key={servico.id} value={servico.id}>
                          {servico.nome}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Km inicial</label>
                  <input
                    className="form-control"
                    value={producao.km_inicial}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, km_inicial: event.target.value } : item)),
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Km final</label>
                  <input
                    className="form-control"
                    value={producao.km_final}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, km_final: event.target.value } : item)),
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Quantidade</label>
                  <input
                    className="form-control"
                    value={producao.quantidade}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, quantidade: event.target.value } : item)),
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Unidade</label>
                  <select
                    className="form-select"
                    value={producao.unidade || ''}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, unidade: Number(event.target.value) } : item,
                        ),
                      )
                    }
                  >
                    <option value="">Selecione…</option>
                    {unidades.map((unidade) => (
                      <option key={unidade.id} value={unidade.id}>
                        {unidade.sigla}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn btn-outline-primary" onClick={() => setProducoes((current) => [...current, PRODUCAO_VAZIA])}>
            + Adicionar produção
          </button>
        </div>
      </Card>

      <Card title="Equipe">
        <div aria-label="Equipe / presença">
          {presencas.map((presenca, index) => (
            <fieldset key={index} className="border rounded p-3 mb-3">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Pessoa cadastrada</label>
                  <select
                    className="form-select"
                    value={presenca.pessoa ?? ''}
                    onChange={(event) => {
                      const pessoaId = event.target.value || undefined
                      setPresencas((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, pessoa: pessoaId, nome_avulso: pessoaId ? '' : item.nome_avulso }
                            : item,
                        ),
                      )
                    }}
                  >
                    <option value="">Avulso (digitar nome)</option>
                    {equipeSelecionada?.pessoas.map((pessoa) => (
                      <option key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome}
                      </option>
                    ))}
                  </select>
                </div>
                {!presenca.pessoa && (
                  <div className="col-md-4">
                    <label className="form-label">Nome (avulso)</label>
                    <input
                      className="form-control"
                      value={presenca.nome_avulso ?? ''}
                      onChange={(event) =>
                        setPresencas((current) =>
                          current.map((item, i) => (i === index ? { ...item, nome_avulso: event.target.value } : item)),
                        )
                      }
                    />
                  </div>
                )}
                <div className="col-md-4">
                  <label className="form-label">Função</label>
                  <input
                    className="form-control"
                    value={presenca.funcao}
                    onChange={(event) =>
                      setPresencas((current) =>
                        current.map((item, i) => (i === index ? { ...item, funcao: event.target.value } : item)),
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={presenca.status}
                    onChange={(event) =>
                      setPresencas((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, status: event.target.value as PresencaInput['status'] } : item,
                        ),
                      )
                    }
                  >
                    <option value="presente">Presente</option>
                    <option value="falta">Falta</option>
                    <option value="atestado">Atestado</option>
                  </select>
                </div>
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn btn-outline-primary" onClick={() => setPresencas((current) => [...current, PRESENCA_VAZIA])}>
            + Adicionar pessoa
          </button>
        </div>
      </Card>

      <Card title="Máquinas">
        <div aria-label="Máquinas">
          {maquinas.map((maquina, index) => (
            <fieldset key={index} className="border rounded p-3 mb-3">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Máquina cadastrada</label>
                  <select
                    className="form-select"
                    value={maquina.maquina ?? ''}
                    onChange={(event) => {
                      const maquinaId = event.target.value || undefined
                      setMaquinas((current) =>
                        current.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                maquina: maquinaId,
                                identificacao_avulsa: maquinaId ? '' : item.identificacao_avulsa,
                              }
                            : item,
                        ),
                      )
                    }}
                  >
                    <option value="">Avulso (digitar identificação)</option>
                    {equipeSelecionada?.maquinas.map((maq) => (
                      <option key={maq.id} value={maq.id}>
                        {maq.nome}
                      </option>
                    ))}
                  </select>
                </div>
                {!maquina.maquina && (
                  <div className="col-md-4">
                    <label className="form-label">Identificação (avulsa)</label>
                    <input
                      className="form-control"
                      value={maquina.identificacao_avulsa ?? ''}
                      onChange={(event) =>
                        setMaquinas((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, identificacao_avulsa: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                )}
                <div className="col-md-4">
                  <label className="form-label">Horas produtivas</label>
                  <input
                    className="form-control"
                    value={maquina.horas_produtivas}
                    onChange={(event) =>
                      setMaquinas((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, horas_produtivas: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Horas paradas</label>
                  <input
                    className="form-control"
                    value={maquina.horas_paradas}
                    onChange={(event) =>
                      setMaquinas((current) =>
                        current.map((item, i) => (i === index ? { ...item, horas_paradas: event.target.value } : item)),
                      )
                    }
                  />
                </div>
                {Number(maquina.horas_paradas) > 0 && (
                  <div className="col-md-4">
                    <label className="form-label">Motivo da parada</label>
                    <select
                      className="form-select"
                      value={maquina.motivo_parada ?? ''}
                      onChange={(event) =>
                        setMaquinas((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, motivo_parada: Number(event.target.value) } : item,
                          ),
                        )
                      }
                    >
                      <option value="">Selecione…</option>
                      {motivosParada.map((motivo) => (
                        <option key={motivo.id} value={motivo.id}>
                          {motivo.descricao}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn btn-outline-primary" onClick={() => setMaquinas((current) => [...current, MAQUINA_VAZIA])}>
            + Adicionar máquina
          </button>
        </div>
      </Card>

      <Card title="Ocorrências">
        <div aria-label="Ocorrências">
          {ocorrencias.map((ocorrencia, index) => (
            <fieldset key={index} className="border rounded p-3 mb-3">
              <label className="form-label">Descrição</label>
              <textarea
                className="form-control"
                value={ocorrencia.descricao}
                onChange={(event) =>
                  setOcorrencias((current) =>
                    current.map((item, i) => (i === index ? { ...item, descricao: event.target.value } : item)),
                  )
                }
              />
            </fieldset>
          ))}
          <button type="button" className="btn btn-outline-primary" onClick={() => setOcorrencias((current) => [...current, OCORRENCIA_VAZIA])}>
            + Adicionar ocorrência
          </button>
        </div>
      </Card>

      {erro && <Alert>{erro}</Alert>}

      <button type="button" className="btn btn-primary btn-lg mb-5" onClick={handleSubmit} disabled={criarRegistro.isPending}>
        {criarRegistro.isPending ? 'Salvando…' : 'Salvar registro diário'}
      </button>
    </main>
  )
}
```

Note: every `<label>` that previously wrapped its `<input>`/`<select>` (`<label>Rodovia<input .../></label>`) is now a sibling `<label className="form-label">` + `<input>` inside the same grid column, without an explicit `htmlFor`/`id` pair. This is a deliberate, minimal deviation — these repeated fieldset rows don't have stable per-row ids (index-based ids would be fragile across add/remove), and Playwright's `rdo.spec.ts` locates these fields via `fieldset`/`nth`/label text proximity, not `getByLabelText`. Confirm this against the actual spec in Step 2 below; if it turns out the spec does use `getByLabelText`, wrap each input back in `<label>` instead of splitting label/input, matching the original structure exactly.

- [ ] **Step 2: Check exactly how `rdo.spec.ts` locates form fields before assuming Step 1's markup is safe**

```bash
grep -n "getByLabel\|getByRole('textbox'\|getByRole('combobox'\|locator(" frontend/tests/e2e/rdo.spec.ts
```
If this shows `getByLabelText(...)` calls, revert the label/input split in Step 1 for those specific fields back to `<label>Text<input/></label>` nesting (implicit label association), since Bootstrap's `form-control`/`form-select` classes work identically whether the label wraps the input or not.

- [ ] **Step 3: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/rdo.spec.ts
```
Expected: exit 0, including the two RDO tests (create RDO end-to-end, avulso→cadastro field-clearing regression test).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/RdoPage.tsx
git commit -m "refactor: aplica componentes de UI e grid do Bootstrap no formulario de RDO"
```

---

### Task 12: Refactor `ConfiguracaoPage`

**Files:**
- Modify: `frontend/src/pages/ConfiguracaoPage.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `Card`, `Alert`, `Spinner` (Task 4). No change to any `useState`, the six mutation hooks, or their call signatures — only JSX/classNames.

- [ ] **Step 1: Keep lines 1–53 unchanged** (imports, all hooks/state, the loading/error guard's condition), but change the guard's rendering:

Change:
```tsx
  if (configuracao.isLoading) return <p role="status">Carregando…</p>
  if (configuracao.isError || !configuracao.data) {
    return (
      <div role="alert">
        <p>Não foi possível carregar a configuração do projeto.</p>
        <button type="button" onClick={() => void configuracao.refetch()}>
          Tentar novamente
        </button>
      </div>
    )
  }
```
to:
```tsx
  if (configuracao.isLoading) return <Spinner label="Carregando…" />
  if (configuracao.isError || !configuracao.data) {
    return (
      <Alert>
        <p className="mb-2">Não foi possível carregar a configuração do projeto.</p>
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void configuracao.refetch()}>
          Tentar novamente
        </button>
      </Alert>
    )
  }
```

Add imports at the top:
```tsx
import { Alert, Card, PageHeader, Spinner } from '../components/ui'
```

- [ ] **Step 2: Replace the returned JSX (from `return (` at the old line 54 to the end)**

```tsx
  return (
    <main aria-label="Configurações do projeto">
      <PageHeader title="Configurações" breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Configurações' }]} />

      <Card title="Disciplinas">
        <div aria-label="Disciplinas">
          {disciplinas.length === 0 && <p className="text-muted">Nenhuma disciplina cadastrada ainda.</p>}
          <ul className="list-group list-group-flush mb-3">
            {disciplinas.map((disciplina) => (
              <li className="list-group-item" key={disciplina.id}>
                {disciplina.nome}
              </li>
            ))}
          </ul>
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label htmlFor="nova-disciplina" className="form-label">
                Nova disciplina
              </label>
              <input
                id="nova-disciplina"
                className="form-control"
                value={nomeDisciplina}
                onChange={(event) => setNomeDisciplina(event.target.value)}
              />
            </div>
            <div className="col-auto">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => criarDisciplina.mutate(nomeDisciplina, { onSuccess: () => setNomeDisciplina('') })}
                disabled={!nomeDisciplina.trim() || criarDisciplina.isPending}
              >
                Adicionar disciplina
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Metas">
        <div aria-label="Metas">
          {metas.length === 0 && <p className="text-muted">Nenhuma meta cadastrada ainda.</p>}
          <ul className="list-group list-group-flush mb-3">
            {metas.map((meta) => (
              <li className="list-group-item" key={meta.id}>
                {disciplinas.find((d) => d.id === meta.disciplina)?.nome ?? meta.disciplina}: {meta.valor_alvo}
                {meta.peso_percentual ? ` (${meta.peso_percentual}%)` : ''}
              </li>
            ))}
          </ul>
          <p className="text-muted">
            Soma dos pesos: {somaPesos}%{' '}
            {Math.abs(somaPesos - 100) > 0.01 && somaPesos > 0 && '(atenção: não fecha 100%)'}
          </p>

          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label htmlFor="meta-disciplina" className="form-label">
                Disciplina
              </label>
              <select
                id="meta-disciplina"
                className="form-select"
                value={metaDisciplinaId}
                onChange={(event) => setMetaDisciplinaId(event.target.value)}
              >
                <option value="">Selecione…</option>
                {disciplinas.map((disciplina) => (
                  <option key={disciplina.id} value={disciplina.id}>
                    {disciplina.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="meta-valor" className="form-label">
                Valor alvo
              </label>
              <input id="meta-valor" className="form-control" value={metaValorAlvo} onChange={(event) => setMetaValorAlvo(event.target.value)} />
            </div>
            <div className="col-md-2">
              <label htmlFor="meta-peso" className="form-label">
                Peso (%)
              </label>
              <input id="meta-peso" className="form-control" value={metaPeso} onChange={(event) => setMetaPeso(event.target.value)} />
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!metaDisciplinaId || !metaValorAlvo || criarMeta.isPending}
                onClick={() =>
                  criarMeta.mutate(
                    {
                      disciplina: metaDisciplinaId,
                      unidade: disciplinas.find((d) => d.id === metaDisciplinaId)?.servicos[0]?.unidade ?? 0,
                      valor_alvo: metaValorAlvo,
                      peso_percentual: metaPeso || undefined,
                    },
                    { onSuccess: () => { setMetaValorAlvo(''); setMetaPeso('') } },
                  )
                }
              >
                Adicionar meta
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Equipes">
        <div aria-label="Equipes">
          {equipes.length === 0 && <p className="text-muted">Nenhuma equipe cadastrada ainda.</p>}
          <ul className="list-group list-group-flush mb-3">
            {equipes.map((equipe) => (
              <li className="list-group-item" key={equipe.id}>
                <strong>{equipe.nome}</strong>
                <ul className="mb-0">
                  {equipe.pessoas.map((pessoa) => (
                    <li key={pessoa.id}>
                      {pessoa.nome} — {pessoa.funcao}
                    </li>
                  ))}
                  {equipe.maquinas.map((maquina) => (
                    <li key={maquina.id}>
                      {maquina.nome} ({maquina.codigo})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="row g-2 align-items-end mb-4">
            <div className="col-auto">
              <label htmlFor="nova-equipe" className="form-label">
                Nova equipe
              </label>
              <input id="nova-equipe" className="form-control" value={nomeEquipe} onChange={(event) => setNomeEquipe(event.target.value)} />
            </div>
            <div className="col-auto">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!nomeEquipe.trim() || criarEquipe.isPending}
                onClick={() => criarEquipe.mutate(nomeEquipe, { onSuccess: () => setNomeEquipe('') })}
              >
                Adicionar equipe
              </button>
            </div>
          </div>

          <h5>Adicionar pessoa</h5>
          <div className="row g-2 align-items-end mb-4">
            <div className="col-md-3">
              <label htmlFor="pessoa-equipe" className="form-label">
                Equipe
              </label>
              <select id="pessoa-equipe" className="form-select" value={pessoaEquipeId} onChange={(event) => setPessoaEquipeId(event.target.value)}>
                <option value="">Selecione…</option>
                {equipes.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="pessoa-nome" className="form-label">
                Nome
              </label>
              <input id="pessoa-nome" className="form-control" value={pessoaNome} onChange={(event) => setPessoaNome(event.target.value)} />
            </div>
            <div className="col-md-3">
              <label htmlFor="pessoa-funcao" className="form-label">
                Função
              </label>
              <input id="pessoa-funcao" className="form-control" value={pessoaFuncao} onChange={(event) => setPessoaFuncao(event.target.value)} />
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!pessoaEquipeId || !pessoaNome.trim() || criarPessoa.isPending}
                onClick={() =>
                  criarPessoa.mutate(
                    { equipeId: pessoaEquipeId, nome: pessoaNome, funcao: pessoaFuncao },
                    { onSuccess: () => { setPessoaNome(''); setPessoaFuncao('') } },
                  )
                }
              >
                Adicionar pessoa
              </button>
            </div>
          </div>

          <h5>Adicionar máquina</h5>
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label htmlFor="maquina-equipe" className="form-label">
                Equipe
              </label>
              <select id="maquina-equipe" className="form-select" value={maquinaEquipeId} onChange={(event) => setMaquinaEquipeId(event.target.value)}>
                <option value="">Selecione…</option>
                {equipes.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="maquina-codigo" className="form-label">
                Código
              </label>
              <input id="maquina-codigo" className="form-control" value={maquinaCodigo} onChange={(event) => setMaquinaCodigo(event.target.value)} />
            </div>
            <div className="col-md-3">
              <label htmlFor="maquina-nome" className="form-label">
                Nome
              </label>
              <input id="maquina-nome" className="form-control" value={maquinaNome} onChange={(event) => setMaquinaNome(event.target.value)} />
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!maquinaEquipeId || !maquinaNome.trim() || criarMaquina.isPending}
                onClick={() =>
                  criarMaquina.mutate(
                    { equipeId: maquinaEquipeId, codigo: maquinaCodigo, nome: maquinaNome },
                    { onSuccess: () => { setMaquinaCodigo(''); setMaquinaNome('') } },
                  )
                }
              >
                Adicionar máquina
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Valores">
        <div aria-label="Valores de custo">
          {valoresCusto.length === 0 && <p className="text-muted">Nenhum valor cadastrado ainda.</p>}
          <ul className="list-group list-group-flush mb-3">
            {valoresCusto.map((valor) => (
              <li className="list-group-item" key={valor.id}>
                {valor.descricao} ({valor.tipo}): {valor.valor}
              </li>
            ))}
          </ul>
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label htmlFor="valor-tipo" className="form-label">
                Tipo
              </label>
              <select id="valor-tipo" className="form-select" value={valorTipo} onChange={(event) => setValorTipo(event.target.value as typeof valorTipo)}>
                <option value="mao_de_obra">Mão de obra</option>
                <option value="equipamento">Equipamento</option>
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="valor-descricao" className="form-label">
                Descrição
              </label>
              <input id="valor-descricao" className="form-control" value={valorDescricao} onChange={(event) => setValorDescricao(event.target.value)} />
            </div>
            <div className="col-md-3">
              <label htmlFor="valor-valor" className="form-label">
                Valor
              </label>
              <input id="valor-valor" className="form-control" value={valorValor} onChange={(event) => setValorValor(event.target.value)} />
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!valorDescricao.trim() || !valorValor || criarValorCusto.isPending}
                onClick={() =>
                  criarValorCusto.mutate(
                    { tipo: valorTipo, descricao: valorDescricao, valor: valorValor },
                    { onSuccess: () => { setValorDescricao(''); setValorValor('') } },
                  )
                }
              >
                Adicionar valor
              </button>
            </div>
          </div>
        </div>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/config.spec.ts
```
Expected: exit 0 — spec checks `getByText('Nenhuma disciplina cadastrada ainda.')`, `getByRole('button', { name: 'Adicionar disciplina' })`, `getByRole('listitem').filter({ hasText: 'Terraplenagem' })`, `getByRole('button', { name: 'Adicionar equipe' })`, `getByRole('listitem').filter({ hasText: 'Equipe A' })` — all preserved (`list-group-item` `<li>` elements still have `role="listitem"` implicitly).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ConfiguracaoPage.tsx
git commit -m "refactor: aplica componentes de UI na pagina de configuracoes do projeto"
```

---

### Task 13: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the entire frontend check suite**

```bash
cd frontend
npm run lint
npx tsc -b --noEmit
npm run build
npm run test
npm run test:e2e
```
Expected: every command exits 0. If `test:e2e` fails anywhere, read the failing assertion, find the corresponding page task above, and fix the markup there (never weaken the test) before re-running.

- [ ] **Step 2: Manual smoke check in a real browser**

```bash
cd backend && uv run python manage.py runserver &
cd frontend && npm run dev &
```
Open `http://localhost:5173`, log in with a real Google account (per `quickstart.md`), and click through: Projetos → Novo Projeto → Registros diários → Novo registro diário (fill and save) → detail page → attach a photo → Configurações (add a disciplina/equipe/pessoa/máquina/meta/valor). Confirm the sidebar/topbar/cards render with the Mazer look (Bootstrap primary-color buttons, cards with headers, breadcrumbs) and the dark-mode toggle in the sidebar switches themes. Kill both background servers when done (`kill %1 %2`).

- [ ] **Step 3: Update `README.md` and `specs/001-mvp-gestao-diaria/tasks.md`**

Add a line to `README.md`'s "Stack" section noting the frontend now uses Bootstrap 5 + a Mazer-based design system, and append an entry to the "Bugs reais encontrados em teste manual" or a new "Mudanças pós-MVP" section of `tasks.md` documenting this refactor (one line, per the project's existing traceability convention — see Task list item 6 in the design doc's Problem Solving history).

- [ ] **Step 4: Final commit**

```bash
git add README.md specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra adocao do design system Mazer no frontend"
```
