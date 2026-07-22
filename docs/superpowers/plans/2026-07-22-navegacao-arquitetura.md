# Arquitetura de Navegação (Sidebar + Contexto do Projeto) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar a sidebar do BuildFlow para comunicar claramente a hierarquia Empresa → Projeto — grupos de navegação, card de contexto do projeto atual com switcher rápido, e breadcrumb com o nome do projeto em toda página de projeto.

**Architecture:** Componentes de sidebar novos e pequenos (`SidebarSection`, `SidebarGroup`, `SidebarNavItem`, `ProjectContextCard`) sob `frontend/src/layouts/sidebar/`, um hook `useProjeto` (GET `/api/v1/projetos/:id/`, endpoint já existente no backend — nenhuma mudança de backend nesta feature) e um hook de busca compartilhado extraído do `Topbar`. Breadcrumb ganha o nome do projeto via um hook novo (`useProjetoBreadcrumbs`) consumido pelas páginas — o `PageHeader` em si não muda, mantendo seu isolamento de `features/`.

**Tech Stack:** React, TypeScript, TanStack Query, React Router, Tailwind, Playwright (e2e).

## Global Constraints

- Nenhuma rota nova, nenhum endpoint de backend novo — `GET /api/v1/projetos/:id/` já existe (`ProjetoViewSet` com `RetrieveModelMixin`, sem restrição de perfil além de `IsAuthenticatedWithEmpresa`).
- Nível 1 (Empresa) só com módulos reais: Dashboard, Projetos. Nível 2 (Projeto) só com módulos reais, agrupados em Operação (Registros Diários, Histórico & Aprovações), Gestão — perfil Gerente (RNCs, Custos & Ociosidade) e Administração (Configurações).
- Sem modo rail/ícone-colapsável nesta rodada (avaliado e descartado — nav ainda rasa).
- Grupos colapsáveis sem persistência (`useState` local, expandido por padrão).
- Nenhuma renomeação de rótulo de navegação já existente ("RNCs", "Custos & Ociosidade", "Registros diários", "Histórico & Aprovações", "Configurações" ficam como estão — só mudam de agrupamento visual). Existem testes e2e que verificam esses rótulos exatos (ex.: `rnc-list.spec.ts:101`, `custos-ociosidade.spec.ts:129`).
- Botão "Entrar" → "Abrir Projeto" em `ProjetosListPage`. Card da listagem continua com botão explícito (não vira elemento único clicável).
- Project switcher usa o mesmo padrão de UI que o `Topbar` já usa hoje (estado local + fecha ao clicar fora) — não usa o componente `DropdownMenu` do design system (existe no repo mas não é usado em lugar nenhum; colocar um input de busca dentro dele é arriscado por causa do roving-focus/typeahead do Radix Menu).
- `PageHeader` (`frontend/src/components/ui/page-header.tsx`) não ganha dependência de `features/` — o prefixo de breadcrumb é montado por um hook que a página chama, não por uma prop que dispara fetch dentro do componente.
- Sem nova dependência do `package.json`.

---

### Task 1: `useProjeto`, status badge compartilhado e renomeação do botão

**Files:**
- Create: `frontend/src/features/projetos/statusBadge.ts`
- Modify: `frontend/src/features/projetos/projetosApi.ts`
- Modify: `frontend/src/pages/ProjetosListPage.tsx`
- Test: `frontend/tests/e2e/projetos.spec.ts` (nenhuma mudança de mock necessária — só a asserção do rótulo do botão)

**Interfaces:**
- Produces: `useProjeto(projetoId: string | undefined)` — `UseQueryResult<Projeto>`, `queryKey: ['projeto', projetoId]`, `enabled: Boolean(projetoId)`. `STATUS_LABEL: Record<ProjetoStatus, string>` e `STATUS_BADGE_CLASS: Record<ProjetoStatus, string>` exportados de `statusBadge.ts`.
- Consumes: `Projeto`, `ProjetoStatus` de `frontend/src/types/projeto.ts` (já existem).

- [ ] **Step 1: Extrair o badge de status para um arquivo compartilhado**

Leia `frontend/src/pages/ProjetosListPage.tsx` linhas 30-48 — hoje `STATUS_LABEL` e `STATUS_BADGE_CLASS` são definidos ali mesmo. Crie o arquivo compartilhado:

```ts
// frontend/src/features/projetos/statusBadge.ts
import type { ProjetoStatus } from '../../types/projeto'

export const STATUS_LABEL: Record<ProjetoStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

// hover:bg-*/15 (identico ao estado normal) neutraliza o hover:bg-primary/80 do
// variant "default" do Badge — sem isso, passar o mouse faria o badge colorido
// piscar de volta para a cor primaria no hover, ja que tailwind-merge so agrupa
// conflitos entre classes com o mesmo prefixo de variante (hover: vs sem hover:
// nao sao o mesmo grupo, entao a classe do variant nao seria sobrescrita).
export const STATUS_BADGE_CLASS: Record<ProjetoStatus, string> = {
  ativo:
    'border-transparent bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
  pausado:
    'border-transparent bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20',
  concluido:
    'border-transparent bg-slate-500/15 text-slate-700 hover:bg-slate-500/15 dark:bg-slate-500/20 dark:text-slate-400 dark:hover:bg-slate-500/20',
}
```

