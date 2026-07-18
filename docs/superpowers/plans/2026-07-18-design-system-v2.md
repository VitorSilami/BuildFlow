# Design System v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bootstrap 5 + the Mazer SCSS design system with Tailwind CSS v4 + shadcn/ui across the entire frontend (including `/login`), seeded from the OKLCH token palette and typography already validated in the login redesign, without changing any business logic, hooks, API calls, Zod schemas, or routes.

**Architecture:** A curated set of shadcn/ui primitives (ported verbatim from `github.com/VitorSilami/diario-em-obras`, which already has them scaffolded with the right theme) plus a small set of BuildFlow-specific composite components (`Card`, `PageHeader`, `FormField`, `SelectField`, `EmptyState`, `Alert`, `Spinner`) replace the Bootstrap-based `components/ui/` built in the previous design-system migration. Every page is rewritten to consume these; `features/`, `hooks/`, `services/`, `schemas/`, `types/` are untouched.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui component pattern (Radix UI primitives + `class-variance-authority` + `tailwind-merge`), `lucide-react` (already installed), `@fontsource/inter` + `@fontsource/space-grotesk` + `@fontsource/jetbrains-mono` (already installed from the login redesign).

## Global Constraints

- Never change hook signatures, API call shapes, Zod schemas, or route paths — only JSX/markup/className.
- Every button/link accessible name used by `frontend/tests/e2e/*.spec.ts` must remain byte-identical unless a task explicitly changes it. `role="alert"` / `role="status"` on containers referenced by tests must be preserved.
- No Bootstrap, no Mazer SCSS remaining anywhere in the repo after Task 11.
- The composite components (`Card`, `PageHeader`, `FormField`, `Alert`, `Spinner`) keep the **same prop signatures** they have today (`Card({title, actions, children})`, `PageHeader({title, subtitle, breadcrumbs, actions})`, `FormField({id, label, error, children})`, `Alert({children})`, `Spinner({label})`) so page-level call sites need minimal changes beyond swapping Bootstrap `className` strings for Tailwind ones.
- `useTheme(): { theme: 'light' | 'dark'; toggleTheme: () => void }` (from `frontend/src/features/theme/ThemeContext.tsx`) keeps this exact public signature — only its internal DOM side effect changes (from `data-bs-theme` attribute to a `.dark` class on `<html>`, per Tailwind's class-based dark mode).
- `cd frontend && npm run lint && npx tsc -b --noEmit && npm run build` must pass after every task. The full suite (`npm run test && npm run test:e2e`, 10 E2E tests) must pass after Task 11.
- Commit messages in Portuguese, imperative, explaining why.
- The reference repo clone lives at (or is re-cloned to, if missing) `C:/Users/vitor/AppData/Local/Temp/claude/c--Users-vitor-OneDrive-Desktop-BuildFlow/b4503ab9-1095-4272-a030-fecbfb09830a/scratchpad/diario-em-obras` — every task that ports files from it should verify the path exists first and re-clone from `https://github.com/VitorSilami/diario-em-obras.git` if not.

---

### Task 1: Tailwind v4 + shadcn foundation — tokens, path alias, remove Bootstrap/Mazer

**Files:**
- Modify: `frontend/package.json` (dependencies)
- Create: `frontend/src/app.css` (replaces `frontend/src/styles/app.scss` and `frontend/src/index.css`)
- Create: `frontend/src/lib/utils.ts`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/tsconfig.app.json` (or wherever `compilerOptions.paths` should live — check which tsconfig the app project references)
- Modify: `frontend/src/main.tsx`
- Delete: `frontend/src/index.css`, `frontend/src/styles/` (entire directory — Mazer SCSS tree)

**Interfaces:**
- Produces: the `@/*` → `frontend/src/*` path alias (used by every ported shadcn file's `import { cn } from "@/lib/utils"` and by our own new code); `cn(...)` helper function; the full Tailwind token set (`--color-background`, `--color-foreground`, `--color-card`, `--color-primary`, `--color-secondary`, `--color-muted`, `--color-accent`, `--color-destructive`, `--color-border`, `--color-input`, `--color-ring`, `--color-surface`, `--color-surface-strong`, `--color-ink`, `--color-signal`, plus `--font-sans`, `--font-display`, `--font-mono`, `--radius-*`) available as Tailwind utility classes (`bg-background`, `text-ink`, `font-display`, `rounded-lg`, etc.) everywhere in the app.

- [ ] **Step 1: Install dependencies, remove Bootstrap**

```bash
cd frontend
npm uninstall bootstrap bootstrap-icons sass
npm install tailwindcss @tailwindcss/vite tailwind-merge clsx class-variance-authority tw-animate-css
npm install @radix-ui/react-slot @radix-ui/react-label @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-avatar @radix-ui/react-progress @radix-ui/react-checkbox @radix-ui/react-switch @radix-ui/react-select
```
Expected: `package.json` `dependencies` gains `tailwindcss`, `@tailwindcss/vite`, `tailwind-merge`, `clsx`, `class-variance-authority`, `tw-animate-css`, the 11 `@radix-ui/react-*` packages; `bootstrap`, `bootstrap-icons`, `sass` are gone from `devDependencies`/`dependencies`.

- [ ] **Step 2: Add the `@/*` path alias**

Find which tsconfig the Vite project actually type-checks against:
```bash
cat frontend/tsconfig.json
```
It will `"references"` one or more project tsconfigs (typically `tsconfig.app.json` for `src/`). Add to that file's `compilerOptions`:
```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

- [ ] **Step 3: Wire the Tailwind Vite plugin and the alias into `vite.config.ts`**

Replace `frontend/vite.config.ts` with:
```ts
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create `frontend/src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: Create `frontend/src/app.css`**

This is the token seed from the login redesign (the `oklch()` values already validated in `frontend/src/styles/pages/_login.scss`, generalized from the `--login-*` prefix to being the whole app's tokens), in shadcn/Tailwind-v4's expected `@theme` format:

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-surface: var(--surface);
  --color-surface-strong: var(--surface-strong);
  --color-ink: var(--ink);
  --color-signal: var(--signal);
}

:root {
  --radius: 0.5rem;

  --background: oklch(0.985 0.006 250);
  --foreground: oklch(0.22 0.08 260);
  --surface: oklch(0.97 0.012 250);
  --surface-strong: oklch(0.94 0.02 250);
  --ink: oklch(0.18 0.09 262);
  --signal: oklch(0.68 0.16 240);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.08 260);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.08 260);

  --primary: oklch(0.35 0.14 258);
  --primary-foreground: oklch(0.985 0.006 250);
  --secondary: oklch(0.94 0.02 250);
  --secondary-foreground: oklch(0.22 0.08 260);
  --muted: oklch(0.94 0.02 250);
  --muted-foreground: oklch(0.5 0.04 258);
  --accent: oklch(0.68 0.16 240);
  --accent-foreground: oklch(0.18 0.09 262);
  --destructive: oklch(0.58 0.22 27);
  --destructive-foreground: oklch(0.985 0.006 250);

  --border: oklch(0.88 0.02 250);
  --input: oklch(0.88 0.02 250);
  --ring: oklch(0.55 0.14 250);
}

.dark {
  --background: oklch(0.16 0.05 260);
  --foreground: oklch(0.97 0.01 250);
  --surface: oklch(0.2 0.06 260);
  --surface-strong: oklch(0.26 0.07 260);
  --ink: oklch(0.97 0.01 250);
  --signal: oklch(0.72 0.16 240);

  --card: oklch(0.2 0.06 260);
  --card-foreground: oklch(0.97 0.01 250);
  --popover: oklch(0.2 0.06 260);
  --popover-foreground: oklch(0.97 0.01 250);
  --primary: oklch(0.72 0.16 240);
  --primary-foreground: oklch(0.16 0.05 260);
  --secondary: oklch(0.26 0.07 260);
  --secondary-foreground: oklch(0.97 0.01 250);
  --muted: oklch(0.26 0.07 260);
  --muted-foreground: oklch(0.7 0.04 250);
  --accent: oklch(0.72 0.16 240);
  --accent-foreground: oklch(0.16 0.05 260);
  --destructive: oklch(0.65 0.2 27);
  --destructive-foreground: oklch(0.97 0.01 250);
  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.55 0.14 250);
}

@layer base {
  * {
    border-color: var(--color-border);
  }

  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    font-feature-settings: "ss01", "cv11";
  }

  .font-display {
    font-family: var(--font-display);
    letter-spacing: -0.02em;
  }

  .font-mono {
    font-family: var(--font-mono);
  }
}

@utility grid-blueprint {
  background-image:
    linear-gradient(to right, oklch(0.35 0.14 258 / 0.06) 1px, transparent 1px),
    linear-gradient(to bottom, oklch(0.35 0.14 258 / 0.06) 1px, transparent 1px);
  background-size: 48px 48px;
}
```

- [ ] **Step 6: Delete the old stylesheets, wire the new one into `main.tsx`**

```bash
rm frontend/src/index.css
rm -rf frontend/src/styles
```

In `frontend/src/main.tsx`, change:
```tsx
import './index.css'
import './styles/app.scss'
```
to:
```tsx
import './app.css'
```

- [ ] **Step 7: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npm run build
```
Expected: exit 0. No Sass errors possible now (no `.scss` files left). If `tsc` complains it can't resolve `@/*` imports, re-check Step 2 targeted the tsconfig that `frontend/tsconfig.json`'s `references` actually points at for `src/**/*.tsx`.

- [ ] **Step 8: Commit**

```bash
git add -A frontend/package.json frontend/package-lock.json frontend/src/app.css frontend/src/lib frontend/vite.config.ts frontend/tsconfig.app.json frontend/src/main.tsx
git rm -r frontend/src/index.css frontend/src/styles
git commit -m "feat: substitui Bootstrap/Mazer por Tailwind CSS v4, semente de tokens do login"
```

---

### Task 2: Portar primitivos shadcn/ui

**Files:**
- Create: `frontend/src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `switch.tsx`, `badge.tsx`, `card.tsx`, `alert.tsx`, `dialog.tsx`, `table.tsx`, `tabs.tsx`, `progress.tsx`, `skeleton.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`, `avatar.tsx`, `sheet.tsx`

**Interfaces:**
- Consumes: `frontend/src/lib/utils.ts`'s `cn()` (Task 1), the `@/*` alias (Task 1).
- Produces: the raw shadcn exports each file provides (`Button`/`buttonVariants`, `Input`, `Label`, `Textarea`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`/`SelectGroup`, `Checkbox`, `Switch`, `Badge`/`badgeVariants`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`, `Alert`/`AlertTitle`/`AlertDescription`, `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Progress`, `Skeleton`, `DropdownMenu` (+ subparts), `Tooltip`/`TooltipTrigger`/`TooltipContent`/`TooltipProvider`, `Avatar`/`AvatarImage`/`AvatarFallback`, `Sheet`/`SheetTrigger`/`SheetContent`/`SheetHeader`/`SheetTitle` — Task 3/4 import these directly by name from their respective files (not yet re-exported from a barrel; Task 3 adds the barrel).

- [ ] **Step 1: Confirm the reference clone exists, re-clone if not**

```bash
REF="C:/Users/vitor/AppData/Local/Temp/claude/c--Users-vitor-OneDrive-Desktop-BuildFlow/b4503ab9-1095-4272-a030-fecbfb09830a/scratchpad/diario-em-obras"
test -d "$REF/src/components/ui" || git clone --depth 1 https://github.com/VitorSilami/diario-em-obras.git "$REF"
ls "$REF/src/components/ui" | wc -l
```
Expected: the directory exists with 40+ `.tsx` files.

- [ ] **Step 2: Copy the curated list of 18 primitives verbatim**

```bash
REF="C:/Users/vitor/AppData/Local/Temp/claude/c--Users-vitor-OneDrive-Desktop-BuildFlow/b4503ab9-1095-4272-a030-fecbfb09830a/scratchpad/diario-em-obras"
mkdir -p frontend/src/components/ui
for f in button input label textarea select checkbox switch badge card alert dialog table tabs progress skeleton dropdown-menu tooltip avatar sheet; do
  cp "$REF/src/components/ui/$f.tsx" "frontend/src/components/ui/$f.tsx"
done
ls frontend/src/components/ui | sort
```
Expected: exactly the 18 files listed above (plus nothing else yet — Task 3 adds our own composites alongside them). Every file already imports `cn` from `@/lib/utils` and (where relevant) the specific `@radix-ui/react-*` package installed in Task 1 — no import needs adjusting, since we replicated the exact same `@/*` alias and dependency versions.

Two components from the design doc's Etapa 6 list are deliberately **not** ported here: **Command** (needs the extra `cmdk` package and isn't consumed by any page this plan touches — no current screen has a command palette/searchable-list use case; add it in whichever future task actually needs one, per YAGNI) and **Drawer** (the reference repo's `drawer.tsx` is a bottom-sheet-style variant of the same underlying `@radix-ui/react-dialog` primitive as `sheet.tsx`, which we do port and use for the mobile sidebar nav in Task 4 — porting both would be two components serving the same "slide-in panel" job; `Sheet` covers it).

- [ ] **Step 3: Verify it compiles**

```bash
cd frontend && npx tsc -b --noEmit
```
Expected: exit 0. If a specific file errors on a missing Radix package, cross-check its `import * as XPrimitive from "@radix-ui/react-x"` line against Task 1 Step 1's install list — every package the 18 curated files need was installed there; if one was missed, `npm install @radix-ui/react-<name>` and retry.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui
git commit -m "feat: porta primitivos shadcn/ui do diario-em-obras (button, input, card, dialog, table, ...)"
```

---

### Task 3: Componentes compostos do BuildFlow

**Files:**
- Create: `frontend/src/components/ui/app-alert.tsx`, `app-spinner.tsx`, `app-card.tsx`, `page-header.tsx`, `form-field.tsx`, `select-field.tsx`, `empty-state.tsx`
- Create: `frontend/src/components/ui/index.ts` (barrel)

**Interfaces:**
- Consumes: `Alert`/`AlertDescription` from `./alert`, `Card`/`CardHeader`/`CardTitle`/`CardContent` from `./card`, `Label` from `./label`, `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` from `./select` (all Task 2).
- Produces (all re-exported from `frontend/src/components/ui/index.ts`, the same import path every page already uses — `'../components/ui'`):
  - `Alert({ children }: { children: ReactNode })` — same signature as the Bootstrap-era one; always renders as an error/destructive-styled alert with `role="alert"` (every current call site uses it only for error states).
  - `Spinner({ label }: { label: string })` — `role="status"`.
  - `Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode })` — same signature as before.
  - `PageHeader({ title, subtitle, breadcrumbs, actions }: { title: string; subtitle?: string; breadcrumbs: { label: string; to?: string }[]; actions?: ReactNode })` — same signature as before.
  - `FormField({ id, label, error, children }: { id: string; label: string; error?: string | null; children: ReactNode })` — same signature as before.
  - `SelectField({ id, label, value, onChange, options, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder?: string })` — **new**, collapses the label+select+options pattern repeated ~16 times across `RdoPage`/`ConfiguracaoPage` into one call.
  - `EmptyState({ children }: { children: ReactNode })` — **new**, standardizes the "Nenhum X ainda." pattern (currently a bare `<p className="text-muted">`).
  - Also re-exports the raw shadcn primitives pages will use directly: `Button`, `Input`, `Textarea`, `Label`, `Badge`.

- [ ] **Step 1: `app-alert.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Alert as ShadcnAlert, AlertDescription } from './alert'

