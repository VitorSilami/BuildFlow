# Polish SaaS Profissional — Onda 2 (Empty States + Hover-Reveal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redução de ruído visual (Onda 2 do polish SaaS profissional): empty states "de página"
ganham ícone + título + descrição (em vez de só texto cinza); ação secundária (editar projeto) só
aparece no hover/foco do card, reduzindo ruído nas listas — mesma lógica de "esconder o que não é
a ação principal" do Notion.

**Architecture:** `EmptyState` (composite compartilhado, 8 usos) ganha 2 props opcionais
(`icon`, `title`) — aditivo, sem props vira exatamente o texto cinza de hoje. Só os 3 empty
states "de página" (Dashboard, e os 2 da `ProjetosListPage`) recebem o tratamento cheio; os 5
"inline/secundários" (4 em `ConfiguracaoPage`, 1 em `RegistroDiarioDetailPage`) ficam como estão —
não é todo vazio que precisa virar um momento. `Card` ganha a classe `group/card` no root (inerte
sem nenhum consumidor usando `group-hover/card:`), usada pelo botão de editar projeto na
`ProjetosListPage` pra ficar oculto por padrão e aparecer no hover/foco do card.

**Tech Stack:** React 19, TypeScript, Tailwind v4, lucide-react, Playwright.

## Global Constraints

- Zero mudança de dado/lógica: os empty states continuam controlados pelas mesmas condições
  (`data.projetos.length === 0`, `data?.results.length === 0`, `projetosFiltrados.length === 0`).
- `EmptyState` sem `icon`/`title` deve renderizar **exatamente** como hoje (só o `<p>` cinza) —
  retrocompatibilidade obrigatória pros 5 usos que não mudam nesta onda.
- Ocultar o botão de editar por hover/foco não pode quebrar teclado: usar `group-focus-within/card`
  além de `group-hover/card`, garantindo que navegação por Tab revele o botão antes do usuário
  precisar clicar nele às cegas.
- Lição das ondas anteriores: sempre confirmar visualmente que uma classe Tailwind nova realmente
  compila (grep no CSS gerado), não só que o build/teste passa — já houve um caso real nesta
  sessão de token com namespace errado compilando pra nada, silenciosamente.
- Nunca usar `--no-verify`; commits novos ao invés de amend.

---

### Task 1: `EmptyState` com ícone/título + `Card` ganha `group/card`

**Files:**
- Modify: `frontend/src/components/ui/empty-state.tsx`
- Modify: `frontend/src/components/ui/app-card.tsx`

**Interfaces:**
- Produces: `EmptyState({ icon?: ReactNode, title?: string, children })` — sem `icon` e `title`,
  idêntico ao comportamento atual; com qualquer um dos dois, renderiza o bloco maior (ícone +
  título + descrição centralizados). `Card`'s elemento raiz ganha a classe `group/card` (grupo
  nomeado, evita colisão com o `group` sem nome já usado em `LoginPage.tsx`).

- [ ] **Step 1: `empty-state.tsx`**

Substituir o arquivo inteiro por:

```tsx
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  children: ReactNode
}

export function EmptyState({ icon, title, children }: EmptyStateProps) {
  if (!icon && !title) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  }

  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center" role="status">
      {icon && <div className="text-muted-foreground/50">{icon}</div>}
      {title && <p className="font-display text-base font-semibold text-ink">{title}</p>}
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
```

- [ ] **Step 2: `app-card.tsx`**

Trocar só a className do `ShadcnCard` (uma linha):

```tsx
    <ShadcnCard className="group/card mb-6">
```

(Resto do arquivo continua idêntico — só essa uma classe muda.)

- [ ] **Step 3: Build + regressão completa**

Run: `cd frontend && npm run build && npx playwright test`
Expected: build exit 0; suíte completa passando (nenhum consumidor de `EmptyState` passa
`icon`/`title` ainda, nenhum consumidor de `Card` usa `group-hover/card:` ainda — mudança inerte
até a Task 2).

- [ ] **Step 4: Confirmar que a classe `group/card` compila**