- [ ] **Step 2: Atualizar `ProjetosListPage.tsx` para importar do arquivo compartilhado**

Remova as declarações locais de `STATUS_LABEL`/`STATUS_BADGE_CLASS` (linhas 30-48 do arquivo atual) e adicione o import:

```ts
import { STATUS_BADGE_CLASS, STATUS_LABEL } from '../features/projetos/statusBadge'
```

O resto do arquivo (uso de `STATUS_LABEL[projeto.status]` e `STATUS_BADGE_CLASS[projeto.status]`) não muda.

- [ ] **Step 3: Renomear o botão "Entrar" para "Abrir Projeto"**

Em `frontend/src/pages/ProjetosListPage.tsx`, na `Card` de cada projeto:

```tsx
// antes
<Button asChild className="flex-1">
  <Link to={`/projetos/${projeto.id}/registros-diarios`}>Entrar</Link>
</Button>

// depois
<Button asChild className="flex-1">
  <Link to={`/projetos/${projeto.id}/registros-diarios`}>Abrir Projeto</Link>
</Button>
```

- [ ] **Step 4: Rodar o build de tipos para confirmar que nada quebrou**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Adicionar `useProjeto` em `projetosApi.ts`**

Em `frontend/src/features/projetos/projetosApi.ts`, adicione após `useProjetos`:

```ts
export function useProjeto(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto', projetoId],
    queryFn: () => apiClient.get<Projeto>(`${PROJETOS_PATH}${projetoId}/`),
    enabled: Boolean(projetoId),
  })
}
```

- [ ] **Step 6: Rodar os testes e2e de projetos para confirmar que nada quebrou**

Run: `cd frontend && npx playwright test tests/e2e/projetos.spec.ts --reporter=list`
Expected: todos os testes passam (nenhum deles asserta o texto "Entrar" — a asserção do botão de edição usa `Editar ${nome}`, não relacionada).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/projetos/statusBadge.ts frontend/src/features/projetos/projetosApi.ts frontend/src/pages/ProjetosListPage.tsx
git commit -m "feat: adiciona useProjeto, extrai badge de status e renomeia botao Entrar"
```

---

### Task 2: Extrair `useBuscaProjetos` do Topbar

**Files:**
- Create: `frontend/src/features/projetos/useBuscaProjetos.ts`
- Modify: `frontend/src/layouts/Topbar.tsx`
- Test: `frontend/tests/e2e/dashboard.spec.ts`, qualquer teste existente que exercite a busca do Topbar (nenhum mock novo necessário — comportamento inalterado)

**Interfaces:**
- Consumes: `useProjetos` de `frontend/src/features/projetos/projetosApi.ts` (já existe).
- Produces: `useBuscaProjetos(limite?: number)` — retorna `{ termo: string, setTermo: (valor: string) => void, resultados: Projeto[] }`.

- [ ] **Step 1: Criar o hook `useBuscaProjetos`**

```ts
// frontend/src/features/projetos/useBuscaProjetos.ts
import { useState } from 'react'
import { useProjetos } from './projetosApi'

const LIMITE_PADRAO = 5

export function useBuscaProjetos(limite = LIMITE_PADRAO) {
  const [termo, setTermo] = useState('')
  const projetos = useProjetos({ enabled: termo.length > 0 })

  const resultados = termo
    ? (projetos.data?.results ?? [])
        .filter((projeto) => projeto.nome.toLowerCase().includes(termo.toLowerCase()))
        .slice(0, limite)
    : []

  return { termo, setTermo, resultados }
}
```

- [ ] **Step 2: Atualizar `Topbar.tsx` para usar o hook**

Em `frontend/src/layouts/Topbar.tsx`, substitua o estado inline de busca pelo hook. Antes (linhas 11, 16-19, 31-35):

```ts
const MAX_RESULTADOS_BUSCA = 5
// ...
const [mobileNavOpen, setMobileNavOpen] = useState(false)
const [termoBusca, setTermoBusca] = useState('')
const buscaRef = useRef<HTMLDivElement>(null)
const projetos = useProjetos({ enabled: termoBusca.length > 0 })
// ...
const resultadosBusca = termoBusca
  ? (projetos.data?.results ?? [])
      .filter((projeto) => projeto.nome.toLowerCase().includes(termoBusca.toLowerCase()))
      .slice(0, MAX_RESULTADOS_BUSCA)
  : []
