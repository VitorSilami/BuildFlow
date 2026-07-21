# Polish SaaS Profissional — Onda 3 (Sistema de Toast + Momento de Dopamina no RDO) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terceira onda do polish SaaS profissional: um sistema de toast leve para confirmações de
sucesso, com o primeiro (e único, por ora) uso real sendo o "momento de dopamina" ao salvar um
Registro Diário de Obra — o fluxo mais repetido do produto, hoje sem nenhum reconhecimento visual
além da navegação silenciosa.

**Architecture:** Segue o mesmo padrão já usado para `Dialog`/`Sheet` neste codebase: um primitivo
cru shadcn-style em cima do Radix (`components/ui/toast.tsx`), um hook de estado
(`hooks/use-toast.ts`, módulo singleton — permite chamar `toast()` de dentro de um callback
`onSuccess` de mutation, fora de qualquer componente React) e um composite `Toaster` montado uma
única vez em `App.tsx`, fora do `<Routes>`, para sobreviver à troca de rota (o toast do RDO precisa
seguir visível "antes/durante a navegação" para o detalhe). O visual de sucesso reaproveita o
motivo `[✓]` + cor `signal` já estabelecido na seção "Isolamento multitenant" da `LoginPage` — não
um ícone de check genérico nem confete.

**Tech Stack:** React 19, TypeScript, `@radix-ui/react-toast` (novo), `class-variance-authority`
(já usado em `alert.tsx`/`button.tsx`/`sheet.tsx`), Tailwind v4, Playwright.

## Global Constraints

- `Alert`/`ErrorRetry` continuam sendo o padrão certo pra erro de formulário — esta onda não altera
  nenhum dos dois; toast é exclusivamente para confirmação de sucesso.
- Duração de auto-dismiss do toast: 4000ms, como constante nomeada `TOAST_DURATION_MS` (nunca um
  número mágico solto no JSX).
- O toast de sucesso do RDO usa o mesmo motivo visual `[✓]` + `text-signal`/`font-mono` já usado em
  `LoginPage.tsx:337` — não inventar um ícone novo pra "sucesso".
- `Toaster` é montado **uma única vez**, em `App.tsx`, como irmão do `<BrowserRouter>` (não dentro
  de nenhuma rota) — precisa sobreviver à navegação disparada logo depois do toast aparecer.
- Lição das ondas anteriores (Onda 1/2): depois do build, confirmar por grep no CSS compilado que
  uma classe Tailwind nova e específica desta onda realmente gerou regra — não confiar só em
  build/teste verde.
- Nunca usar `--no-verify`; commits novos ao invés de amend.
- Convenção de import já estabelecida no codebase: o primitivo cru (`toast.tsx`) usa o alias `@/`
  (`@/lib/utils`), igual a todos os outros primitivos em `components/ui/` copiados do shadcn;
  qualquer composite (`toaster.tsx`, igual a `app-alert.tsx`/`app-card.tsx`) e qualquer código de
  página/feature (`RdoPage.tsx`, `App.tsx`) usa import relativo — nunca `@/` fora dos primitivos
  crus. Não "corrigir" essa mistura para um estilo único.

---

### Task 1: Sistema de toast + momento de dopamina no salvar do RDO

**Files:**
- Modify: `frontend/package.json` (adiciona `@radix-ui/react-toast`)
- Create: `frontend/src/components/ui/toast.tsx`
- Create: `frontend/src/hooks/use-toast.ts`
- Create: `frontend/src/components/ui/toaster.tsx`
- Modify: `frontend/src/components/ui/index.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/RdoPage.tsx`
- Modify: `frontend/tests/e2e/rdo.spec.ts`

**Interfaces:**
- Produces: `toast({ title: string, description?: string, variant?: 'default' | 'success' }): string`
  (função importável de `@/hooks/use-toast`, chamável de qualquer lugar, inclusive fora de
  componentes React — usada no `onSuccess` do `RdoPage`). `useToast()` (hook, consumido só pelo
  `Toaster`). `Toaster` (composite, exportado do barrel `components/ui/index.ts`, montado uma vez
  em `App.tsx`).

- [ ] **Step 1: Instalar a dependência**