interface AlertProps {
  children: ReactNode
}

export function Alert({ children }: AlertProps) {
  return (
    <ShadcnAlert variant="destructive">
      <AlertDescription>{children}</AlertDescription>
    </ShadcnAlert>
  )
}
```

- [ ] **Step 2: `app-spinner.tsx`**

```tsx
import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  label: string
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
```

- [ ] **Step 3: `app-card.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from './card'

interface CardProps {
  title?: string
  actions?: ReactNode
  children: ReactNode
}

export function Card({ title, actions, children }: CardProps) {
  return (
    <ShadcnCard className="mb-6">
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          {title && <CardTitle className="font-display text-lg">{title}</CardTitle>}
          {actions}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </ShadcnCard>
  )
}
```

- [ ] **Step 4: `page-header.tsx`**

```tsx
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

interface Breadcrumb {
  label: string
  to?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs: Breadcrumb[]
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <nav aria-label="breadcrumb" className="mb-2">
          <ol className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              return (
                <li key={crumb.label} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden="true">/</span>}
                  {crumb.to && !isLast ? (
                    <Link to={crumb.to} className="hover:text-ink">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
        <h3 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 5: `form-field.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Label } from './label'

interface FormFieldProps {
  id: string
  label: string
  error?: string | null
  children: ReactNode
}

export function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-erro`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: `select-field.tsx`**

```tsx
import { Label } from './label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

interface SelectFieldOption {
  value: string
  label: string
}

interface SelectFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectFieldOption[]
  placeholder?: string
}

export function SelectField({ id, label, value, onChange, options, placeholder }: SelectFieldProps) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder ?? 'Selecione…'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

Note: shadcn's `Select` (Radix) does not allow an empty-string `value` on `SelectItem` (Radix throws at runtime: "A `<Select.Item />` must have a value prop that is not an empty string"). Wherever a page previously had `<option value="">Selecione…</option>` as the unselected state, that's now handled by `SelectValue`'s `placeholder` prop instead (shown when `value` is `''`/`undefined`) — do not add an empty-string option to any `options` array passed to `SelectField`.

- [ ] **Step 7: `empty-state.tsx`**

```tsx
import type { ReactNode } from 'react'

interface EmptyStateProps {
  children: ReactNode
}

export function EmptyState({ children }: EmptyStateProps) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}
```

- [ ] **Step 8: Barrel `index.ts`**

```ts
export { Alert } from './app-alert'
export { Spinner } from './app-spinner'
export { Card } from './app-card'
export { PageHeader } from './page-header'
export { FormField } from './form-field'
export { SelectField } from './select-field'
export { EmptyState } from './empty-state'
export { Badge } from './badge'
export { Button } from './button'
export { Input } from './input'
export { Label } from './label'
export { Textarea } from './textarea'
```

- [ ] **Step 9: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx oxlint src/components/ui
```
Expected: exit 0 for both (these components aren't consumed by any page yet — Tasks 4-10 wire them in — but must type-check and lint standalone).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/ui
git commit -m "feat: adiciona componentes compostos do BuildFlow sobre os primitivos shadcn"
```

---

### Task 4: Layouts (Sidebar, Topbar, Footer, DashboardLayout) + dark mode + wire em App.tsx

**Files:**
- Modify: `frontend/src/layouts/Sidebar.tsx`, `Topbar.tsx`, `Footer.tsx`, `DashboardLayout.tsx` (full rewrites)
- Modify: `frontend/src/features/theme/ThemeContext.tsx`
- Modify: `frontend/src/App.tsx` (only if the route nesting needs adjustment — it shouldn't; verify)

**Interfaces:**
- Consumes: `useAuth()` (`user`, `logout`) from `frontend/src/features/auth/AuthContext.tsx` (unchanged); `useTheme()` from `ThemeContext.tsx` (signature unchanged, internal mechanism changes here); `Sheet`/`SheetContent`/`SheetTrigger`/`SheetHeader`/`SheetTitle` from `../components/ui/sheet` (Task 2); `Button` from `../components/ui` (Task 3 barrel).
- Produces: `DashboardLayout` (no props, renders `<Outlet/>`) — same contract `App.tsx` already nests routes under.

- [ ] **Step 1: Update `ThemeContext.tsx`'s DOM side effect**

Change the `useEffect` in `frontend/src/features/theme/ThemeContext.tsx` from:
```tsx
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])
```
to:
```tsx
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])
```
Nothing else in this file changes — `useTheme()`'s exported shape is identical.

- [ ] **Step 2: Rewrite `Sidebar.tsx`**

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

- [ ] **Step 3: Rewrite `Topbar.tsx`** (adds the mobile nav trigger — closes the "no responsive sidebar below 1200px" gap documented in the previous design system's review — and a visible dark-mode toggle, replacing the one that used to live inside the Mazer sidebar)

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
          </SheetHeader>
          <SidebarNav />
        </SheetContent>
      </Sheet>
    </header>
  )
}
```