Run: `grep -c "group\\\\/card" frontend/dist/assets/*.css`
Expected: pelo menos 1 (o `.group\/card` do Tailwind é gerado mesmo sem nenhum
`group-hover/card:` consumidor ainda, já que a própria classe `group/card` é adicionada
literalmente ao HTML/JSX — mas o *efeito* dela só aparece quando outro elemento referencia
`group-hover/card:`, o que só acontece na Task 2. Esse grep confirma só que a classe em si não foi
digitada errado.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/empty-state.tsx frontend/src/components/ui/app-card.tsx
git commit -m "feat: adiciona icone/titulo opcionais ao EmptyState e group/card ao Card"
```

---

### Task 2: Aplicar nos 3 empty states de página + hover-reveal no botão de editar

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/ProjetosListPage.tsx`
- Modify: `frontend/tests/e2e/dashboard.spec.ts`
- Modify: `frontend/tests/e2e/projetos.spec.ts`

**Interfaces:**
- Consumes: `EmptyState`'s novos props `icon`/`title` (Task 1); `Card`'s `group/card` (Task 1).

- [ ] **Step 1: `DashboardPage.tsx` — empty state "Nenhum projeto ativo"**

`FolderKanban` já está importado neste arquivo (usado na tile "Projetos ativos") — reaproveitar o
mesmo ícone, não importar de novo.

Trocar:

```tsx
            <EmptyState>
              Nenhum projeto ativo ainda.{' '}
              <Link to="/projetos" className="font-medium text-primary hover:underline">
                Crie um projeto para começar.
              </Link>
            </EmptyState>
```

por:

```tsx
            <EmptyState icon={<FolderKanban size={32} aria-hidden="true" />} title="Nenhum projeto ativo">
              Crie um projeto para começar a registrar RDOs.{' '}
              <Link to="/projetos" className="font-medium text-primary hover:underline">
                Ir para Projetos
              </Link>
            </EmptyState>
```

- [ ] **Step 2: `ProjetosListPage.tsx` — 2 empty states + hover-reveal do botão de editar**

Adicionar `FolderPlus` e `SearchX` ao import de `lucide-react` (linha 1):

```tsx
import { Calendar, FolderPlus, MapPin, Pencil, Plus, Search, SearchX, Settings, User } from 'lucide-react'
```

Trocar o primeiro `EmptyState` (lista totalmente vazia):

```tsx
      {!isLoading && !isError && data?.results.length === 0 && (
        <EmptyState icon={<FolderPlus size={32} aria-hidden="true" />} title="Nenhum projeto ainda">
          Crie o primeiro projeto pra começar a registrar RDOs.
        </EmptyState>
      )}
```

Trocar o segundo `EmptyState` (filtro/busca sem resultado):

```tsx
          {projetosFiltrados.length === 0 ? (
            <EmptyState icon={<SearchX size={32} aria-hidden="true" />} title="Nenhum projeto encontrado">
              Tente outro termo de busca ou outro filtro de status.
            </EmptyState>
          ) : (
```

Trocar o `Button` de editar (dentro de `actions` do `Card`, dentro do `.map`) — adicionar a classe
de hover-reveal:

```tsx
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${projeto.nome}`}
                        onClick={() => setModal(projeto)}
                        className="opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Button>
```

- [ ] **Step 3: Atualizar as 2 asserções de texto que mudaram**

A cópia nova quebra 2 das 3 asserções de empty state já existentes (a 3ª,
`'Nenhum projeto ainda'` em `projetos.spec.ts:70`, já bate com o novo título, não precisa mudar):

Em `frontend/tests/e2e/dashboard.spec.ts:78`, trocar:
```typescript
  await expect(page.getByText('Nenhum projeto ativo ainda.')).toBeVisible()
```
por:
```typescript
  await expect(page.getByText('Nenhum projeto ativo')).toBeVisible()
```

Em `frontend/tests/e2e/projetos.spec.ts:173`, trocar:
```typescript
  await expect(page.getByText('Nenhum projeto encontrado.')).toBeVisible()
```
por:
```typescript
  await expect(page.getByText('Nenhum projeto encontrado')).toBeVisible()
```

- [ ] **Step 3b: Build + testes**

Run: `cd frontend && npm run build && npx playwright test tests/e2e/dashboard.spec.ts tests/e2e/projetos.spec.ts`
Expected: build exit 0; todos os testes passando com as 2 asserções atualizadas.

- [ ] **Step 4: Teste novo — botão de editar oculto por padrão, aparece no hover**

Adicionar a `frontend/tests/e2e/projetos.spec.ts` (reaproveitando o mock já existente de lista com
1+ projeto):

```typescript
test('botao de editar fica oculto ate hover ou foco no card', async ({ page }) => {
  await mockAuthenticated(page)
  await page.route(PROJETOS_URL, (route) =>
    route.fulfill({
      json: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 'projeto-1', nome: 'Duplicação BR-365', trecho: '', engenheiro_responsavel: '', status: 'ativo', execucao_percentual: null, ultimo_rdo_data: null }],
      },
    }),
  )

  await page.goto('/projetos')

  const botaoEditar = page.getByRole('button', { name: 'Editar Duplicação BR-365' })
  await expect(botaoEditar).toHaveCSS('opacity', '0')

  await page.getByText('Duplicação BR-365').hover()
  await expect(botaoEditar).toHaveCSS('opacity', '1')
})
```

(Ajustar `PROJETOS_URL`/`mockAuthenticated`/nomes conforme os já existentes em
`projetos.spec.ts` — reaproveitar o padrão do arquivo, não recriar do zero.)

- [ ] **Step 5: Rodar os testes de novo**

Run: `cd frontend && npx playwright test tests/e2e/dashboard.spec.ts tests/e2e/projetos.spec.ts`
Expected: todos passando, incluindo o novo teste de hover-reveal.

- [ ] **Step 6: Regressão completa**

Run: `cd frontend && npx playwright test`
Expected: suíte inteira passando.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/ProjetosListPage.tsx frontend/tests/e2e/dashboard.spec.ts frontend/tests/e2e/projetos.spec.ts
git commit -m "feat: aplica empty states com icone e hover-reveal no botao de editar projeto"
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

**Frontend — Polish SaaS profissional, Onda 2 (2026-07-21)**: segunda onda do polimento — `EmptyState`
ganha ícone/título opcionais (aditivo, retrocompatível com os 5 usos que continuam só texto),
aplicado aos 3 empty states "de página" (Dashboard, 2 na listagem de Projetos); botão de editar
projeto (ícone de lápis) fica oculto por padrão e aparece no hover/foco do card (`Card` ganha a
classe `group/card`), reduzindo ruído visual nas listas — mesma lógica do Notion de esconder ação
secundária até o usuário precisar dela. Próximas ondas (sistema de feedback/toast, UI otimista)
ficam em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra onda 2 do polish SaaS profissional em tasks.md"
```
