# Polish SaaS Profissional — Onda 1 (Motion + Skeleton) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundação de polimento: tokens de motion consistentes, feedback de hover/press nos
botões, e skeleton loaders substituindo o spinner genérico nas 6 telas de carregamento de
página (a `LoginPage` mantém `Spinner` para o botão de login — feedback inline, não carregamento
de página, fora de escopo).

**Architecture:** Tokens novos em `app.css` (`--duration-fast`, `--duration-base`,
`--ease-emphasized`) — Tailwind v4 gera utilities (`duration-fast`, `ease-emphasized`)
automaticamente a partir do namespace `@theme inline`. `Button` ganha feedback de hover/press
usando esses tokens. `Skeleton` (componente shadcn já existente em
`components/ui/skeleton.tsx`, nunca adotado) entra no barrel e ganha uma composição local por
página, substituindo `<Spinner label="..."/>` nos 6 lugares que carregam uma tela inteira.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Playwright.

## Global Constraints

- Zero mudança de dado/comportamento: os skeletons substituem só o estado de carregamento visual —
  a mesma condição (`isLoading`) continua controlando quando aparecem.
- Nenhum teste e2e hoje verifica o estado de loading/Spinner diretamente (confirmado por busca no
  repo) — trocar por skeleton não quebra nenhuma asserção existente.
- `LoginPage.tsx` **não muda** — seus 2 usos de `Spinner` são feedback inline do botão de login
  (não carregamento de página), fora de escopo desta onda.
- Todo skeleton mantém o anúncio de carregamento pra leitor de tela (`<span role="status"
  className="sr-only">`) — e esse span **nunca pode ser descendente** de um elemento com
  `aria-hidden="true"` (remove a subárvore inteira da árvore de acessibilidade, independente do
  `role` dos filhos). Lição da Task 2: a primeira tentativa colocou o span dentro do
  `aria-hidden`, virando um no-op — corrigido movendo o span pra fora, como irmão dentro de um
  Fragment.
- Feedback de hover/press (`hover:-translate-y-px`, `active:scale-[0.98]`) não se aplica à
  variante `link` do `Button` (texto sublinhado não deve "levantar" nem "encolher" visualmente).
- Nunca usar `--no-verify`; commits novos ao invés de amend.

---

### Task 1: Tokens de motion + feedback de hover/press no `Button`

**Files:**
- Modify: `frontend/src/app.css`
- Modify: `frontend/src/components/ui/button.tsx`

**Interfaces:**
- Produces: utilities Tailwind `duration-fast`, `duration-base`, `ease-emphasized` (geradas
  automaticamente pelo `@theme inline` a partir dos novos tokens).

- [ ] **Step 1: Adicionar os tokens de motion em `app.css`**

No bloco `@theme inline` (arquivo `frontend/src/app.css`), logo após a última linha
(`--color-signal: var(--signal);`), adicionar:

```css
  --transition-duration-fast: 120ms;
  --transition-duration-base: 200ms;
  --ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
```

(Nome `ease-emphasized` deliberado, não `ease-out` — Tailwind já tem um `ease-out` padrão com
outra curva; reaproveitar o nome sobrescreveria esse valor pra todo o app. `ease-emphasized` é o
nome que o Material Design usa pra esse tipo de curva, evita colisão.

Nome da chave do tema `--transition-duration-*`, não `--duration-*` — descoberto na revisão da
Task 1: o utility `duration-*` do Tailwind v4 resolve contra o namespace `--transition-duration-*`
especificamente, não `--duration-*`; usar o nome errado faz o utility compilar silenciosamente
para nada, sem erro de build. As classes usadas no `button.tsx` continuam `duration-fast`/
`duration-base` normalmente — só a chave declarada aqui no `@theme` precisa do prefixo
`transition-`.)

- [ ] **Step 2: Atualizar `button.tsx`**

Substituir a string base de `buttonVariants` e as 6 variantes:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-all duration-fast ease-emphasized active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90 hover:-translate-y-px",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:-translate-y-px",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground hover:-translate-y-px",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:-translate-y-px",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