```

Depois:

```ts
const [mobileNavOpen, setMobileNavOpen] = useState(false)
const buscaRef = useRef<HTMLDivElement>(null)
const { termo: termoBusca, setTermo: setTermoBusca, resultados: resultadosBusca } = useBuscaProjetos()
```

Remova o import de `useProjetos` (não é mais usado diretamente em `Topbar.tsx`) e adicione:

```ts
import { useBuscaProjetos } from '../features/projetos/useBuscaProjetos'
```

O restante do JSX do Topbar (uso de `termoBusca`, `setTermoBusca`, `resultadosBusca`) não muda — mesmos nomes de variável, mesmo comportamento.

- [ ] **Step 3: Rodar tipos e o teste de dashboard (que passa pelo layout completo)**

Run: `cd frontend && npx tsc --noEmit && npx playwright test tests/e2e/dashboard.spec.ts --reporter=list`
Expected: sem erros de tipo, todos os testes passam.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/projetos/useBuscaProjetos.ts frontend/src/layouts/Topbar.tsx
git commit -m "refactor: extrai useBuscaProjetos do Topbar para reuso no project switcher"
```

---

### Task 3: Componentes estruturais da Sidebar (Section, Group, NavItem) e reagrupamento

**Files:**
- Create: `frontend/src/layouts/sidebar/SidebarSection.tsx`
- Create: `frontend/src/layouts/sidebar/SidebarGroup.tsx`
- Create: `frontend/src/layouts/sidebar/SidebarNavItem.tsx`
- Modify: `frontend/src/layouts/Sidebar.tsx`
- Test: Create `frontend/tests/e2e/navegacao.spec.ts`

**Interfaces:**
- Produces: `SidebarSection({ title, children })`, `SidebarGroup({ title, children })` (colapsável, `useState` local), `SidebarNavItem({ to, icon, children })`. Todos exportados como named exports dos respectivos arquivos.
- Consumes: nada de tasks anteriores.

- [ ] **Step 1: Criar `SidebarNavItem`**

```tsx
// frontend/src/layouts/sidebar/SidebarNavItem.tsx
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface hover:text-ink'
  }`

interface SidebarNavItemProps {
  to: string
  icon: ReactNode
  children: ReactNode
}

export function SidebarNavItem({ to, icon, children }: SidebarNavItemProps) {
  return (
    <NavLink to={to} className={navItemClass}>
      {icon}
      {children}
    </NavLink>
  )
}
```

- [ ] **Step 2: Criar `SidebarSection`**

```tsx
// frontend/src/layouts/sidebar/SidebarSection.tsx
import type { ReactNode } from 'react'

interface SidebarSectionProps {
  title: string
  children: ReactNode
}

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1 pt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Criar `SidebarGroup` (colapsável)**

```tsx
// frontend/src/layouts/sidebar/SidebarGroup.tsx
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface SidebarGroupProps {
  title: string
  children: ReactNode
}

export function SidebarGroup({ title, children }: SidebarGroupProps) {
  const [expandido, setExpandido] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpandido((atual) => !atual)}
        aria-expanded={expandido}
        className="flex items-center justify-between px-3 pb-1 pt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-ink"
      >
        {title}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform ${expandido ? '' : '-rotate-90'}`}
        />
      </button>
      {expandido && <div className="flex flex-col gap-1">{children}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Reagrupar `Sidebar.tsx`**

Substitua o conteúdo de `frontend/src/layouts/Sidebar.tsx` inteiro por:

```tsx
import { AlertTriangle, DollarSign, FileText, History, LayoutDashboard, LayoutGrid, Settings } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { SidebarGroup } from './sidebar/SidebarGroup'
import { SidebarNavItem } from './sidebar/SidebarNavItem'
import { SidebarSection } from './sidebar/SidebarSection'

export function SidebarNav() {
  const { projetoId } = useParams<{ projetoId?: string }>()
  const { user } = useAuth()

  return (
    <nav className="flex flex-col gap-1 p-3">
      <SidebarSection title="Empresa">
        <SidebarNavItem to="/dashboard" icon={<LayoutDashboard size={18} aria-hidden="true" />}>
          Dashboard
        </SidebarNavItem>
        <SidebarNavItem to="/projetos" icon={<LayoutGrid size={18} aria-hidden="true" />}>
          Projetos
        </SidebarNavItem>
      </SidebarSection>

      {projetoId && (
        <>
          <SidebarGroup title="Operação">
            <SidebarNavItem
              to={`/projetos/${projetoId}/registros-diarios`}
              icon={<FileText size={18} aria-hidden="true" />}
            >
              Registros diários
            </SidebarNavItem>
            <SidebarNavItem
              to={`/projetos/${projetoId}/historico-aprovacoes`}
              icon={<History size={18} aria-hidden="true" />}
            >
              Histórico & Aprovações
            </SidebarNavItem>
          </SidebarGroup>

          {user?.perfil === 'gerente' && (
            <SidebarGroup title="Gestão">
              <SidebarNavItem
                to={`/projetos/${projetoId}/rncs`}
                icon={<AlertTriangle size={18} aria-hidden="true" />}
              >
                RNCs
              </SidebarNavItem>
              <SidebarNavItem
                to={`/projetos/${projetoId}/custos-ociosidade`}
                icon={<DollarSign size={18} aria-hidden="true" />}
              >
                Custos & Ociosidade
              </SidebarNavItem>
            </SidebarGroup>
          )}

          <SidebarGroup title="Administração">
            <SidebarNavItem
              to={`/projetos/${projetoId}/configuracoes`}
              icon={<Settings size={18} aria-hidden="true" />}
            >
              Configurações
            </SidebarNavItem>
          </SidebarGroup>
        </>
      )}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
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

Note que a ordem RNCs → Custos & Ociosidade e os rótulos ("RNCs", "Custos & Ociosidade", "Registros diários", "Histórico & Aprovações", "Configurações") são idênticos aos do arquivo original — só a estrutura de agrupamento muda.

- [ ] **Step 5: Criar o arquivo de teste e2e da navegação, com os primeiros casos (agrupamento e colapso)**

```ts
// frontend/tests/e2e/navegacao.spec.ts
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const PROJETOS_URL = '**/api/v1/projetos/**'

const GERENTE = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const AUXILIAR = {
  id: '2',
  email: 'auxiliar@empresaA.example.com',
  nome: 'Auxiliar Empresa A',
  perfil: 'auxiliar_administrativo',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const PROJETO_MOCK = {
  id: 'projeto-1',
  nome: 'Duplicação BR-365',
  descricao: '',
  numero_contrato: '',
  trecho: '',
  engenheiro_responsavel: '',
  status: 'ativo',
  execucao_percentual: '52',
  ultimo_rdo_data: '2026-07-17',
  criado_por: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

async function mockSessao(page: import('@playwright/test').Page, user: typeof GERENTE) {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user }, meta: { is_authenticated: true } } }),
  )
}