- [ ] **Step 4: Rewrite `Footer.tsx`**

```tsx
export function Footer() {
  return (
    <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
      BuildFlow — Gestão diária de obras
    </footer>
  )
}
```

- [ ] **Step 5: Rewrite `DashboardLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { Footer } from './Footer'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify `App.tsx` still matches (no change expected, just confirm)**

```bash
grep -n "DashboardLayout" frontend/src/App.tsx
```
Expected: one `<Route element={<DashboardLayout />}>` wrapping the authenticated routes, unchanged from the previous design-system migration — this task doesn't touch routing, only what `DashboardLayout` renders.

- [ ] **Step 7: Verify build and the full E2E suite (integration checkpoint — same reasoning as the equivalent task in the previous design-system migration: this is the first time the new Sidebar/Topbar wrap real pages in tests)**

```bash
cd frontend && npx tsc -b --noEmit && npm run build && npx playwright test tests/e2e/
```
Expected: `tsc`/`build` exit 0. E2E: pages other than `/login` will look broken visually (they still use Bootstrap `className` strings like `btn btn-primary`, which Tailwind doesn't recognize as anything special — those classes become inert, no-op strings; the pages remain functionally intact since no HTML structure changed, only classNames became meaningless) — **this is expected and temporary**, resolved by Tasks 6-10. Confirm all 10 E2E tests still pass on functional grounds (they assert on text/role/aria-label, not on visual styling, so they should be unaffected). `login.spec.ts` specifically should look visually correct already, since Task 5 hasn't run yet — wait, actually Login isn't migrated until Task 5, so at this checkpoint `/login` also still has its old `.login-page`-scoped custom CSS classes, which no longer resolve to anything since `frontend/src/styles/` was deleted in Task 1. Confirm `login.spec.ts`'s 3 tests still pass on functional grounds (text/role assertions), even though the page will render unstyled until Task 5.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/layouts frontend/src/features/theme/ThemeContext.tsx
git commit -m "feat: reconstroi layout shell (sidebar com menu mobile, topbar, footer) em Tailwind"
```

---