(Mudanças: `transition-colors` → `transition-all duration-fast ease-emphasized` na base — precisa
ser `transition-all` porque `transform` e cor não podem ser combinados em duas utilities
`transition-*` diferentes ao mesmo tempo, elas se sobrescrevem; `active:scale-[0.98]` na base;
`hover:-translate-y-px` em `default`/`destructive`/`outline`/`secondary` — não em `ghost`, que
normalmente fica em toolbars/botões de ícone onde "levantar" no hover destoa; `link` ganha
`active:scale-100` pra cancelar o `active:scale-[0.98]` da base, já que texto sublinhado não deve
encolher.)

- [ ] **Step 3: Build + regressão completa**

Run: `cd frontend && npm run build && npx playwright test`
Expected: build exit 0; suíte completa passando (mudança é só CSS/classe, nenhum teste depende de
classes específicas de motion).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app.css frontend/src/components/ui/button.tsx
git commit -m "feat: adiciona tokens de motion e feedback de hover/press ao Button"
```

---

### Task 2: Skeleton loaders — Dashboard, Projetos, Calendário

**Files:**
- Modify: `frontend/src/components/ui/index.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/ProjetosListPage.tsx`
- Modify: `frontend/src/pages/RegistrosDiariosListPage.tsx`

**Interfaces:**
- Consumes: `Skeleton` (componente já existente em `frontend/src/components/ui/skeleton.tsx`,
  `animate-pulse` + `bg-primary/10`, ainda não exportado no barrel nem usado em nenhuma página).

- [ ] **Step 1: Exportar `Skeleton` no barrel**

Adicionar ao final de `frontend/src/components/ui/index.ts`:

```typescript
export { Skeleton } from './skeleton'
```

- [ ] **Step 2: `DashboardPage.tsx` — skeleton das tiles + gráficos**

Trocar o import (linha 3, remover `Spinner`, adicionar `Skeleton`):

```tsx
import { Badge, Card, EmptyState, ErrorRetry, PageHeader, Progress, Skeleton } from '../components/ui'
```

Adicionar o componente local (antes de `export function DashboardPage()`):

```tsx
function DashboardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-md border border-dashed border-border p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="mb-6 rounded-lg border border-border p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-[220px] w-full" />
      </div>
    </div>
  )
}
```

Trocar a linha `{isLoading && <Spinner label="Carregando dashboard…" />}` por:

```tsx
{isLoading && <DashboardSkeleton />}
```

- [ ] **Step 3: `ProjetosListPage.tsx` — skeleton da grade de cards**

Trocar o import (remover `Spinner`, adicionar `Skeleton` na mesma lista de imports de
`components/ui`).

Adicionar o componente local (antes do componente da página):

```tsx
function ProjetosListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="rounded-lg border border-border p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-3 h-3 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
          <Skeleton className="mt-4 h-2 w-full" />
        </div>
      ))}
    </div>
  )
}
```

Trocar `{isLoading && <Spinner label="Carregando projetos…" />}` por:

```tsx
{isLoading && <ProjetosListSkeleton />}
```

- [ ] **Step 4: `RegistrosDiariosListPage.tsx` — skeleton da grade do calendário**

Trocar o import (remover `Spinner`, adicionar `Skeleton`).

Adicionar o componente local:

```tsx
function CalendarioSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-md" />
        ))}
      </div>
    </div>
  )
}
```

Trocar `{isLoading && <Spinner label="Carregando registros…" />}` por:

```tsx
{isLoading && <CalendarioSkeleton />}
```

- [ ] **Step 5: Build + regressão completa**

Run: `cd frontend && npm run build && npx playwright test`
Expected: build exit 0; suíte completa passando (nenhum teste verifica o Spinner/loading
diretamente, confirmado antes de escrever este plano).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/index.ts frontend/src/pages/DashboardPage.tsx frontend/src/pages/ProjetosListPage.tsx frontend/src/pages/RegistrosDiariosListPage.tsx
git commit -m "feat: substitui spinner por skeleton loader no Dashboard, Projetos e Calendario"
```

---

### Task 3: Skeleton loaders — Configurações, Wizard de RDO, Detalhe de RDO

**Files:**
- Modify: `frontend/src/pages/ConfiguracaoPage.tsx`
- Modify: `frontend/src/pages/RdoPage.tsx`
- Modify: `frontend/src/pages/RegistroDiarioDetailPage.tsx`