async function mockProjetos(page: import('@playwright/test').Page) {
  await page.route(PROJETOS_URL, (route) => {
    if (route.request().url().endsWith('/projeto-1/')) {
      return route.fulfill({ json: PROJETO_MOCK })
    }
    return route.fulfill({
      json: { count: 1, next: null, previous: null, results: [PROJETO_MOCK] },
    })
  })
}

test('sem projeto aberto, sidebar mostra so o nivel Empresa', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)

  await page.goto('/dashboard')

  const sidebar = page.getByRole('navigation')
  await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Projetos' })).toBeVisible()
  await expect(sidebar.getByText('Operação')).not.toBeVisible()
})

test('com projeto aberto, sidebar mostra os grupos Operacao, Gestao e Administracao', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const sidebar = page.getByRole('navigation')
  await expect(sidebar.getByText('Operação')).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Registros diários' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Histórico & Aprovações' })).toBeVisible()
  await expect(sidebar.getByText('Gestão')).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'RNCs' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Custos & Ociosidade' })).toBeVisible()
  await expect(sidebar.getByText('Administração')).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Configurações' })).toBeVisible()
})

test('perfil auxiliar nao ve o grupo Gestao', async ({ page }) => {
  await mockSessao(page, AUXILIAR)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const sidebar = page.getByRole('navigation')
  await expect(sidebar.getByText('Gestão')).not.toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'RNCs' })).not.toBeVisible()
})

test('clicar no titulo do grupo colapsa e expande os itens', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const sidebar = page.getByRole('navigation')
  const itemRegistros = sidebar.getByRole('link', { name: 'Registros diários' })
  await expect(itemRegistros).toBeVisible()

  await sidebar.getByRole('button', { name: 'Operação' }).click()
  await expect(itemRegistros).not.toBeVisible()

  await sidebar.getByRole('button', { name: 'Operação' }).click()
  await expect(itemRegistros).toBeVisible()
})
```

- [ ] **Step 6: Rodar o novo teste e2e**

Run: `cd frontend && npx playwright test tests/e2e/navegacao.spec.ts --reporter=list`
Expected: os 4 testes passam.

- [ ] **Step 7: Rodar a suíte e2e completa pra checar regressão**

Run: `cd frontend && npx playwright test --reporter=list`
Expected: todos os testes passam — nenhuma outra spec depende da estrutura antiga da sidebar além dos rótulos de link já preservados.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/layouts/sidebar frontend/src/layouts/Sidebar.tsx frontend/tests/e2e/navegacao.spec.ts
git commit -m "feat: reagrupa sidebar em Empresa/Operacao/Gestao/Administracao com grupos colapsaveis"
```

---

### Task 4: `ProjectContextCard` com project switcher, integrado à Sidebar

**Files:**
- Create: `frontend/src/layouts/sidebar/ProjectContextCard.tsx`
- Modify: `frontend/src/layouts/Sidebar.tsx`
- Modify: `frontend/tests/e2e/historico-aprovacoes.spec.ts`
- Modify: `frontend/tests/e2e/rnc-list.spec.ts`
- Modify: `frontend/tests/e2e/rnc-form.spec.ts`
- Modify: `frontend/tests/e2e/custos-ociosidade.spec.ts`
- Modify: `frontend/tests/e2e/config.spec.ts`
- Modify: `frontend/tests/e2e/registros-list.spec.ts`
- Modify: `frontend/tests/e2e/rdo.spec.ts`
- Modify: `frontend/tests/e2e/navegacao.spec.ts`