### Task 5: Migrar `LoginPage.tsx` para Tailwind

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx` (full rewrite — JSX structure and copy stay the same, only `className` strings change from the old `.login-*` custom classes to Tailwind utilities)

**Interfaces:**
- Consumes: `Alert`, `Spinner` from `../components/ui` (Task 3); `Button` from `../components/ui` (Task 3) for the anchor-style CTAs (rendered `asChild` wrapping an `<a>`).
- No change to `loadGoogleScript`, the `useEffect`, `GoogleMark`, the `Logo`/`Hero`/`HeroMock`/`Marquee`/`Features`/`Isolation`/`Flow`/`Faq`/`CtaFooter` component boundaries or props, or any copy text — only the `className` on each element.

- [ ] **Step 1: Keep the top of the file (imports through the `useEffect`) — only remove the now-redundant `@fontsource` imports' relative concern (they stay, fonts are still self-hosted) and confirm no `'@fontsource/...'` import needs to change**

No code change needed here; `@fontsource/*` imports are CSS-only side effects, independent of the styling framework — they keep working exactly as before.

- [ ] **Step 2: Rewrite every component's `return` to use Tailwind utility classes instead of the deleted `.login-*` classes**

Full file:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import heroRoad from '../assets/hero-road.jpg'
import { Alert, Spinner } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não foi possível carregar o login do Google.'))
    document.head.appendChild(script)
  })
}

type LoginStatus = 'loading' | 'ready' | 'authenticating' | 'error'

export function LoginPage() {
  const { loginWithGoogle, loginError } = useAuth()
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<LoginStatus>('loading')
  const [scriptError, setScriptError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setStatus('authenticating')
            const success = await loginWithGoogle(response.credential)
            if (success) {
              navigate('/projetos', { replace: true })
            } else {
              setStatus('error')
            }
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
        })
        setStatus('ready')
      })
      .catch((error: Error) => {
        setScriptError(error.message)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [loginWithGoogle, navigate])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero buttonRef={buttonRef} status={status} scriptError={scriptError} loginError={loginError} />
      <Marquee />
      <Features />
      <Isolation />
      <Flow />
      <Faq />
      <CtaFooter />
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.6-2.5C16.9 3.5 14.7 2.5 12 2.5 6.7 2.5 2.5 6.7 2.5 12S6.7 21.5 12 21.5c6.9 0 9.5-4.8 9.5-9.3 0-.6-.1-1.1-.2-1.5H12z"
      />
    </svg>
  )
}

function Logo({ as: Tag = 'div', onDark = false }: { as?: 'div' | 'h1'; onDark?: boolean }) {
  return (
    <Tag className="flex items-center gap-2">
      <div className={`grid size-7 place-items-center rounded-sm ${onDark ? 'bg-background text-ink' : 'bg-ink text-background'}`}>
        <div className="size-3 rounded-[2px] bg-signal" />
      </div>
      <span className={`font-display text-lg font-bold tracking-tight ${onDark ? 'text-background' : 'text-ink'}`}>
        Build<span className="text-signal">Flow</span>
      </span>
    </Tag>
  )
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Logo as="h1" />
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#recursos" className="transition-colors hover:text-ink">Recursos</a>
          <a href="#isolamento" className="transition-colors hover:text-ink">Isolamento</a>
          <a href="#fluxo" className="transition-colors hover:text-ink">Fluxo</a>
          <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
        </nav>
        <a
          href="#entrar"
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-background transition-transform hover:-translate-y-px"
        >
          <GoogleMark />
          Entrar com Google
        </a>
      </div>
    </header>
  )
}

interface HeroProps {
  buttonRef: React.RefObject<HTMLDivElement>
  status: LoginStatus
  scriptError: string | null
  loginError: string | null
}

function Hero({ buttonRef, status, scriptError, loginError }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="grid-blueprint absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-signal" />
            KM 0+000 · MVP em produção
          </div>
          <h2 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink md:text-6xl lg:text-7xl">
            Gestão diária de obras rodoviárias, do canteiro ao escritório.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Plataforma multitenant para RDO com produção por km, presença de equipe, apontamento de
            máquinas, ocorrências e fotos. Cada empresa em sua própria fronteira de dados.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <div className="inline-flex min-h-11 items-center" id="entrar" ref={buttonRef} aria-live="polite" />
            {status === 'loading' && <Spinner label="Carregando…" />}
            {status === 'authenticating' && <Spinner label="Entrando…" />}
            <a
              href="#recursos"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold text-ink hover:bg-surface-strong"
            >
              Ver como funciona
            </a>
          </div>
          {(loginError || scriptError) && (
            <div className="mt-3">
              <Alert>{loginError ?? scriptError}</Alert>
            </div>
          )}
          <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Sem cadastro público · Usuários provisionados pela sua empresa
          </p>
        </div>

        <HeroMock />
      </div>
    </section>
  )
}

function HeroMock() {
  const stats: [string, string][] = [
    ['KM Inicial', '420+150'],
    ['KM Final', '421+050'],
    ['Sentido', 'Crescente'],
  ]
  const facts: [string, string][] = [
    ['Equipe', '12 pessoas'],
    ['Máquinas', '4 ativas'],
    ['Clima', 'Bom'],
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-ink/10" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-signal" /> RDO · BR-365 · Lote 02 · 18/Mai
        </span>
        <span>#8842</span>
      </div>
      <div className="relative h-52 w-full overflow-hidden border-b border-border">
        <img src={heroRoad} alt="Trecho de rodovia em execução ao entardecer" width={1600} height={1200} className="h-full w-full object-cover" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded bg-ink/85 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-background backdrop-blur">
          <span className="size-1.5 rounded-full bg-signal" />
          Foto · km 420+680
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {stats.map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</p>
            <p className="mt-1 font-mono text-sm font-medium text-ink">{v}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-md bg-surface p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Produção do dia</span>
            <span className="rounded-sm bg-signal/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink">CBUQ · 145,2 t</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="text-ink">Capa asfáltica</span>
            <span>0+450</span>
            <span>0+900</span>
            <span className="text-ink">145,2 t</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-md border border-dashed border-border p-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{k}</p>
              <p className="mt-0.5 text-xs font-semibold text-ink">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Marquee() {
  const items = [
    'RDO por km', 'Presença', 'Máquinas', 'Ocorrências', 'Fotos georreferenciadas',
    'Metas por disciplina', 'Frentes de trabalho', 'Multitenant',
  ]
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {items.map((it, i) => (
          <span key={it} className="flex items-center gap-8">
            {i > 0 && <span className="text-signal">/</span>}
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}

function Features() {
  const rows = [
    { n: '01', title: 'RDO completo', body: 'Produção, presença, máquinas e ocorrências em um único fluxo. Autor e data/hora registrados automaticamente.' },
    { n: '02', title: 'Fotos por km', body: 'Anexe evidências ao registro do dia e associe a quilometragem quando disponível, sem sair do formulário.' },
    { n: '03', title: 'Cadastro ou avulso', body: 'Vincule pessoas e máquinas cadastradas na configuração do projeto — ou lance na hora, sem cadastro prévio.' },
    { n: '04', title: 'Configuração por projeto', body: 'Metas por disciplina, frentes de trabalho, valores de mão de obra e equipamento — tudo por projeto.' },
    { n: '05', title: 'Perfis controlados', body: 'Gerente e Auxiliar administrativo, criados pelo administrador da sua empresa. Sem cadastro público.' },
    { n: '06', title: 'Login Google', body: 'Autenticação exclusiva via Google OAuth 2.0. Validamos emissor, audiência e expiração antes de liberar acesso.' },
  ]
  return (
    <section id="recursos" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Recursos</p>
        <h2 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">
          O suficiente para o dia. Preciso o bastante para a auditoria.
        </h2>
        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.n} className="group bg-background p-8 transition-colors hover:bg-surface">
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-signal">{r.n}</span>
                <span className="size-1.5 rounded-full bg-border transition-colors group-hover:bg-signal" />
              </div>
              <h3 className="font-display text-xl font-semibold text-ink">{r.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Isolation() {
  const rows = [
    { name: 'empresa_alpha', ok: false },
    { name: 'sua_empresa', ok: true },
    { name: 'empresa_beta', ok: false },
    { name: 'empresa_gamma', ok: false },
  ]
  const points = [
    'Empresa como fronteira absoluta de dados',
    'URL/ID de outra empresa → 404 silencioso',
    'Empresa desativada → acesso bloqueado no próximo request',
  ]
  return (
    <section id="isolamento" className="border-b border-border bg-ink text-background">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Isolamento multitenant</p>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            Sua empresa é a única fronteira que importa.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-background/70">
            Nenhum projeto, RDO ou configuração pode ser visto, alterado ou inferido por usuário de
            outra empresa. Tentativas de acesso cruzado respondem como se o recurso não existisse.
          </p>
          <ul className="mt-8 space-y-3 font-mono text-sm">
            {points.map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-1 text-signal">[✓]</span>
                <span className="text-background/85">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-2xl border border-background/10 bg-background/[0.03] p-6" aria-hidden="true">
          {rows.map((row) => (
            <div
              key={row.name}
              className={`flex items-center justify-between rounded-md border px-4 py-3 font-mono text-xs uppercase tracking-widest ${
                row.ok ? 'border-signal bg-signal/10 text-background' : 'border-background/10 bg-background/[0.02] text-background/40'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={`size-1.5 rounded-full ${row.ok ? 'bg-signal' : 'bg-background/25'}`} />
                {row.name}
              </span>
              <span className={row.ok ? 'text-signal' : ''}>{row.ok ? 'autenticado' : 'acesso negado'}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Flow() {
  const steps = [
    { k: 'A', title: 'Administrador provisiona', body: 'Cria a empresa e cadastra usuários com perfil (Gerente ou Auxiliar) pelo Django Admin.' },
    { k: 'B', title: 'Usuário entra com Google', body: 'Login exclusivo via Google. E-mail sem cadastro, usuário inativo ou sem empresa é recusado.' },
    { k: 'C', title: 'Projeto e configuração', body: 'Crie o projeto da obra, defina metas por disciplina, frentes de trabalho e equipes.' },
    { k: 'D', title: 'RDO todo dia', body: 'Registro diário com produção, presença, máquinas, ocorrências e fotos por km.' },
  ]
  return (
    <section id="fluxo" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Fluxo operacional</p>
        <h2 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">
          Do provisionamento ao registro do dia.
        </h2>
        <ol className="mt-16 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.k} className="bg-background p-8">
              <div className="mb-6 grid size-10 place-items-center rounded-sm bg-ink font-display font-bold text-background">{s.k}</div>
              <h3 className="font-display text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Faq() {
  const items = [
    { q: 'Preciso cadastrar minha empresa aqui?', a: 'Não. O provisionamento é feito pela administração — sua conta é criada pela sua empresa e vinculada ao seu e-mail Google.' },
    { q: 'Posso registrar duas RDOs no mesmo dia?', a: 'Sim. Turnos e frentes distintas podem gerar mais de um registro por dia; a interface deixa claro quando já existe RDO na data.' },
    { q: 'Preciso cadastrar todas as pessoas e máquinas antes?', a: 'Não. Você pode lançar avulso durante o RDO (nome ou código digitado na hora) ou vincular ao cadastro da configuração.' },
    { q: 'Uma empresa consegue ver dados da outra?', a: 'Não. O isolamento é aplicado em toda listagem, consulta, criação e atualização. Tentativas de acesso cruzado respondem como se o recurso não existisse.' },
  ]
  return (
    <section id="faq" className="border-b border-border">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Perguntas</p>
          <h2 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">Antes de entrar.</h2>
        </div>
        <dl className="divide-y divide-border border-y border-border">
          {items.map((it) => (
            <div key={it.q} className="grid gap-2 py-6 md:grid-cols-[1fr_1.5fr] md:gap-8">
              <dt className="font-display text-base font-semibold text-ink">{it.q}</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{it.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function CtaFooter() {
  return (
    <section className="relative overflow-hidden bg-ink text-background">
      <div className="grid-blueprint absolute inset-0 opacity-20" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-6 py-24 text-center">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-signal">Acesso restrito</p>
        <h2 className="mx-auto max-w-3xl font-display text-4xl font-bold tracking-tight md:text-6xl">
          Sua obra já está esperando pelo RDO de hoje.
        </h2>
        <div className="mt-10 flex justify-center">
          <a
            href="#entrar"
            className="inline-flex items-center gap-3 rounded-md bg-background px-6 py-3.5 text-sm font-semibold text-ink shadow-xl transition-transform hover:-translate-y-px"
          >
            <GoogleMark />
            Fazer Login com o Google
          </a>
        </div>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-background/50">
          Somente contas Google previamente cadastradas
        </p>

        <div className="mt-24 flex flex-col items-center justify-between gap-6 border-t border-background/10 pt-8 md:flex-row">
          <Logo onDark />
          <div className="flex gap-6 font-mono text-[11px] uppercase tracking-widest text-background/50">
            <span>© 2026 BuildFlow</span>
            <a href="#" className="hover:text-background">Privacidade</a>
            <a href="#" className="hover:text-background">Termos</a>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/login.spec.ts
```
Expected: exit 0, 3 passed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "refactor: migra a tela de login para Tailwind CSS"
```

---

### Task 6: Migrar `ProjetosListPage.tsx` + `ProjetoForm.tsx`

**Files:**
- Modify: `frontend/src/pages/ProjetosListPage.tsx`, `frontend/src/features/projetos/ProjetoForm.tsx`

**Interfaces:**
- Consumes: `Alert`, `Card`, `PageHeader`, `Spinner`, `EmptyState`, `FormField`, `Button`, `Input`, `Textarea` from `../components/ui` (Tasks 2-3).
- No change to `useProjetos`, `useCriarProjeto`, `projetoFormSchema`, or the `ProjetoForm` `onCreated` prop.

- [ ] **Step 1: Rewrite `ProjetosListPage.tsx`**

```tsx
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
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
        <Alert>
          <p className="mb-2">Não foi possível carregar os projetos.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </Alert>
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

- [ ] **Step 2: Rewrite `ProjetoForm.tsx`'s `return` block** (keep lines 1-33: imports, state, `handleSubmit` unchanged)

```tsx
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

Update the import line to: `import { Alert, Button, FormField, Input, Textarea } from '../../components/ui'`.

- [ ] **Step 3: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/projetos.spec.ts
```
Expected: exit 0, 2 passed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProjetosListPage.tsx frontend/src/features/projetos/ProjetoForm.tsx
git commit -m "refactor: migra listagem e criacao de projetos para Tailwind"
```

---

### Task 7: Migrar `RegistrosDiariosListPage.tsx`

**Files:**
- Modify: `frontend/src/pages/RegistrosDiariosListPage.tsx`

**Interfaces:**
- Consumes: `Alert`, `PageHeader`, `Spinner`, `EmptyState`, `Button` from `../components/ui`. No change to `useRegistrosDiarios`.

- [ ] **Step 1: Rewrite the file**

```tsx
import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, EmptyState, PageHeader, Spinner } from '../components/ui'
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
          <Button asChild className="gap-2">
            <Link to={`/projetos/${projetoId}/registros-diarios/novo`}>
              <Plus size={16} aria-hidden="true" />
              Novo registro diário
            </Link>
          </Button>
        }
      />

      {isLoading && <Spinner label="Carregando registros…" />}

      {isError && (
        <Alert>
          <p className="mb-2">Não foi possível carregar os registros diários.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <EmptyState>Nenhum registro diário ainda. Crie o primeiro para começar.</EmptyState>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Lista de registros diários">
          {data.results.map((registro) => (
            <li key={registro.id} className="px-4 py-3 hover:bg-surface">
              <Link to={`/projetos/${projetoId}/registros-diarios/${registro.id}`} className="text-sm font-medium text-ink">
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

Note: `Button asChild` requires the `Button` component to support the shadcn `asChild` pattern (it does — ported verbatim in Task 2, using Radix `Slot`) so it renders as the wrapped `<Link>` (an `<a>`) instead of a `<button>`, keeping this an actual link element as before (`getByRole('link', ...)` in the E2E spec depends on this).

- [ ] **Step 2: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/registros-list.spec.ts
```
Expected: exit 0, 2 passed.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RegistrosDiariosListPage.tsx
git commit -m "refactor: migra listagem de registros diarios para Tailwind"
```

---

### Task 8: Migrar `RegistroDiarioDetailPage.tsx` + `FotoUpload.tsx`

**Files:**
- Modify: `frontend/src/pages/RegistroDiarioDetailPage.tsx`, `frontend/src/features/registros-diarios/FotoUpload.tsx`

**Interfaces:**
- Consumes: `Alert`, `Card`, `PageHeader`, `Spinner`, `EmptyState`, `Button`, `FormField`, `Input` from `../components/ui`.

- [ ] **Step 1: Rewrite `RegistroDiarioDetailPage.tsx`**

```tsx
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
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
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
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
          <Button asChild variant="outline" size="sm">
            <Link to={`/projetos/${projetoId}/registros-diarios`}>Voltar para a lista</Link>
          </Button>
        }
      />

      <Card title="Gerais">
        <p className="text-sm">Turno: {registro.turno}</p>
        <p className="text-sm">Clima: {registro.clima}</p>
      </Card>

      <Card title="Produção">
        <ul className="divide-y divide-border" aria-label="Produção">
          {registro.producoes.map((producao, index) => (
            <li className="py-2 text-sm" key={index}>
              {producao.rodovia} — km {producao.km_inicial} a {producao.km_final} — {producao.quantidade}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Equipe">
        <ul className="divide-y divide-border" aria-label="Presenças">
          {registro.presencas.map((presenca, index) => (
            <li className="py-2 text-sm" key={index}>
              {presenca.nome_avulso || presenca.pessoa} — {presenca.funcao} ({presenca.status})
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Máquinas">
        <ul className="divide-y divide-border" aria-label="Máquinas">
          {registro.maquinas.map((maquina, index) => (
            <li className="py-2 text-sm" key={index}>
              {maquina.identificacao_avulsa || maquina.maquina} — {maquina.horas_produtivas}h produtivas /{' '}
              {maquina.horas_paradas}h paradas
            </li>
          ))}
        </ul>
      </Card>

      {registro.ocorrencias.length > 0 && (
        <Card title="Ocorrências">
          <ul className="divide-y divide-border" aria-label="Ocorrências">
            {registro.ocorrencias.map((ocorrencia, index) => (
              <li className="py-2 text-sm" key={index}>
                {ocorrencia.tipo}: {ocorrencia.descricao}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Fotos">
        {registro.fotos.length === 0 && <EmptyState>Nenhuma foto anexada ainda.</EmptyState>}
        <div className="mb-4 flex flex-wrap gap-4" aria-label="Fotos">
          {registro.fotos.map((foto) => (
            <figure className="m-0" key={foto.id}>
              <img src={foto.arquivo} alt="" width={120} className="rounded-md" />
              {foto.km && <figcaption className="text-xs text-muted-foreground">km {foto.km}</figcaption>}
            </figure>
          ))}
        </div>
        <FotoUpload registroId={registro.id} />
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Rewrite `FotoUpload.tsx`'s `return` block** (keep lines 1-33: imports, state, handlers unchanged except the import line)

```tsx
  return (
    <div aria-label="Anexar foto">
      <FormField id="foto-arquivo" label="Foto">
        <Input id="foto-arquivo" type="file" accept="image/*" onChange={handleFileChange} />
      </FormField>

      {preview && <img src={preview} alt="Pré-visualização da foto" width={120} className="mb-3 rounded-md" />}

      <FormField id="foto-km" label="Km (opcional)">
        <Input id="foto-km" value={km} onChange={(event) => setKm(event.target.value)} />
      </FormField>

      <Button onClick={handleEnviar} disabled={!arquivo || enviarFoto.isPending}>
        {enviarFoto.isPending ? 'Enviando…' : 'Anexar foto'}
      </Button>

      {enviarFoto.isError && <Alert>Não foi possível enviar a foto.</Alert>}
    </div>
  )
}
```

Update the import line to: `import { Alert, Button, FormField, Input } from '../../components/ui'`.

- [ ] **Step 3: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/rdo.spec.ts
```
Expected: exit 0, 2 passed (this spec also exercises the still-Bootstrap-classed `RdoPage.tsx` until Task 9 — that's fine, functionality is unaffected by stale classNames).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/RegistroDiarioDetailPage.tsx frontend/src/features/registros-diarios/FotoUpload.tsx
git commit -m "refactor: migra detalhe do registro diario e upload de foto para Tailwind"
```

---

### Task 9: Migrar `RdoPage.tsx`

**Files:**
- Modify: `frontend/src/pages/RdoPage.tsx`

**Interfaces:**
- Consumes: `Alert`, `Card`, `FormField`, `SelectField`, `PageHeader`, `Spinner`, `Button`, `Input` from `../components/ui`.
- No change to `PRODUCAO_VAZIA`/`PRESENCA_VAZIA`/`MAQUINA_VAZIA`/`OCORRENCIA_VAZIA`, any `useState`, the fiscal-prefill `useEffect`, or `handleSubmit`/`registroDiarioFormSchema.safeParse` — only the returned JSX.

- [ ] **Step 1: Keep lines 1-114 unchanged** (imports through the end of `handleSubmit`), except update the `components/ui` import to:
```tsx
import { Alert, Button, Card, FormField, Input, PageHeader, SelectField, Spinner } from '../components/ui'
```
and replace the loading/error early-returns:
```tsx
  if (configuracao.isLoading) return <Spinner label="Carregando…" />
  if (configuracao.isError || !configuracao.data) {
    return <Alert>Não foi possível carregar os cadastros do projeto.</Alert>
  }
```

- [ ] **Step 2: Replace the returned JSX (everything from `return (` to the end of the file)**

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5" aria-label="Dados gerais">
          <FormField id="rdo-data" label="Data">
            <Input
              id="rdo-data"
              type="date"
              value={dataReferencia}
              onChange={(event) => setDataReferencia(event.target.value)}
            />
          </FormField>
          <SelectField
            id="rdo-turno"
            label="Turno"
            value={turno}
            onChange={(value) => setTurno(value as typeof turno)}
            options={[
              { value: 'diurno', label: 'Diurno' },
              { value: 'noturno', label: 'Noturno' },
            ]}
          />
          <SelectField
            id="rdo-clima"
            label="Clima"
            value={clima}
            onChange={(value) => setClima(value as typeof clima)}
            options={[
              { value: 'sol', label: 'Sol' },
              { value: 'nublado', label: 'Nublado' },
              { value: 'chuva', label: 'Chuva' },
              { value: 'chuva_forte', label: 'Chuva forte' },
            ]}
          />
          <SelectField
            id="rdo-equipe"
            label="Equipe"
            value={equipe}
            onChange={setEquipe}
            options={equipes.map((item) => ({ value: item.id, label: item.nome }))}
          />
          <SelectField
            id="rdo-fiscal"
            label="Fiscal"
            value={fiscal}
            onChange={setFiscal}
            options={fiscais.map((item) => ({ value: String(item.id), label: `${item.nome} (${item.email})` }))}
          />
        </div>
      </Card>

      <Card title="Produção">
        <div aria-label="Produção do dia">
          {producoes.map((producao, index) => (
            <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormField id={`producao-rodovia-${index}`} label="Rodovia">
                  <Input
                    id={`producao-rodovia-${index}`}
                    value={producao.rodovia}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, rodovia: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <SelectField
                  id={`producao-disciplina-${index}`}
                  label="Disciplina"
                  value={producao.disciplina}
                  onChange={(value) =>
                    setProducoes((current) =>
                      current.map((item, i) => (i === index ? { ...item, disciplina: value, servico: '' } : item)),
                    )
                  }
                  options={disciplinas.map((disciplina) => ({ value: disciplina.id, label: disciplina.nome }))}
                />
                <SelectField
                  id={`producao-servico-${index}`}
                  label="Serviço"
                  value={producao.servico}
                  onChange={(value) =>
                    setProducoes((current) => current.map((item, i) => (i === index ? { ...item, servico: value } : item)))
                  }
                  options={
                    disciplinas.find((d) => d.id === producao.disciplina)?.servicos.map((servico) => ({
                      value: servico.id,
                      label: servico.nome,
                    })) ?? []
                  }
                />
                <FormField id={`producao-km-inicial-${index}`} label="Km inicial">
                  <Input
                    id={`producao-km-inicial-${index}`}
                    value={producao.km_inicial}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, km_inicial: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <FormField id={`producao-km-final-${index}`} label="Km final">
                  <Input
                    id={`producao-km-final-${index}`}
                    value={producao.km_final}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, km_final: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <FormField id={`producao-quantidade-${index}`} label="Quantidade">
                  <Input
                    id={`producao-quantidade-${index}`}
                    value={producao.quantidade}
                    onChange={(event) =>
                      setProducoes((current) =>
                        current.map((item, i) => (i === index ? { ...item, quantidade: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <SelectField
                  id={`producao-unidade-${index}`}
                  label="Unidade"
                  value={producao.unidade ? String(producao.unidade) : ''}
                  onChange={(value) =>
                    setProducoes((current) =>
                      current.map((item, i) => (i === index ? { ...item, unidade: Number(value) } : item)),
                    )
                  }
                  options={unidades.map((unidade) => ({ value: String(unidade.id), label: unidade.sigla }))}
                />
              </div>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => setProducoes((current) => [...current, PRODUCAO_VAZIA])}>
            + Adicionar produção
          </Button>
        </div>
      </Card>

      <Card title="Equipe">
        <div aria-label="Equipe / presença">
          {presencas.map((presenca, index) => (
            <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SelectField
                  id={`presenca-pessoa-${index}`}
                  label="Pessoa cadastrada"
                  value={presenca.pessoa ?? ''}
                  onChange={(value) => {
                    setPresencas((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, pessoa: value || undefined, nome_avulso: value ? '' : item.nome_avulso } : item,
                      ),
                    )
                  }}
                  placeholder="Avulso (digitar nome)"
                  options={(equipeSelecionada?.pessoas ?? []).map((pessoa) => ({ value: pessoa.id, label: pessoa.nome }))}
                />
                {!presenca.pessoa && (
                  <FormField id={`presenca-nome-avulso-${index}`} label="Nome (avulso)">
                    <Input
                      id={`presenca-nome-avulso-${index}`}
                      value={presenca.nome_avulso ?? ''}
                      onChange={(event) =>
                        setPresencas((current) =>
                          current.map((item, i) => (i === index ? { ...item, nome_avulso: event.target.value } : item)),
                        )
                      }
                    />
                  </FormField>
                )}
                <FormField id={`presenca-funcao-${index}`} label="Função">
                  <Input
                    id={`presenca-funcao-${index}`}
                    value={presenca.funcao}
                    onChange={(event) =>
                      setPresencas((current) =>
                        current.map((item, i) => (i === index ? { ...item, funcao: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <SelectField
                  id={`presenca-status-${index}`}
                  label="Status"
                  value={presenca.status}
                  onChange={(value) =>
                    setPresencas((current) =>
                      current.map((item, i) => (i === index ? { ...item, status: value as PresencaInput['status'] } : item)),
                    )
                  }
                  options={[
                    { value: 'presente', label: 'Presente' },
                    { value: 'falta', label: 'Falta' },
                    { value: 'atestado', label: 'Atestado' },
                  ]}
                />
              </div>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => setPresencas((current) => [...current, PRESENCA_VAZIA])}>
            + Adicionar pessoa
          </Button>
        </div>
      </Card>

      <Card title="Máquinas">
        <div aria-label="Máquinas">
          {maquinas.map((maquina, index) => (
            <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SelectField
                  id={`maquina-maquina-${index}`}
                  label="Máquina cadastrada"
                  value={maquina.maquina ?? ''}
                  onChange={(value) => {
                    setMaquinas((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, maquina: value || undefined, identificacao_avulsa: value ? '' : item.identificacao_avulsa }
                          : item,
                      ),
                    )
                  }}
                  placeholder="Avulso (digitar identificação)"
                  options={(equipeSelecionada?.maquinas ?? []).map((maq) => ({ value: maq.id, label: maq.nome }))}
                />
                {!maquina.maquina && (
                  <FormField id={`maquina-identificacao-${index}`} label="Identificação (avulsa)">
                    <Input
                      id={`maquina-identificacao-${index}`}
                      value={maquina.identificacao_avulsa ?? ''}
                      onChange={(event) =>
                        setMaquinas((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, identificacao_avulsa: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </FormField>
                )}
                <FormField id={`maquina-horas-produtivas-${index}`} label="Horas produtivas">
                  <Input
                    id={`maquina-horas-produtivas-${index}`}
                    value={maquina.horas_produtivas}
                    onChange={(event) =>
                      setMaquinas((current) =>
                        current.map((item, i) => (i === index ? { ...item, horas_produtivas: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                <FormField id={`maquina-horas-paradas-${index}`} label="Horas paradas">
                  <Input
                    id={`maquina-horas-paradas-${index}`}
                    value={maquina.horas_paradas}
                    onChange={(event) =>
                      setMaquinas((current) =>
                        current.map((item, i) => (i === index ? { ...item, horas_paradas: event.target.value } : item)),
                      )
                    }
                  />
                </FormField>
                {Number(maquina.horas_paradas) > 0 && (
                  <SelectField
                    id={`maquina-motivo-parada-${index}`}
                    label="Motivo da parada"
                    value={maquina.motivo_parada ? String(maquina.motivo_parada) : ''}
                    onChange={(value) =>
                      setMaquinas((current) =>
                        current.map((item, i) => (i === index ? { ...item, motivo_parada: Number(value) } : item)),
                      )
                    }
                    options={motivosParada.map((motivo) => ({ value: String(motivo.id), label: motivo.descricao }))}
                  />
                )}
              </div>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => setMaquinas((current) => [...current, MAQUINA_VAZIA])}>
            + Adicionar máquina
          </Button>
        </div>
      </Card>

      <Card title="Ocorrências">
        <div aria-label="Ocorrências">
          {ocorrencias.map((ocorrencia, index) => (
            <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
              <FormField id={`ocorrencia-descricao-${index}`} label="Descrição">
                <textarea
                  id={`ocorrencia-descricao-${index}`}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                  value={ocorrencia.descricao}
                  onChange={(event) =>
                    setOcorrencias((current) =>
                      current.map((item, i) => (i === index ? { ...item, descricao: event.target.value } : item)),
                    )
                  }
                />
              </FormField>
            </fieldset>
          ))}
          <Button variant="outline" onClick={() => setOcorrencias((current) => [...current, OCORRENCIA_VAZIA])}>
            + Adicionar ocorrência
          </Button>
        </div>
      </Card>

      {erro && <Alert>{erro}</Alert>}

      <Button size="lg" className="mb-8" onClick={handleSubmit} disabled={criarRegistro.isPending}>
        {criarRegistro.isPending ? 'Salvando…' : 'Salvar registro diário'}
      </Button>
    </main>
  )
}
```

Notes on deliberate choices (so a reviewer doesn't flag them as unexplained deviations):
- Every dynamic-row field now has a stable, index-derived `id` (e.g. `producao-rodovia-${index}`) instead of the previous Bootstrap version's id-less `<label>Text<input/></label>` nesting. This is required here because `FormField`/`SelectField` both render an explicit `<Label htmlFor={id}>`, which needs a real, unique `id` to associate with — unlike the Bootstrap version, which relied on implicit nesting specifically to avoid needing per-row ids. Check `frontend/tests/e2e/rdo.spec.ts` for `getByLabel(...)` usage before assuming this is safe: it must resolve the SAME way it did before (each `getByLabel('Rodovia')` etc. call in the spec doesn't index rows explicitly, so Playwright's `getByLabel` matches by accessible name across however many matching labeled fields exist — if the spec's existing calls used `.first()`/`.nth()` or matched by container scoping, confirm those still resolve correctly with real `id`s instead of implicit nesting; if a test fails here, it's almost certainly because a `getByLabel` call was relying on there being exactly one visible match at the time and now still should, since only one row exists per section in the test's fixtures — verify against the actual spec file, don't assume).
- `SelectField`'s `placeholder` is used instead of an empty-string `<option>` for the "Avulso" cases (Pessoa/Máquina) and the generic "Selecione…" cases, per Task 3's note about Radix `Select.Item` rejecting empty-string values.

- [ ] **Step 3: Check `rdo.spec.ts`'s exact locators before trusting Step 2's id scheme**

```bash
grep -n "getByLabel\|getByRole('combobox'\|getByRole('textbox'" frontend/tests/e2e/rdo.spec.ts
```
Compare each call against the `id`/`label` pairs introduced in Step 2. Fix any mismatch (e.g., if the spec expects a specific field to be found via a different accessible name) before moving on.

- [ ] **Step 4: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/rdo.spec.ts
```
Expected: exit 0, 2 passed (full RDO creation wizard flow + the avulso→cadastro field-clearing regression test).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/RdoPage.tsx
git commit -m "refactor: migra formulario de RDO para Tailwind com SelectField"
```

---

### Task 10: Migrar `ConfiguracaoPage.tsx`

**Files:**
- Modify: `frontend/src/pages/ConfiguracaoPage.tsx`

**Interfaces:**
- Consumes: `Alert`, `Card`, `FormField`, `SelectField`, `PageHeader`, `Spinner`, `EmptyState`, `Button`, `Input` from `../components/ui`.
- No change to any `useState`, the 6 mutation hooks, or their call signatures — only JSX/markup.

- [ ] **Step 1: Keep lines 1-53 unchanged** except update the import and the loading/error guard:
```tsx
import { Alert, Button, Card, EmptyState, FormField, Input, PageHeader, SelectField, Spinner } from '../components/ui'
```
```tsx
  if (configuracao.isLoading) return <Spinner label="Carregando…" />
  if (configuracao.isError || !configuracao.data) {
    return (
      <Alert>
        <p className="mb-2">Não foi possível carregar a configuração do projeto.</p>
        <Button variant="outline" size="sm" onClick={() => void configuracao.refetch()}>
          Tentar novamente
        </Button>
      </Alert>
    )
  }
```

- [ ] **Step 2: Replace the returned JSX**

```tsx
  return (
    <main aria-label="Configurações do projeto">
      <PageHeader title="Configurações" breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Configurações' }]} />

      <Card title="Disciplinas">
        <div aria-label="Disciplinas">
          {disciplinas.length === 0 && <EmptyState>Nenhuma disciplina cadastrada ainda.</EmptyState>}
          <ul className="mb-4 divide-y divide-border">
            {disciplinas.map((disciplina) => (
              <li className="py-2 text-sm" key={disciplina.id}>{disciplina.nome}</li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <FormField id="nova-disciplina" label="Nova disciplina">
              <Input id="nova-disciplina" value={nomeDisciplina} onChange={(event) => setNomeDisciplina(event.target.value)} />
            </FormField>
            <Button
              onClick={() => criarDisciplina.mutate(nomeDisciplina, { onSuccess: () => setNomeDisciplina('') })}
              disabled={!nomeDisciplina.trim() || criarDisciplina.isPending}
            >
              Adicionar disciplina
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Metas">
        <div aria-label="Metas">
          {metas.length === 0 && <EmptyState>Nenhuma meta cadastrada ainda.</EmptyState>}
          <ul className="mb-4 divide-y divide-border">
            {metas.map((meta) => (
              <li className="py-2 text-sm" key={meta.id}>
                {disciplinas.find((d) => d.id === meta.disciplina)?.nome ?? meta.disciplina}: {meta.valor_alvo}
                {meta.peso_percentual ? ` (${meta.peso_percentual}%)` : ''}
              </li>
            ))}
          </ul>
          <p className="mb-4 text-sm text-muted-foreground">
            Soma dos pesos: {somaPesos}%{' '}
            {Math.abs(somaPesos - 100) > 0.01 && somaPesos > 0 && '(atenção: não fecha 100%)'}
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <SelectField
              id="meta-disciplina"
              label="Disciplina"
              value={metaDisciplinaId}
              onChange={setMetaDisciplinaId}
              options={disciplinas.map((disciplina) => ({ value: disciplina.id, label: disciplina.nome }))}
            />
            <FormField id="meta-valor" label="Valor alvo">
              <Input id="meta-valor" value={metaValorAlvo} onChange={(event) => setMetaValorAlvo(event.target.value)} />
            </FormField>
            <FormField id="meta-peso" label="Peso (%)">
              <Input id="meta-peso" value={metaPeso} onChange={(event) => setMetaPeso(event.target.value)} />
            </FormField>
            <div className="flex items-end">
              <Button
                className="w-full"
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
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Equipes">
        <div aria-label="Equipes">
          {equipes.length === 0 && <EmptyState>Nenhuma equipe cadastrada ainda.</EmptyState>}
          <ul className="mb-4 divide-y divide-border">
            {equipes.map((equipe) => (
              <li className="py-2 text-sm" key={equipe.id}>
                <strong className="text-ink">{equipe.nome}</strong>
                <ul className="mt-1 pl-4 text-muted-foreground">
                  {equipe.pessoas.map((pessoa) => (
                    <li key={pessoa.id}>{pessoa.nome} — {pessoa.funcao}</li>
                  ))}
                  {equipe.maquinas.map((maquina) => (
                    <li key={maquina.id}>{maquina.nome} ({maquina.codigo})</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="mb-6 flex flex-wrap items-end gap-3">
            <FormField id="nova-equipe" label="Nova equipe">
              <Input id="nova-equipe" value={nomeEquipe} onChange={(event) => setNomeEquipe(event.target.value)} />
            </FormField>
            <Button
              disabled={!nomeEquipe.trim() || criarEquipe.isPending}
              onClick={() => criarEquipe.mutate(nomeEquipe, { onSuccess: () => setNomeEquipe('') })}
            >
              Adicionar equipe
            </Button>
          </div>

          <h5 className="mb-3 font-display text-sm font-semibold text-ink">Adicionar pessoa</h5>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <SelectField
              id="pessoa-equipe"
              label="Equipe"
              value={pessoaEquipeId}
              onChange={setPessoaEquipeId}
              options={equipes.map((equipe) => ({ value: equipe.id, label: equipe.nome }))}
            />
            <FormField id="pessoa-nome" label="Nome">
              <Input id="pessoa-nome" value={pessoaNome} onChange={(event) => setPessoaNome(event.target.value)} />
            </FormField>
            <FormField id="pessoa-funcao" label="Função">
              <Input id="pessoa-funcao" value={pessoaFuncao} onChange={(event) => setPessoaFuncao(event.target.value)} />
            </FormField>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!pessoaEquipeId || !pessoaNome.trim() || criarPessoa.isPending}
                onClick={() =>
                  criarPessoa.mutate(
                    { equipeId: pessoaEquipeId, nome: pessoaNome, funcao: pessoaFuncao },
                    { onSuccess: () => { setPessoaNome(''); setPessoaFuncao('') } },
                  )
                }
              >
                Adicionar pessoa
              </Button>
            </div>
          </div>

          <h5 className="mb-3 font-display text-sm font-semibold text-ink">Adicionar máquina</h5>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <SelectField
              id="maquina-equipe"
              label="Equipe"
              value={maquinaEquipeId}
              onChange={setMaquinaEquipeId}
              options={equipes.map((equipe) => ({ value: equipe.id, label: equipe.nome }))}
            />
            <FormField id="maquina-codigo" label="Código">
              <Input id="maquina-codigo" value={maquinaCodigo} onChange={(event) => setMaquinaCodigo(event.target.value)} />
            </FormField>
            <FormField id="maquina-nome" label="Nome">
              <Input id="maquina-nome" value={maquinaNome} onChange={(event) => setMaquinaNome(event.target.value)} />
            </FormField>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!maquinaEquipeId || !maquinaNome.trim() || criarMaquina.isPending}
                onClick={() =>
                  criarMaquina.mutate(
                    { equipeId: maquinaEquipeId, codigo: maquinaCodigo, nome: maquinaNome },
                    { onSuccess: () => { setMaquinaCodigo(''); setMaquinaNome('') } },
                  )
                }
              >
                Adicionar máquina
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Valores">
        <div aria-label="Valores de custo">
          {valoresCusto.length === 0 && <EmptyState>Nenhum valor cadastrado ainda.</EmptyState>}
          <ul className="mb-4 divide-y divide-border">
            {valoresCusto.map((valor) => (
              <li className="py-2 text-sm" key={valor.id}>{valor.descricao} ({valor.tipo}): {valor.valor}</li>
            ))}
          </ul>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <SelectField
              id="valor-tipo"
              label="Tipo"
              value={valorTipo}
              onChange={(value) => setValorTipo(value as typeof valorTipo)}
              options={[
                { value: 'mao_de_obra', label: 'Mão de obra' },
                { value: 'equipamento', label: 'Equipamento' },
              ]}
            />
            <FormField id="valor-descricao" label="Descrição">
              <Input id="valor-descricao" value={valorDescricao} onChange={(event) => setValorDescricao(event.target.value)} />
            </FormField>
            <FormField id="valor-valor" label="Valor">
              <Input id="valor-valor" value={valorValor} onChange={(event) => setValorValor(event.target.value)} />
            </FormField>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!valorDescricao.trim() || !valorValor || criarValorCusto.isPending}
                onClick={() =>
                  criarValorCusto.mutate(
                    { tipo: valorTipo, descricao: valorDescricao, valor: valorValor },
                    { onSuccess: () => { setValorDescricao(''); setValorValor('') } },
                  )
                }
              >
                Adicionar valor
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Verify**

```bash
cd frontend && npx tsc -b --noEmit && npx playwright test tests/e2e/config.spec.ts
```
Expected: exit 0, 1 passed. If `getByRole('listitem').filter({ hasText: ... })` fails, confirm plain `<li>` elements (no `list-group-item` class needed — Tailwind doesn't require a class for `<li>` to have `role="listitem"`, that's an implicit native role) still resolve — they should.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ConfiguracaoPage.tsx
git commit -m "refactor: migra pagina de configuracoes para Tailwind"
```

---

### Task 11: Verificação final e limpeza

**Files:** none expected beyond possible small fixes found during verification.

- [ ] **Step 1: Full check suite**

```bash
cd frontend
npm run lint
npx tsc -b --noEmit
npm run build
npm run test
npm run test:e2e
```
Expected: every command exits 0, including all 10 E2E tests.

- [ ] **Step 2: Confirm no Bootstrap/Mazer residue anywhere**

```bash
grep -rn "bootstrap\|btn btn-\|form-control\|form-select\|list-group" frontend/src --include="*.tsx" --include="*.ts" --include="*.css"
grep -n "bootstrap\|sass" frontend/package.json
```
Expected: no output from either command. If something remains, it's a page/file this plan's tasks missed — fix it (apply the same Tailwind/shadcn translation pattern used in Tasks 5-10) before proceeding.

- [ ] **Step 3: Confirm the dark-mode toggle actually works end-to-end** (the previous design system shipped with a real regression here — the Mazer sidebar stayed light in dark mode because its colors were compile-time SCSS variables, not runtime-adaptive; this plan's `Sidebar`/`Topbar` from Task 4 use only theme-token-driven Tailwind classes — `bg-background`, `text-ink`, `border-border`, etc. — which flip automatically via the `.dark` class, and the visible toggle lives in `Topbar` — but verify rather than assume)

Manually (`npm run dev`, log in, click the sun/moon button in the Topbar) or via a quick Playwright script: confirm `document.documentElement.classList.contains('dark')` toggles on click, and that the Sidebar/Topbar backgrounds and text actually change color along with the page content — not just the content area.

- [ ] **Step 4: Commit only if Steps 2-3 required a fix — otherwise skip**

```bash
git add -A frontend/src
git commit -m "fix: remove residuos de Bootstrap encontrados na verificacao final"
```

- [ ] **Step 5: Update `README.md`'s Stack section**

Change:
```markdown
- **Frontend**: React 18 + TypeScript, Vite, TanStack Query, Zod, React Router. UI com Bootstrap 5 e o
  design system [Mazer](https://github.com/zuramai/mazer) (SCSS, tema claro/escuro), layouts e
  componentes isolados em `frontend/src/layouts/` e `frontend/src/components/ui/`.
```
to:
```markdown
- **Frontend**: React 18 + TypeScript, Vite, TanStack Query, Zod, React Router. UI com Tailwind CSS v4 +
  shadcn/ui (tokens OKLCH, tema claro/escuro), layouts e componentes isolados em
  `frontend/src/layouts/` e `frontend/src/components/ui/`.
```

```bash
git add README.md
git commit -m "docs: atualiza stack do frontend para Tailwind + shadcn/ui"
```