**Interfaces:**
- Consumes: `Skeleton` (já exportado no barrel pela Task 2).

**Nota importante (lição da Task 2):** o `<span role="status" className="sr-only">` que anuncia o
carregamento pra leitor de tela **nunca pode ser descendente** de um elemento com
`aria-hidden="true"` — `aria-hidden` remove a subárvore inteira da árvore de acessibilidade,
`role`/`aria-live` dos filhos não importam. Todo componente de skeleton abaixo já vem estruturado
certo desde o início (span como irmão do `<div aria-hidden="true">`, dentro de um Fragment
`<>...</>`) — não mover o span pra dentro do `div aria-hidden` durante a implementação.

- [ ] **Step 1: `ConfiguracaoPage.tsx` — skeleton das abas**

Trocar o import (remover `Spinner`, adicionar `Skeleton`).

Adicionar o componente local:

```tsx
function ConfiguracaoSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true">
        <Skeleton className="h-9 w-80" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </>
  )
}
```

Trocar `if (configuracao.isLoading) return <Spinner label="Carregando…" />` por:

```tsx
if (configuracao.isLoading) return <ConfiguracaoSkeleton />
```

- [ ] **Step 2: `RdoPage.tsx` — skeleton do formulário**

Trocar o import (linha 30, remover `Spinner`, adicionar `Skeleton`):

```tsx
import { Alert, Card, PageHeader, Skeleton } from '../components/ui'
```

Adicionar o componente local:

```tsx
function RdoWizardSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </>
  )
}
```

Trocar `if (configuracao.isLoading) return <Spinner label="Carregando…" />` por:

```tsx
if (configuracao.isLoading) return <RdoWizardSkeleton />
```

- [ ] **Step 3: `RegistroDiarioDetailPage.tsx` — skeleton dos cards de detalhe**

Trocar o import (linha 2, remover `Spinner`, adicionar `Skeleton`):

```tsx
import { Button, Card, EmptyState, ErrorRetry, PageHeader, Skeleton } from '../components/ui'
```

Adicionar o componente local:

```tsx
function RegistroDiarioDetailSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </>
  )
}
```

Trocar `if (isLoading) return <Spinner label="Carregando…" />` por:

```tsx
if (isLoading) return <RegistroDiarioDetailSkeleton />
```

- [ ] **Step 4: Build + regressão completa**

Run: `cd frontend && npm run build && npx playwright test`
Expected: build exit 0; suíte completa passando.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ConfiguracaoPage.tsx frontend/src/pages/RdoPage.tsx frontend/src/pages/RegistroDiarioDetailPage.tsx
git commit -m "feat: substitui spinner por skeleton loader em Configuracoes, wizard e detalhe de RDO"
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

- [ ] **Step 2: Confirmar que `Spinner` continua usado só na `LoginPage`**

Run: `grep -rn "Spinner" frontend/src/pages`
Expected: só `frontend/src/pages/LoginPage.tsx` aparece (os 2 usos de feedback inline do botão de
login, fora de escopo desta onda).

- [ ] **Step 3: Atualizar `specs/001-mvp-gestao-diaria/tasks.md`**

Adicionar ao final do arquivo:

```markdown

**Frontend — Polish SaaS profissional, Onda 1 (2026-07-21)**: primeira onda do polimento
inspirado em Linear/Notion/Spotify/Google/Microsoft — tokens de motion (`--duration-fast`,
`--duration-base`, `--ease-emphasized`) aplicados ao `Button` (feedback de hover/press
consistente, ausente até então), e skeleton loaders (componente shadcn já existente mas nunca
adotado) substituindo o spinner genérico nas 6 telas de carregamento de página (Dashboard,
Projetos, Calendário de RDOs, Configurações, Wizard de RDO, Detalhe de RDO) — sensação de "quase
pronto" em vez de espera genérica. `LoginPage` mantém `Spinner` (feedback inline do botão de
login, não carregamento de página). Próximas ondas (redução de ruído visual, sistema de
feedback/toast, UI otimista) ficam em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra onda 1 do polish SaaS profissional em tasks.md"
```