**Interfaces:**
- Consumes: `useProjeto` (Task 1), `useBuscaProjetos` (Task 2), `STATUS_LABEL`/`STATUS_BADGE_CLASS` (Task 1), `formatExecucao`/`formatData` de `frontend/src/lib/format.ts` (já existem).
- Produces: `ProjectContextCard({ projetoId }: { projetoId: string })`, componente default-exportado como named export, renderizado dentro de `SidebarNav` quando `projetoId` existe.

**Por que esta task quebra testes existentes sem tocar em nada relacionado a eles:** a partir desta task, `SidebarNav` passa a chamar `useProjeto(projetoId)` (via `ProjectContextCard`) sempre que a URL tem `:projetoId` — e a `Sidebar` é renderizada em toda página dentro de `DashboardLayout`. Isso inclui páginas cujos testes e2e hoje **não mockam** `GET /api/v1/projetos/:id/` (só mockam os sub-recursos, ex.: `**/api/v1/projetos/*/rncs/**`). Sem o mock, a query do card fica em estado de erro (a lib de fetch tenta bater num backend real inexistente no ambiente de teste) — o card deve degradar bem (não quebrar a página), mas para os testes ficarem determinísticos e não gerarem ruído/erros de rede não tratados, cada spec afetado ganha um mock de `GET /api/v1/projetos/*/` (pattern com barra final, que não colide com os sub-recursos porque `*` não casa `/`).

- [ ] **Step 1: Criar `ProjectContextCard`**