Run: `cd frontend && npm install @radix-ui/react-toast`
Expected: exit 0; `@radix-ui/react-toast` aparece em `frontend/package.json` (`dependencies`).

- [ ] **Step 2: Primitivo cru `toast.tsx`**

Criar `frontend/src/components/ui/toast.tsx`:

```tsx
import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]',
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  'pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg transition-all duration-base ease-emphasized data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground',
        success: 'border-signal/30 bg-background text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-70 transition-opacity hover:text-foreground hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring',
      className,
    )}
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  toastVariants,
}
```

- [ ] **Step 3: Hook de estado `use-toast.ts`**

Criar `frontend/src/hooks/use-toast.ts`:

```ts
import { useEffect, useState } from 'react'

export interface ToastData {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success'
  open: boolean
}

export const TOAST_DURATION_MS = 4000
const TOAST_EXIT_ANIMATION_MS = 200

type Listener = (toasts: ToastData[]) => void

let toasts: ToastData[] = []
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener(toasts))
}

export function toast(data: Omit<ToastData, 'id' | 'open'>) {
  const id = crypto.randomUUID()
  toasts = [...toasts, { ...data, id, open: true }]
  emit()
  return id
}

export function closeToast(id: string) {
  toasts = toasts.map((item) => (item.id === id ? { ...item, open: false } : item))
  emit()
  setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id)
    emit()
  }, TOAST_EXIT_ANIMATION_MS)
}

export function useToast() {
  const [state, setState] = useState<ToastData[]>(toasts)

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  return { toasts: state, close: closeToast }
}
```

`toast()` é uma função de módulo (não um hook) — pode ser chamada de dentro de um callback
`onSuccess` de `mutate`, fora de qualquer componente React. `useToast()` só é consumido pelo
`Toaster` (Step 4), que re-renderiza sempre que `emit()` dispara.

- [ ] **Step 4: Composite `toaster.tsx`**

Criar `frontend/src/components/ui/toaster.tsx`:

```tsx
import { useToast, TOAST_DURATION_MS } from '../../hooks/use-toast'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './toast'

export function Toaster() {
  const { toasts, close } = useToast()

  return (
    <ToastProvider duration={TOAST_DURATION_MS}>
      {toasts.map(({ id, title, description, variant, open }) => (
        <Toast
          key={id}
          variant={variant}
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) close(id)
          }}
        >
          <div className="grid gap-1">
            <ToastTitle className="flex items-center gap-2">
              {variant === 'success' && (
                <span className="font-mono text-signal" aria-hidden="true">
                  [✓]
                </span>
              )}
              {title}
            </ToastTitle>
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
```

- [ ] **Step 5: Exportar `Toaster` no barrel**

Modificar `frontend/src/components/ui/index.ts`, adicionando ao final:

```ts
export { Toaster } from './toaster'
```

- [ ] **Step 6: Montar `Toaster` uma vez em `App.tsx`**

Em `frontend/src/App.tsx`, adicionar o import (junto aos demais) e montar `<Toaster />` como irmão
do `<BrowserRouter>`, dentro do `<AuthProvider>`:

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
import { Toaster } from './components/ui'

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
      <Toaster />
    </AuthProvider>
  )
}