```tsx
// frontend/src/layouts/sidebar/ProjectContextCard.tsx
import { ChevronsUpDown, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Input } from '../../components/ui'
import { useBuscaProjetos } from '../../features/projetos/useBuscaProjetos'
import { useProjeto } from '../../features/projetos/projetosApi'
import { STATUS_BADGE_CLASS, STATUS_LABEL } from '../../features/projetos/statusBadge'
import { formatData, formatExecucao } from '../../lib/format'

interface ProjectContextCardProps {
  projetoId: string
}

export function ProjectContextCard({ projetoId }: ProjectContextCardProps) {
  const projeto = useProjeto(projetoId)
  const [aberto, setAberto] = useState(false)
  const { termo, setTermo, resultados } = useBuscaProjetos()
  const painelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(event.target as Node)) {
        setAberto(false)
        setTermo('')
      }
    }
    document.addEventListener('mousedown', fecharAoClicarFora)
    return () => document.removeEventListener('mousedown', fecharAoClicarFora)
  }, [setTermo])

  if (projeto.isLoading || !projeto.data) {
    return (
      <div className="mx-3 mb-2 rounded-lg border border-dashed border-border p-3">
        <p className="text-xs text-muted-foreground">Carregando projeto…</p>
      </div>
    )
  }

  const dados = projeto.data

  return (
    <div ref={painelRef} className="relative mx-3 mb-2">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        aria-label="Trocar de projeto"
        className="flex w-full flex-col gap-2 rounded-lg border border-dashed border-border p-3 text-left hover:bg-surface"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Projeto Atual
          </p>
          <ChevronsUpDown size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </div>
        <p className="truncate font-display text-sm font-bold text-ink">{dados.nome}</p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Badge className={STATUS_BADGE_CLASS[dados.status]}>{STATUS_LABEL[dados.status]}</Badge>
          <span>{formatExecucao(dados.execucao_percentual)}</span>
        </div>
        <p className="text-xs text-muted-foreground">Último RDO: {formatData(dados.ultimo_rdo_data)}</p>
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border border-border bg-background p-2 shadow-md">
          <div className="relative mb-2">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={termo}
              onChange={(event) => setTermo(event.target.value)}
              placeholder="Buscar projeto…"
              aria-label="Buscar projeto para trocar"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <ul aria-label="Resultados da busca de projetos">
            {termo && resultados.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum projeto encontrado.</li>
            )}
            {resultados.map((resultado) => (
              <li key={resultado.id}>
                <Link
                  to={`/projetos/${resultado.id}/registros-diarios`}
                  className="block rounded-sm px-2 py-1.5 text-sm hover:bg-surface"
                  onClick={() => {
                    setAberto(false)
                    setTermo('')
                  }}
                >
                  {resultado.nome}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/projetos"
            className="mt-1 block rounded-sm px-2 py-1.5 text-sm font-medium text-primary hover:underline"
            onClick={() => setAberto(false)}
          >
            Ver todos os projetos →
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar exports de `Badge` e `Input` em `frontend/src/components/ui/index.ts`**

Ambos já são exportados (`export { Badge } from './badge'` e `export { Input } from './input'`) — nenhuma mudança necessária nesse arquivo.

- [ ] **Step 3: Integrar o card em `Sidebar.tsx`**

Em `frontend/src/layouts/Sidebar.tsx`, adicione o import e renderize o card logo após a `SidebarSection title="Empresa"` e antes dos grupos de projeto:

```tsx
import { ProjectContextCard } from './sidebar/ProjectContextCard'
```

```tsx
      {projetoId && (
        <>
          <ProjectContextCard projetoId={projetoId} />

          <SidebarGroup title="Operação">
```

(a linha `<SidebarGroup title="Operação">` já existe — só adicione `<ProjectContextCard projetoId={projetoId} />` imediatamente antes dela, dentro do mesmo fragmento `{projetoId && (<>...)}`)

- [ ] **Step 4: Atualizar `frontend/tests/e2e/historico-aprovacoes.spec.ts` com o mock do projeto**

Adicione as constantes e um `test.beforeEach` logo após os imports/constantes existentes (linhas 1-22):

```ts
const PROJETO_DETALHE_URL = '**/api/v1/projetos/*/'
const PROJETO_MOCK = {
  id: 'projeto-1',
  nome: 'Duplicação BR-365',
  descricao: '',
  numero_contrato: '',
  trecho: '',
  engenheiro_responsavel: '',
  status: 'ativo',
  execucao_percentual: '52',
  ultimo_rdo_data: '2026-07-17',
  criado_por: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

test.beforeEach(async ({ page }) => {
  await page.route(PROJETO_DETALHE_URL, (route) => route.fulfill({ json: PROJETO_MOCK }))
})
```

- [ ] **Step 5: Repetir o Step 4 nos demais specs afetados**

Adicione o mesmo bloco (`PROJETO_DETALHE_URL`, `PROJETO_MOCK`, `test.beforeEach`) em:
- `frontend/tests/e2e/rnc-list.spec.ts`
- `frontend/tests/e2e/rnc-form.spec.ts`
- `frontend/tests/e2e/custos-ociosidade.spec.ts`
- `frontend/tests/e2e/config.spec.ts`
- `frontend/tests/e2e/registros-list.spec.ts`
- `frontend/tests/e2e/rdo.spec.ts`

Em cada arquivo, insira o bloco logo após a última constante existente e antes do primeiro `test(...)`. O pattern `**/api/v1/projetos/*/` não colide com nenhum mock já existente nesses arquivos (todos usam sub-rotas com pelo menos mais um segmento depois do id, ex.: `**/api/v1/projetos/*/rncs/**`, `**/api/v1/projetos/*/configuracao/`) — confirme rodando os testes no Step 6.

- [ ] **Step 6: Rodar todos os specs afetados**

Run: `cd frontend && npx playwright test tests/e2e/historico-aprovacoes.spec.ts tests/e2e/rnc-list.spec.ts tests/e2e/rnc-form.spec.ts tests/e2e/custos-ociosidade.spec.ts tests/e2e/config.spec.ts tests/e2e/registros-list.spec.ts tests/e2e/rdo.spec.ts --reporter=list`
Expected: todos passam.

- [ ] **Step 7: Adicionar testes do card e do switcher em `navegacao.spec.ts`**

Adicione ao final de `frontend/tests/e2e/navegacao.spec.ts` (mesmo arquivo criado na Task 3):

```ts
test('card de contexto mostra nome, status, execucao e ultimo rdo do projeto', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const card = page.getByRole('button', { name: 'Trocar de projeto' })
  await expect(card).toContainText('Duplicação BR-365')
  await expect(card).toContainText('Ativo')
  await expect(card).toContainText('52%')
  await expect(card).toContainText('17/07/2026')
})

test('switcher busca outro projeto e navega sem sair da tela', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await page.route(PROJETOS_URL, (route) => {
    const url = route.request().url()
    if (url.endsWith('/projeto-1/')) return route.fulfill({ json: PROJETO_MOCK })
    if (url.endsWith('/projeto-2/')) {
      return route.fulfill({ json: { ...PROJETO_MOCK, id: 'projeto-2', nome: 'Contorno BR-101' } })
    }
    return route.fulfill({
      json: {
        count: 2,
        next: null,
        previous: null,
        results: [PROJETO_MOCK, { ...PROJETO_MOCK, id: 'projeto-2', nome: 'Contorno BR-101' }],
      },
    })
  })
  await page.route('**/api/v1/projetos/*/registros-diarios/**', (route) => route.fulfill({ json: [] }))

  await page.goto('/projetos/projeto-1/registros-diarios')

  await page.getByRole('button', { name: 'Trocar de projeto' }).click()
  await page.getByLabel('Buscar projeto para trocar').fill('Contorno')
  await page.getByRole('link', { name: 'Contorno BR-101' }).click()

  await expect(page).toHaveURL('/projetos/projeto-2/registros-diarios')
})

test('switcher tem link para ver todos os projetos', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  await page.getByRole('button', { name: 'Trocar de projeto' }).click()
  await page.getByRole('link', { name: 'Ver todos os projetos →' }).click()

  await expect(page).toHaveURL('/projetos')
})
```

- [ ] **Step 8: Rodar o spec de navegação completo**

Run: `cd frontend && npx playwright test tests/e2e/navegacao.spec.ts --reporter=list`
Expected: os 7 testes (4 da Task 3 + 3 novos) passam.

- [ ] **Step 9: Rodar a suíte e2e completa**

Run: `cd frontend && npx playwright test --reporter=list`
Expected: todos os testes passam.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/layouts/sidebar/ProjectContextCard.tsx frontend/src/layouts/Sidebar.tsx frontend/tests/e2e/historico-aprovacoes.spec.ts frontend/tests/e2e/rnc-list.spec.ts frontend/tests/e2e/rnc-form.spec.ts frontend/tests/e2e/custos-ociosidade.spec.ts frontend/tests/e2e/config.spec.ts frontend/tests/e2e/registros-list.spec.ts frontend/tests/e2e/rdo.spec.ts frontend/tests/e2e/navegacao.spec.ts
git commit -m "feat: adiciona ProjectContextCard com switcher de projeto na sidebar"
```

---

### Task 5: Breadcrumb com nome do projeto (`useProjetoBreadcrumbs`)

**Files:**
- Create: `frontend/src/features/projetos/useProjetoBreadcrumbs.ts`
- Modify: `frontend/src/components/ui/page-header.tsx` (só exportar o tipo `Breadcrumb`, sem mudança de comportamento)
- Modify: `frontend/src/pages/ConfiguracaoPage.tsx`
- Modify: `frontend/src/pages/HistoricoAprovacoesPage.tsx`
- Modify: `frontend/src/pages/RncListPage.tsx`
- Modify: `frontend/src/pages/RncFormPage.tsx`
- Modify: `frontend/src/pages/CustosOciosidadePage.tsx`
- Modify: `frontend/src/pages/RegistrosDiariosListPage.tsx`
- Modify: `frontend/src/pages/RdoPage.tsx`
- Modify: `frontend/src/pages/RegistroDiarioDetailPage.tsx`
- Modify: `frontend/tests/e2e/navegacao.spec.ts`

**Interfaces:**
- Consumes: `useProjeto` (Task 1).
- Produces: `useProjetoBreadcrumbs(projetoId: string | undefined, trilhaFinal: Breadcrumb[]): Breadcrumb[]`.

- [ ] **Step 1: Exportar o tipo `Breadcrumb` de `page-header.tsx`**

Em `frontend/src/components/ui/page-header.tsx`, mude a interface local (linha 4) de:

```ts
interface Breadcrumb {
```

para:

```ts
export interface Breadcrumb {
```

Nenhuma outra mudança nesse arquivo — comportamento do `PageHeader` idêntico.

- [ ] **Step 2: Criar `useProjetoBreadcrumbs`**

```ts
// frontend/src/features/projetos/useProjetoBreadcrumbs.ts
import type { Breadcrumb } from '../../components/ui/page-header'
import { useProjeto } from './projetosApi'

export function useProjetoBreadcrumbs(
  projetoId: string | undefined,
  trilhaFinal: Breadcrumb[],
): Breadcrumb[] {
  const projeto = useProjeto(projetoId)
  const nomeProjeto = projeto.data?.nome ?? '…'

  return [
    { label: 'Projetos', to: '/projetos' },
    { label: nomeProjeto, to: `/projetos/${projetoId}/registros-diarios` },
    ...trilhaFinal,
  ]
}
```

- [ ] **Step 3: Atualizar `ConfiguracaoPage.tsx`**

Adicione o import:

```ts
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
```

Após a linha `const configuracao = useConfiguracaoProjeto(projetoId ?? '')` (linha 46), adicione:

```ts
const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Configurações' }])
```

Troque (linha 87):

```tsx
<PageHeader title="Configurações" breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Configurações' }]} />
```

por:

```tsx
<PageHeader title="Configurações" breadcrumbs={breadcrumbs} />
```

- [ ] **Step 4: Atualizar `HistoricoAprovacoesPage.tsx`**

Adicione o import e, logo após `const { projetoId } = useParams<{ projetoId: string }>()` (linha 173):

```ts
const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Histórico & Aprovações' }])
```

Troque (linha 225):

```tsx
breadcrumbs={[{ label: 'Histórico & Aprovações' }]}
```

por:

```tsx
breadcrumbs={breadcrumbs}
```

- [ ] **Step 5: Atualizar `RncListPage.tsx`**

Adicione o import e, logo após `const { projetoId } = useParams<{ projetoId: string }>()` (linha 68) — antes do `if (!ehGerente)` (linha 75), já que hooks não podem vir depois de um `return` condicional:

```ts
const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'RNCs' }])
```

Troque as duas ocorrências de `breadcrumbs={[{ label: 'RNCs' }]}` (linhas 78 e 94) por `breadcrumbs={breadcrumbs}`.

- [ ] **Step 6: Atualizar `RncFormPage.tsx`**

O componente já declara, nesta ordem: `projetoId`/`rncId` (linha 71), `ehEdicao = Boolean(rncId)` (linha 74), `ehGerente` (linha 75), `const rnc = useRnc(rncId, ehGerente)` (linha 77). Adicione o import e, logo após a linha 77 — antes do primeiro `if (!ehGerente) return` (linha 151):

```ts
const breadcrumbs = useProjetoBreadcrumbs(projetoId, [
  { label: 'RNCs', to: `/projetos/${projetoId}/rncs` },
  { label: ehEdicao ? 'Editar' : 'Nova' },
])
```

Troque a linha 154:

```tsx
<PageHeader title={ehEdicao ? 'Editar RNC' : 'Nova RNC'} breadcrumbs={[{ label: 'RNCs' }]} />
```

por:

```tsx
<PageHeader title={ehEdicao ? 'Editar RNC' : 'Nova RNC'} breadcrumbs={breadcrumbs} />
```

E as linhas 172-175:

```tsx
breadcrumbs={[
  { label: 'RNCs', to: `/projetos/${projetoId}/rncs` },
  { label: ehEdicao ? 'Editar' : 'Nova' },
]}
```

por:

```tsx
breadcrumbs={breadcrumbs}
```

- [ ] **Step 7: Atualizar `CustosOciosidadePage.tsx`**

Adicione o import e, logo após `const { projetoId } = useParams<{ projetoId: string }>()` (linha 203) — antes do `if (!ehGerente)` (linha 209):

```ts
const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Custos & Ociosidade' }])
```

Troque as duas ocorrências de `breadcrumbs={[{ label: 'Custos & Ociosidade' }]}` (linhas 212 e 222) por `breadcrumbs={breadcrumbs}`.

- [ ] **Step 8: Atualizar `RegistrosDiariosListPage.tsx`**

Adicione o import e, logo após `const { projetoId } = useParams<{ projetoId: string }>()` (linha 54):

```ts
const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Registros diários' }])
```

Troque a linha 84:

```tsx
breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Registros diários' }]}
```

por:

```tsx
breadcrumbs={breadcrumbs}
```

- [ ] **Step 9: Atualizar `RdoPage.tsx`**

Adicione o import e, logo após `const { projetoId } = useParams<{ projetoId: string }>()` (linha 50):

```ts
const breadcrumbs = useProjetoBreadcrumbs(projetoId, [
  { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
  { label: 'Novo' },
])
```

Troque as linhas 141-145:

```tsx
breadcrumbs={[
  { label: 'Projetos', to: '/projetos' },
  { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
  { label: 'Novo' },
]}
```

por:

```tsx
breadcrumbs={breadcrumbs}
```

- [ ] **Step 10: Atualizar `RegistroDiarioDetailPage.tsx`**

Adicione o import. Este arquivo tem um `return` condicional antes de qualquer outro hook (`if (isLoading) return ...` na linha 27, `if (isError || !registro) return ...` na linha 29) — o hook precisa vir ANTES desses returns, logo após a linha 25 (`const { data: registro, ... } = useRegistroDiario(registroId)`):

```ts
const breadcrumbs = useProjetoBreadcrumbs(projetoId, [
  { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
  { label: registro?.data_referencia ?? '…' },
])
```

Troque as linhas 37-41:

```tsx
breadcrumbs={[
  { label: 'Projetos', to: '/projetos' },
  { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
  { label: registro.data_referencia },
]}
```

por:

```tsx
breadcrumbs={breadcrumbs}
```

(O título `` `Registro diário — ${registro.data_referencia}` `` na mesma `PageHeader`, linha 36, continua depois dos `return` de loading/erro — só o breadcrumb precisa ser calculado antes, por isso o fallback `registro?.data_referencia ?? '…'` no hook.)

- [ ] **Step 11: Rodar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 12: Adicionar teste de breadcrumb em `navegacao.spec.ts`**

Adicione ao final de `frontend/tests/e2e/navegacao.spec.ts`:

```ts
test('breadcrumb mostra o nome do projeto e linka para o projeto', async ({ page }) => {
  await mockSessao(page, GERENTE)
  await mockProjetos(page)
  await page.route('**/api/v1/projetos/projeto-1/registros-diarios/**', (route) =>
    route.fulfill({ json: [] }),
  )

  await page.goto('/projetos/projeto-1/registros-diarios')

  const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  await expect(breadcrumb.getByText('Projetos')).toBeVisible()
  const linkProjeto = breadcrumb.getByRole('link', { name: 'Duplicação BR-365' })
  await expect(linkProjeto).toBeVisible()
  await expect(linkProjeto).toHaveAttribute('href', '/projetos/projeto-1/registros-diarios')
  await expect(breadcrumb.getByText('Registros diários')).toBeVisible()
})
```

- [ ] **Step 13: Rodar o spec de navegação e a suíte completa**

Run: `cd frontend && npx playwright test tests/e2e/navegacao.spec.ts --reporter=list`
Expected: os 8 testes passam.

Run: `cd frontend && npx playwright test --reporter=list`
Expected: todos os testes da suíte passam.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/features/projetos/useProjetoBreadcrumbs.ts frontend/src/components/ui/page-header.tsx frontend/src/pages/ConfiguracaoPage.tsx frontend/src/pages/HistoricoAprovacoesPage.tsx frontend/src/pages/RncListPage.tsx frontend/src/pages/RncFormPage.tsx frontend/src/pages/CustosOciosidadePage.tsx frontend/src/pages/RegistrosDiariosListPage.tsx frontend/src/pages/RdoPage.tsx frontend/src/pages/RegistroDiarioDetailPage.tsx frontend/tests/e2e/navegacao.spec.ts
git commit -m "feat: adiciona nome do projeto ao breadcrumb de todas as paginas de projeto"
```