export default App
```

(Única mudança real: o `import { Toaster } ...` novo e a linha `<Toaster />` logo após o
`</BrowserRouter>` de fechamento — resto do arquivo idêntico.)

- [ ] **Step 7: Disparar o toast de sucesso ao salvar o RDO**

Em `frontend/src/pages/RdoPage.tsx`, adicionar o import de `formatData` e de `toast` (linha 1-30,
junto aos demais imports):

```tsx
import { formatData } from '../lib/format'
import { toast } from '../hooks/use-toast'
```

Trocar o `handleSubmit` (linhas 102-127) — só o `onSuccess` do `mutate` muda:

```tsx
  function handleSubmit() {
    setErro(null)

    const result = registroDiarioFormSchema.safeParse({
      data_referencia: dataReferencia,
      turno,
      clima,
      equipe,
      fiscal: Number(fiscal),
      producoes,
      presencas,
      maquinas,
      ocorrencias,
    })

    if (!result.success) {
      setErro(result.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    criarRegistro.mutate(result.data, {
      onSuccess: (registro) => {
        toast({
          title: 'Registro diário salvo',
          description: `Registro de ${formatData(registro.data_referencia)} salvo com sucesso.`,
          variant: 'success',
        })
        navigate(`/projetos/${projetoId}/registros-diarios/${registro.id}`)
      },
      onError: () => setErro('Não foi possível salvar o registro diário. Tente novamente.'),
    })
  }
```

- [ ] **Step 8: Build + confirmar que a classe nova compila**

Run: `cd frontend && npm run build`
Expected: exit 0.

Run: `grep -cF "border-signal/.3" frontend/dist/assets/*.css`
Expected: pelo menos 1 (confirma que `border-signal/30`, classe específica desta onda no
`toastVariants`, compilou — usar `-F` (fixed-string), não regex solto, pra evitar o mesmo erro de
escaping de barra já encontrado na Onda 2).

Se o grep acima der 0, ler o CSS gerado e comparar com a classe exata usada em `toastVariants`
antes de seguir — não presumir que é "inerte por natureza" como o `group/card` da Onda 2: aqui a
classe É consumida imediatamente pelo próprio componente (`Toast`), então uma ausência aqui é bug
real, não falso negativo esperado.

- [ ] **Step 9: Adicionar a asserção do toast ao teste E2E existente**

Em `frontend/tests/e2e/rdo.spec.ts`, no teste `'preencher wizard completo de RDO, ver o detalhe e
anexar foto'`, logo depois da asserção de navegação pro detalhe (linhas 105-106 atuais), adicionar:

```typescript
  await expect(page).toHaveURL(/\/registros-diarios\/rdo-1$/)
  await expect(page.getByRole('heading', { name: /Registro diário/ })).toBeVisible()

  // Momento de "dopamina": toast de sucesso aparece antes/durante a navegacao
  // pro detalhe (nao so a navegacao silenciosa que ja existia).
  await expect(page.getByText('Registro diário salvo')).toBeVisible()
```

- [ ] **Step 10: Rodar o teste do RDO**

Run: `cd frontend && npx playwright test tests/e2e/rdo.spec.ts`
Expected: todos os testes do arquivo passando, incluindo a nova asserção do toast.

- [ ] **Step 11: Regressão completa**

Run: `cd frontend && npx playwright test`
Expected: suíte inteira passando (o `Toaster` montado globalmente não deve quebrar nenhuma outra
página — nenhum toast é disparado fora do fluxo de salvar RDO, então nada mais deveria mudar de
comportamento).

- [ ] **Step 12: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/ui/toast.tsx frontend/src/components/ui/toaster.tsx frontend/src/components/ui/index.ts frontend/src/hooks/use-toast.ts frontend/src/App.tsx frontend/src/pages/RdoPage.tsx frontend/tests/e2e/rdo.spec.ts
git commit -m "feat: adiciona sistema de toast e confirmacao de sucesso ao salvar RDO"
```

(Ajustar o nome do lockfile no `git add` conforme o gerenciador real do projeto — `package-lock.json`
pra npm; se o projeto usar outro lockfile, usar o nome correspondente já presente no repo.)

---

### Task 2: Verificação final

**Files:** nenhum esperado além de possíveis pequenos ajustes achados na verificação.

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

**Frontend — Polish SaaS profissional, Onda 3 (2026-07-21)**: terceira onda do polimento — sistema
de toast leve (`@radix-ui/react-toast`, composite `Toaster` montado uma vez em `App.tsx`) para
confirmações de sucesso; primeiro uso real é o "momento de dopamina" ao salvar um Registro Diário
de Obra (fluxo mais repetido do produto), com toast de sucesso reaproveitando o motivo `[✓]` +
cor `signal` já usado na seção de isolamento multitenant da `LoginPage`, visível antes/durante a
navegação para o detalhe do registro criado. `Alert`/`ErrorRetry` continuam sendo o padrão de erro
de formulário, sem mudança. Próxima onda (UI otimista + transição de página) fica em plano
separado.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra onda 3 do polish SaaS profissional em tasks.md"
```
